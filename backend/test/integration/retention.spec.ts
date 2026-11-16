import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encryptWithCoreKey, finalPromptAad } from '../../src/lib/coreCipher.js';
import { runRetention } from '../../src/retention/retention.js';
import { getStorage } from '../../src/storage/index.js';
import { api, bearer, pool, registerUser, useDatabase } from '../helpers/api.js';
import { createReferenceId, download, postGeneration, settle, uploadReference } from '../helpers/pipeline.js';

useDatabase();

async function insertGeneration(userId: string, ageDays: number): Promise<string> {
  const id = randomUUID();
  const enc = encryptWithCoreKey('secret final prompt for retention test', finalPromptAad(id));
  const template = (await pool.query<{ id: string }>("SELECT id FROM templates WHERE slug = 'poster-kegiatan-organisasi'")).rows[0]!;
  await pool.query(
    `INSERT INTO generations (id, user_id, template_id, mode, subject, publication, status, slot_values, remarks, reference_inputs,
                              final_prompt_ciphertext, final_prompt_iv, final_prompt_auth_tag, created_at)
     VALUES ($1, $2, $3, 't2i', 'product', 'poster', 'done', '{"title":"Halo"}'::jsonb, 'catatan pribadi',
             '[{"reference_id":"00000000-0000-4000-8000-000000000000","role":"product"}]'::jsonb, $4, $5, $6, now() - make_interval(days => $7))`,
    [id, userId, template.id, enc.ciphertext, enc.iv, enc.authTag, ageDays],
  );
  return id;
}

