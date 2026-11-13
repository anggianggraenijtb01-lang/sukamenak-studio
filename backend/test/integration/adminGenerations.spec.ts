import { afterEach, describe, expect, it } from 'vitest';
import { ProviderError } from '../../src/providers/errors.js';
import { mockProvider } from '../../src/providers/mock.js';
import { registerProvider } from '../../src/providers/registry.js';
import { collectKeys, pool, registerUser } from '../helpers/api.js';
import { as, auditFor, expectNoSecretsInAudit, loginSeedAdmin, suffix, uuid, useSeededDatabase } from '../helpers/admin.js';
import { createReferenceId, postGeneration, settle } from '../helpers/pipeline.js';

useSeededDatabase();

afterEach(() => registerProvider(mockProvider));

const REMARK = 'ZQREMARKMARKER';
const SLOT = 'ZQSLOTMARKER';
const TODAY = new Date().toISOString().slice(0, 10);

type Session = Awaited<ReturnType<typeof registerUser>>;

async function make(user: Session, slug = 'poster-kegiatan-organisasi', extra: Record<string, unknown> = {}) {
  const res = await postGeneration(user, { template_slug: slug, slot_values: { title: `Judul ${SLOT}`, date_venue: 'Balai Desa' }, remarks: `${REMARK} warna hangat`, ...extra });
  expect(res.status).toBe(202);
  await settle(user, res.body.data.id);
  return res.body.data.id as string;
}

/** Parses simple CSV (quoted fields, doubled quotes) into rows. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      /* ignore */
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  return rows;
}

