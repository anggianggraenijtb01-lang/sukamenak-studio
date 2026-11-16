import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_CORE_PROMPT_MARKER } from '../../src/engine/placeholderCorePrompt.js';
import { SEED_CORE_PROMPTS } from '../../src/seed/data/corePrompts.js';
import { collectKeys } from '../helpers/api.js';
import { as, coreBody, loginSeedAdmin, suffix, useSeededDatabase } from '../helpers/admin.js';

useSeededDatabase();

const SEED_KEYS = SEED_CORE_PROMPTS.map((c) => c.key).sort();
const POSTER_BLANKS = SEED_CORE_PROMPTS.find((c) => c.key === 'product.poster')?.blankKeys.length as number;
type Admin = Awaited<ReturnType<typeof loginSeedAdmin>>;

const createPoster = (admin: Admin, body: string) =>
  as(admin).post('/core-prompts', { key: 'product.poster', subject: 'product', publication: 'poster', body });

const dashboardPrompts = async (admin: Admin) => (await as(admin).get('/dashboard?days=1')).body.data.core_prompts as { active_count: number; placeholder_active_keys: string[] };

describe('admin can tell whether a core prompt is still a stand-in', () => {
  it('flags every seeded, active prompt as a stand-in', async () => {
    const admin = await loginSeedAdmin();
    const res = await as(admin).get('/core-prompts?active=true&limit=100');
    expect(res.status).toBe(200);
    const seeded = (res.body.data as Array<{ key: string; is_active: boolean; is_placeholder: boolean }>).filter((p) => SEED_KEYS.includes(p.key));
    expect(seeded.map((p) => p.key).sort()).toEqual(SEED_KEYS);
    for (const p of seeded) expect(p, p.key).toMatchObject({ is_active: true, is_placeholder: true });
  });

  it('marks a real prompt as not a stand-in, and a stand-in body as one, whoever submits it', async () => {
    const admin = await loginSeedAdmin();
    const real = await createPoster(admin, coreBody(POSTER_BLANKS, `REAL${suffix()}`));
    expect(real.status).toBe(201);
    expect(real.body.data).toMatchObject({ is_active: false, is_placeholder: false });

    const standIn = await createPoster(admin, `${PLACEHOLDER_CORE_PROMPT_MARKER} resubmitted. ${coreBody(POSTER_BLANKS)}`);
    expect(standIn.status).toBe(201);
    expect(standIn.body.data).toMatchObject({ is_placeholder: true });

    const versions = await as(admin).get('/core-prompts/versions?key=product.poster');
    const flags = (versions.body.data as Array<{ id: string; is_placeholder: boolean }>).map((v) => [v.id, v.is_placeholder]);
    expect(flags).toEqual(expect.arrayContaining([[real.body.data.id, false], [standIn.body.data.id, true]]));
  });

  it('the dashboard lists the active stand-ins and drops a key once its real prompt is activated', async () => {
    const admin = await loginSeedAdmin();
    expect(await dashboardPrompts(admin)).toEqual({ active_count: SEED_KEYS.length, placeholder_active_keys: SEED_KEYS });

    const real = await createPoster(admin, coreBody(POSTER_BLANKS, `REAL${suffix()}`));
    expect((await as(admin).post(`/core-prompts/${real.body.data.id}/activate`)).status).toBe(200);
    const afterReal = await dashboardPrompts(admin);
    expect(afterReal.active_count).toBe(SEED_KEYS.length);
    expect(afterReal.placeholder_active_keys).toEqual(SEED_KEYS.filter((k) => k !== 'product.poster'));

    // Activating a stand-in version again puts the key back on the list.
    const standIn = await createPoster(admin, `${PLACEHOLDER_CORE_PROMPT_MARKER} again. ${coreBody(POSTER_BLANKS)}`);
    expect((await as(admin).post(`/core-prompts/${standIn.body.data.id}/activate`)).status).toBe(200);
    expect((await dashboardPrompts(admin)).placeholder_active_keys).toEqual(SEED_KEYS);
  });

  it('answers with a flag only: no body, marker or ciphertext in the list, the versions or the dashboard', async () => {
    const admin = await loginSeedAdmin();
    const responses = [
      await as(admin).get('/core-prompts?limit=100'),
      await as(admin).get('/core-prompts/versions?key=product.poster'),
      await as(admin).get('/dashboard?days=1'),
    ];
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.text).not.toContain(PLACEHOLDER_CORE_PROMPT_MARKER);
      const keys = collectKeys(res.body);
      for (const forbidden of ['body', 'body_ciphertext', 'body_iv', 'body_auth_tag', 'ciphertext', 'auth_tag', 'prompt', 'final_prompt']) {
        expect(keys.has(forbidden), forbidden).toBe(false);
      }
    }
  });
});