describe('retention job', () => {
  it('purges expired human-model references and wipes prompt-bearing fields of old generations', async () => {
    const user = await registerUser();
    const human = (await uploadReference(user, { role: 'human_model', consent_confirmed: true })).body.data as { id: string; url: string };
    const product = await createReferenceId(user, 'product');
    const humanFresh = (await uploadReference(user, { role: 'human_model', consent_confirmed: true })).body.data as { id: string; url: string };
    expect((await download(human.url)).status).toBe(200);

    // Expire one of the two human photos (the upload set 7 days ahead).
    await pool.query("UPDATE reference_assets SET expires_at = now() - interval '1 hour' WHERE id = $1", [human.id]);

    const old = await insertGeneration(user.id, 91);
    const recent = await insertGeneration(user.id, 89);
    const resultOfOld = await postGeneration(user, { template_slug: 'poster-kegiatan-organisasi', slot_values: { title: 'Bazar', date_venue: 'Balai' } });
    const oldWithResult = resultOfOld.body.data.id as string;
    const done = await settle(user, oldWithResult);
    await pool.query("UPDATE generations SET created_at = now() - interval '120 days' WHERE id = $1", [oldWithResult]);

    const result = await runRetention();
    expect(result).not.toBeNull();
    expect(result!.expiredReferences).toBeGreaterThanOrEqual(1);
    expect(result!.purgedGenerations).toBeGreaterThanOrEqual(2);

    // Expired photo: row soft-deleted, file gone, unusable. Everything else untouched.
    const rows = (await pool.query<{ id: string; deleted_at: Date | null }>('SELECT id, deleted_at FROM reference_assets WHERE id = ANY($1)', [[human.id, product, humanFresh.id]])).rows;
    const state = Object.fromEntries(rows.map((r) => [r.id, r.deleted_at !== null]));
    expect(state).toEqual({ [human.id]: true, [product]: false, [humanFresh.id]: false });
    expect((await download(human.url)).status).toBe(404);
    expect((await download(humanFresh.url)).status).toBe(200);
    const assetRow = (await pool.query<{ deleted_at: Date | null; file_deleted_at: Date | null }>(
      'SELECT a.deleted_at, a.file_deleted_at FROM reference_assets r JOIN assets a ON a.id = r.asset_id WHERE r.id = $1',
      [human.id],
    )).rows[0]!;
    expect(assetRow.deleted_at).not.toBeNull();
    expect(assetRow.file_deleted_at).not.toBeNull();

    // Old generations lose prompt, remarks, slot values and reference list; recent ones keep everything.
    const wiped = (await pool.query(
      `SELECT remarks, slot_values, reference_inputs, final_prompt_ciphertext, final_prompt_iv, final_prompt_auth_tag, purged_at, status
         FROM generations WHERE id = ANY($1)`,
      [[old, oldWithResult]],
    )).rows;
    for (const row of wiped) {
      expect(row.remarks).toBeNull();
      expect(row.slot_values).toEqual({});
      expect(row.reference_inputs).toEqual([]);
      expect(row.final_prompt_ciphertext).toBeNull();
      expect(row.final_prompt_iv).toBeNull();
      expect(row.final_prompt_auth_tag).toBeNull();
      expect(row.purged_at).not.toBeNull();
    }
    const kept = (await pool.query('SELECT remarks, slot_values, final_prompt_ciphertext, purged_at FROM generations WHERE id = $1', [recent])).rows[0]!;
    expect(kept.remarks).toBe('catatan pribadi');
    expect(kept.slot_values).toEqual({ title: 'Halo' });
    expect(kept.final_prompt_ciphertext).not.toBeNull();
    expect(kept.purged_at).toBeNull();

    // The generated image itself is not a prompt-bearing field and stays available to its owner.
    const detail = await api().get(`/api/v1/generations/${oldWithResult}`).set(bearer(user.accessToken));
    expect(detail.body.data).toMatchObject({ status: 'done', slot_values: {}, remarks: null, references: [] });
    expect((await download(detail.body.data.result_url)).status).toBe(200);
    expect(done.result_url).toBeTruthy();
  });

  it('is idempotent and never touches seed assets', async () => {
    await runRetention();
    const again = await runRetention();
    expect(again).toEqual({ expiredReferences: 0, purgedGenerations: 0, orphanFiles: 0 });
    const seed = (await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM assets WHERE storage_key LIKE 'seed/%' AND (deleted_at IS NOT NULL OR file_deleted_at IS NOT NULL)")).rows[0]!;
    expect(seed.n).toBe(0);
  });

  it('removes files of soft-deleted assets that are still in storage (for example after DELETE /me)', async () => {
    const user = await registerUser();
    const ref = await createReferenceId(user, 'product');
    const row = (await pool.query<{ asset_id: string; storage_key: string }>('SELECT r.asset_id, a.storage_key FROM reference_assets r JOIN assets a ON a.id = r.asset_id WHERE r.id = $1', [ref])).rows[0]!;
    await pool.query('UPDATE assets SET deleted_at = now() WHERE id = $1', [row.asset_id]);
    expect(await getStorage().open(row.storage_key)).not.toBeNull();

    const result = await runRetention();
    expect(result!.orphanFiles).toBeGreaterThanOrEqual(1);
    expect(await getStorage().open(row.storage_key)).toBeNull();
    const after = (await pool.query<{ file_deleted_at: Date | null }>('SELECT file_deleted_at FROM assets WHERE id = $1', [row.asset_id])).rows[0]!;
    expect(after.file_deleted_at).not.toBeNull();
  });

  it('skips when another process already holds the retention lock', async () => {
    const holder = await pool.connect();
    try {
      await holder.query("SELECT pg_advisory_lock(hashtextextended('retention:purge', 0))");
      expect(await runRetention()).toBeNull();
    } finally {
      await holder.query("SELECT pg_advisory_unlock(hashtextextended('retention:purge', 0))");
      holder.release();
    }
    expect(await runRetention()).not.toBeNull();
  });

  it('honours an explicit retention window and clock', async () => {
    const user = await registerUser();
    const id = await insertGeneration(user.id, 10);
    const result = await runRetention({ generationDays: 5 });
    expect(result!.purgedGenerations).toBeGreaterThanOrEqual(1);
    const row = (await pool.query<{ purged_at: Date | null }>('SELECT purged_at FROM generations WHERE id = $1', [id])).rows[0]!;
    expect(row.purged_at).not.toBeNull();
  });
});