describe('admin generations log', () => {
  it('lists with every filter and pagination, without prompts, remarks or slot values', async () => {
    const admin = await loginSeedAdmin();
    const user = await registerUser();
    const ok1 = await make(user);
    const ok2 = await make(user, 'poster-promo-produk', { reference_ids: [await createReferenceId(user, 'product', '#aa4411')], slot_values: { title: `Promo ${SLOT}`, cta: 'Beli' } });
    registerProvider({
      ...mockProvider,
      async generateImage() {
        throw new ProviderError('PROVIDER_UNAVAILABLE', { httpStatus: 503 });
      },
    });
    const failed = await make(user);
    registerProvider(mockProvider);

    const mine = await as(admin).get(`/generations?user=${user.id}&limit=2&page=1`);
    expect(mine.status).toBe(200);
    expect(mine.body.meta).toMatchObject({ total: 3, limit: 2, total_pages: 2 });
    expect(mine.body.data).toHaveLength(2);
    expect(mine.body.data[0].id).toBe(failed); // newest first

    const keys = collectKeys(mine.body);
    for (const forbidden of ['slot_values', 'remarks', 'final_prompt_ciphertext', 'prompt', 'reference_inputs', 'analysis', 'password_hash']) expect(keys.has(forbidden), forbidden).toBe(false);
    expect(mine.text).not.toContain(REMARK);
    expect(mine.text).not.toContain(SLOT);

    const ids = async (qs: string) => ((await as(admin).get(`/generations?user=${user.id}&${qs}`)).body.data as { id: string }[]).map((g) => g.id).sort();
    expect(await ids('status=failed')).toEqual([failed]);
    expect(await ids('status=done')).toEqual([ok1, ok2].sort());
    expect(await ids('mode=i2i')).toEqual([ok2]);
    expect(await ids('mode=t2i')).toEqual([ok1, failed].sort());
    expect(await ids(`from=${TODAY}&to=${TODAY}`)).toHaveLength(3);
    expect(await ids('from=2000-01-01&to=2000-01-02')).toHaveLength(0);
    expect(await ids('degraded=true')).toEqual([]);
    expect(await ids('flagged=false')).toHaveLength(3);
    const tpl = (await pool.query<{ id: string }>("SELECT id FROM templates WHERE slug = 'poster-promo-produk'")).rows[0] as { id: string };
    expect(await ids(`template=${tpl.id}`)).toEqual([ok2]);
    const model = (await pool.query<{ model_image_id: string }>('SELECT model_image_id FROM generations WHERE id = $1', [ok1])).rows[0] as { model_image_id: string };
    expect(await ids(`model=${model.model_image_id}`)).toEqual([ok1]);

    for (const bad of ['status=weird', 'user=nope', 'from=12-11-2026', 'from=2026-02-30', 'from=2026-02-02&to=2026-02-01', 'limit=1000', 'degraded=maybe']) {
      expect((await as(admin).get(`/generations?${bad}`)).status, bad).toBe(400);
    }
  });

  it('shows the full stage timeline with durations, cost, model and sanitised errors, and no prompt data', async () => {
    const admin = await loginSeedAdmin();
    const user = await registerUser();
    const ref = await createReferenceId(user, 'color', '#2244cc');
    const good = await make(user, 'poster-promo-produk', { reference_ids: [ref], slot_values: { title: `Promo ${SLOT}`, cta: 'Beli' } });
    registerProvider({
      ...mockProvider,
      async generateImage() {
        throw new ProviderError('PROVIDER_UNAVAILABLE', { httpStatus: 503 });
      },
    });
    const bad = await make(user);
    registerProvider(mockProvider);

    const res = await as(admin).get(`/generations/${good}`);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toMatchObject({ id: good, status: 'done', mode: 'i2i', used_reference_image: true, composited_text: true, reference_roles: ['color'] });
    expect(d.user.id).toBe(user.id);
    expect(d.result_url).toContain('/files/');
    expect(d.timeline.map((e: { stage: string }) => e.stage)).toEqual(['analysis', 'compose', 'generate', 'composite']);
    for (const e of d.timeline) {
      expect(e).toMatchObject({ status: expect.stringMatching(/^(ok|degraded)$/) });
      expect(e.duration_ms).toBeGreaterThanOrEqual(0);
      expect(typeof e.cost_usd).toBe('number');
    }
    expect(d.timeline[2].model).toMatchObject({ name: expect.any(String) });
    expect(d.total_cost_usd).toBeGreaterThanOrEqual(0);

    const failure = (await as(admin).get(`/generations/${bad}`)).body.data;
    expect(failure.status).toBe('failed');
    expect(failure.error_code).toBe('PROVIDER_UNAVAILABLE');
    const failedStage = failure.timeline.find((e: { status: string }) => e.status === 'failed');
    expect(failedStage).toMatchObject({ stage: 'generate', error_code: 'PROVIDER_UNAVAILABLE' });
    expect(failedStage.error_message).toBe('Model provider is temporarily unavailable (HTTP 503)');
    expect(failure.result_url).toBeNull();

    for (const r of [res, await as(admin).get(`/generations/${bad}`)]) {
      const keys = collectKeys(r.body);
      for (const forbidden of ['slot_values', 'remarks', 'final_prompt_ciphertext', 'final_prompt', 'prompt', 'analysis', 'reference_inputs']) expect(keys.has(forbidden), forbidden).toBe(false);
      expect(r.text).not.toContain(REMARK);
      expect(r.text).not.toContain(SLOT);
      expect(r.text).not.toContain('[___]');
    }
    expect((await as(admin).get(`/generations/${uuid()}`)).status).toBe(404);
    expect((await as(admin).get('/generations/not-a-uuid')).status).toBe(400);
  });

  it('flags and unflags a generation with a note, and filters on it', async () => {
    const admin = await loginSeedAdmin();
    const user = await registerUser();
    const id = await make(user);
    const flagged = await as(admin).post(`/generations/${id}/flag`, { flagged: true, note: 'Perlu dicek manual' });
    expect(flagged.status).toBe(200);
    expect(flagged.body.data).toMatchObject({ flagged: true, flag_note: 'Perlu dicek manual' });
    expect(flagged.body.data.flagged_at).toBeTruthy();
    expect((await as(admin).get(`/generations?user=${user.id}&flagged=true`)).body.data.map((g: { id: string }) => g.id)).toEqual([id]);
    expect((await as(admin).get(`/generations?user=${user.id}&flagged=false`)).body.data).toHaveLength(0);

    const cleared = await as(admin).post(`/generations/${id}/flag`, { flagged: false });
    expect(cleared.body.data).toMatchObject({ flagged: false, flag_note: null, flagged_at: null });
    for (const bad of [{}, { flagged: 'yes' }, { flagged: true, note: 'x'.repeat(501) }, { flagged: true, extra: 1 }]) {
      expect((await as(admin).post(`/generations/${id}/flag`, bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await as(admin).post(`/generations/${uuid()}/flag`, { flagged: true })).status).toBe(404);
    const audit = await auditFor(id, 'generation.flag');
    expect(audit).toHaveLength(2);
    expectNoSecretsInAudit(audit);
    expect(JSON.stringify(audit)).not.toContain('Perlu dicek manual');
  });

  it('exports CSV with the same filters, no prompt columns, and neutralises formula injection', async () => {
    const admin = await loginSeedAdmin();
    const user = await registerUser();
    const evilName = `=HYPERLINK("http://evil.test","x"),+cmd|'/C calc'!A0 ${suffix()}`;
    const evil = (await as(admin).post('/models', { name: evilName, provider: 'mock', capability: 't2i', model_id: 'mock-t2i-evil', is_active: true })).body.data;
    const original = (await pool.query<{ id: string }>("SELECT id FROM model_configs WHERE capability = 't2i' AND is_default AND deleted_at IS NULL")).rows[0] as { id: string };
    await as(admin).post(`/models/${evil.id}/set-default`);
    let evilGen: string;
    try {
      evilGen = await make(user, 'poster-kegiatan-organisasi', { mode: 't2i' });
    } finally {
      await as(admin).post(`/models/${original.id}/set-default`);
    }
    const other = await make(user);
    await as(admin).post(`/generations/${other}/flag`, { flagged: true, note: `${REMARK} catatan` });

    const res = await as(admin).get(`/generations/export.csv?user=${user.id}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="generations-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(res.headers['cache-control']).toBe('no-store');
    const rows = parseCsv(res.text);
    const header = rows[0] as string[];
    expect(header).toEqual([
      'id', 'created_at', 'user_id', 'template_slug', 'mode', 'subject', 'publication', 'status', 'progress_step', 'error_code',
      'degraded', 'used_reference_image', 'reference_count_used', 'composited_text', 'total_cost_usd', 'duration_ms',
      'model_vision', 'model_image', 'flagged',
    ]);
    for (const col of header) expect(col).not.toMatch(/prompt|remark|slot|value|analysis|email/);
    const data = rows.slice(1).filter((r) => r.length > 1);
    expect(data).toHaveLength(2);
    expect(data.map((r) => r[0]).sort()).toEqual([evilGen, other].sort());
    expect(res.text).not.toContain(REMARK);
    expect(res.text).not.toContain(SLOT);

    // The hostile model name arrives as inert text: apostrophe-prefixed, quoted, quotes doubled.
    const evilRow = data.find((r) => r[0] === evilGen) as string[];
    expect(evilRow[header.indexOf('model_image')]).toBe(`'${evilName}`);
    for (const row of data) {
      for (const cell of row) expect(/^[=+\-@\t\r]/.test(cell), `cell "${cell}"`).toBe(false);
    }
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil.test"",""x""),+cmd|'/C calc'!A0 `);

    // Same filters as the list.
    const flaggedOnly = await as(admin).get(`/generations/export.csv?user=${user.id}&flagged=true`);
    expect(parseCsv(flaggedOnly.text).filter((r) => r.length > 1)).toHaveLength(2); // header + 1
    expect(parseCsv((await as(admin).get(`/generations/export.csv?user=${user.id}&status=failed`)).text).filter((r) => r.length > 1)).toHaveLength(1); // header only
    expect((await as(admin).get('/generations/export.csv?status=nope')).status).toBe(400);
    expect((await as(admin).get('/generations/export.csv?from=2026-13-01')).status).toBe(400);
    const audit = await auditFor(null, 'generation.export');
    expect(audit.length).toBeGreaterThanOrEqual(3);
    expect(audit.some((a) => a.diff.rows === 2)).toBe(true);
    expectNoSecretsInAudit(audit);
  });
});
