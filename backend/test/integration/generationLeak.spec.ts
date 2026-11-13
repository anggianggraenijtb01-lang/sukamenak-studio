import { afterEach, describe, expect, it, vi } from 'vitest';
import { decryptWithCoreKey, finalPromptAad } from '../../src/lib/coreCipher.js';
import { mockProvider } from '../../src/providers/mock.js';
import { registerProvider } from '../../src/providers/registry.js';
import { SEED_CORE_PROMPTS } from '../../src/seed/data/corePrompts.js';
import { api, bearer, pool, registerUser, useDatabase, DEMO_EMAIL, DEMO_PASSWORD, login } from '../helpers/api.js';
import { createReferenceId, download, eventsOf, postGeneration, settle } from '../helpers/pipeline.js';
import { testEnv } from '../helpers/testEnv.js';

// Every log line written by the app during this file is captured at trace level.
const captured = vi.hoisted(() => ({ lines: [] as string[] }));
vi.mock('../../src/lib/logger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/logger.js')>();
  const sink = { write: (chunk: string) => void captured.lines.push(chunk) };
  return { ...actual, logger: actual.createLogger(sink as never, 'trace') };
});

useDatabase();

const REMARK_MARKER = 'ZZREMARKMARKERZZ';

/** Fragments of the secret core prompts that must never appear in any output (placeholders removed). */
function coreFragments(): string[] {
  const out = new Set<string>();
  for (const core of SEED_CORE_PROMPTS) {
    for (const piece of core.body.split(/\[___\]|\{\{[^}]*\}\}/)) {
      const t = piece.trim().replace(/^[.,:;\s]+|[.,:;\s]+$/g, '');
      if (t.length >= 14) out.add(t);
    }
  }
  return [...out];
}

const FORBIDDEN_TOKENS = ['[___]', '{{', 'final_prompt', 'ciphertext', 'auth_tag', 'body_iv', 'body_ciphertext'];

function assertClean(haystack: string, label: string, extraSecrets: string[] = []): void {
  for (const token of FORBIDDEN_TOKENS) expect(haystack.includes(token), `${label} contains ${token}`).toBe(false);
  for (const fragment of [...coreFragments(), ...extraSecrets]) {
    expect(haystack.includes(fragment), `${label} contains secret fragment "${fragment.slice(0, 40)}..."`).toBe(false);
    const escaped = JSON.stringify(fragment).slice(1, -1);
    expect(haystack.includes(escaped), `${label} contains escaped secret fragment "${fragment.slice(0, 40)}..."`).toBe(false);
  }
}

async function finalPromptLines(id: string): Promise<string[]> {
  const row = (await pool.query<{ c: Buffer; i: Buffer; t: Buffer }>(
    'SELECT final_prompt_ciphertext AS c, final_prompt_iv AS i, final_prompt_auth_tag AS t FROM generations WHERE id = $1',
    [id],
  )).rows[0];
  const prompt = decryptWithCoreKey({ ciphertext: row!.c, iv: row!.i, authTag: row!.t }, finalPromptAad(id));
  return prompt.split('\n').map((l) => l.trim()).filter((l) => l.length >= 20);
}

afterEach(() => {
  registerProvider(mockProvider);
});

describe('prompt-leak checks for the generation pipeline', () => {
  it('no response, log line or stored event exposes the core prompt, the final prompt or ciphertext', async () => {
    const user = await registerUser();
    const demo = await login(DEMO_EMAIL, DEMO_PASSWORD);
    const ref1 = await createReferenceId(user, 'product', '#c04010');
    const ref2 = await createReferenceId(user, 'lighting', '#f0e0a0');

    const bodies: [string, string][] = [];
    const record = (label: string, res: { text: string }) => bodies.push([label, res.text]);

    const created = await postGeneration(user, {
      template_slug: 'poster-promo-produk',
      reference_ids: [ref1, ref2],
      slot_values: { title: 'Promo Keripik', cta: 'Pesan sekarang', product: 'keripik tempe' },
      remarks: `${REMARK_MARKER} cahaya hangat`,
    });
    expect(created.status).toBe(202);
    record('POST /generations', created);
    const id = created.body.data.id as string;
    await settle(user, id);

    // A second run that fails, and one that throws an unexpected error carrying prompt-like text.
    registerProvider({
      ...mockProvider,
      async generateImage() {
        throw new Error(`boom with ${coreFragments()[0]} and ${(await finalPromptLines(id))[0]}`);
      },
    });
    const crashed = await postGeneration(user, { template_slug: 'poster-kegiatan-organisasi', slot_values: { title: 'Bazar', date_venue: 'Balai Desa' } });
    const crashedId = crashed.body.data.id as string;
    const crashedState = await settle(user, crashedId);
    expect(crashedState).toMatchObject({ status: 'failed', error_code: 'INTERNAL_ERROR' });
    registerProvider(mockProvider);

    const secrets = [...(await finalPromptLines(id)), ...(await finalPromptLines(crashedId))];
    expect(secrets.length).toBeGreaterThan(3);

    // Endpoints a creator can reach.
    record('GET /generations/:id', await api().get(`/api/v1/generations/${id}`).set(bearer(user.accessToken)));
    record('GET /generations/:id (failed)', await api().get(`/api/v1/generations/${crashedId}`).set(bearer(user.accessToken)));
    record('GET /generations', await api().get('/api/v1/generations?archived=all').set(bearer(user.accessToken)));
    record('POST /generations/:id/archive', await api().post(`/api/v1/generations/${id}/archive`).set(bearer(user.accessToken)));
    record('GET /references/mine', await api().get('/api/v1/references/mine').set(bearer(user.accessToken)));
    record('GET /references/library', await api().get('/api/v1/references/library').set(bearer(user.accessToken)));
    record('GET /templates', await api().get('/api/v1/templates'));
    for (const t of (await api().get('/api/v1/templates')).body.data as { slug: string }[]) {
      record(`GET /templates/${t.slug}`, await api().get(`/api/v1/templates/${t.slug}`));
    }
    record('GET /gallery', await api().get('/api/v1/gallery?limit=50'));
    record('GET /me', await api().get('/api/v1/me').set(bearer(user.accessToken)));
    record('GET /me/export', await api().get('/api/v1/me/export').set(bearer(user.accessToken)));
    record('GET /me (demo)', await api().get('/api/v1/me').set(bearer(demo.accessToken)));
    // Error responses.
    record('policy violation', await postGeneration(user, { template_slug: 'poster-kegiatan-organisasi', slot_values: { title: 'judi online', date_venue: 'x' } }));
    record('validation error', await postGeneration(user, { template_slug: 'poster-promo-produk', slot_values: {} }));
    record('404', await api().get('/api/v1/generations/0e5c0f2e-1111-4111-8111-111111111111').set(bearer(user.accessToken)));

    for (const [label, text] of bodies) assertClean(text, label, secrets);

    // The result image file is clean too: it is a PNG without text chunks carrying the prompt.
    const g = (await api().get(`/api/v1/generations/${id}`).set(bearer(user.accessToken))).body.data;
    const file = await download(g.result_url);
    for (const s of secrets.slice(0, 5)) expect(file.body.includes(Buffer.from(s))).toBe(false);

    // Stored stage events carry sanitised messages only.
    for (const gid of [id, crashedId]) {
      for (const e of await eventsOf(gid)) assertClean(`${e.error_code ?? ''} ${e.error_message ?? ''}`, `event ${gid}/${e.stage}`, secrets);
    }
    const failedEvent = (await eventsOf(crashedId)).find((e) => e.status === 'failed')!;
    expect(failedEvent.error_message).toBe('Terjadi kesalahan internal saat memproses gambar');

    // Logs: the run produced real pipeline log lines, and none of them contains a secret.
    const logText = captured.lines.join('\n');
    expect(captured.lines.length).toBeGreaterThan(5);
    expect(logText).toContain('generation stage finished');
    expect(logText).toContain('generation failed unexpectedly');
    assertClean(logText, 'logs', secrets);
    // Creator free text and key material stay out of the logs as well.
    expect(logText).not.toContain(REMARK_MARKER);
    expect(logText).not.toContain('Promo Keripik');
    expect(logText).not.toContain(testEnv.CORE_PROMPT_KEY as string);
    expect(logText).not.toContain(testEnv.JWT_ACCESS_SECRET as string);
    expect(logText).not.toMatch(/token=\d+\./);
    expect(logText).not.toContain(user.accessToken);
  });

  it('the remark the creator typed is returned only to the owner', async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const created = await postGeneration(owner, {
      template_slug: 'poster-kegiatan-organisasi',
      slot_values: { title: 'Bazar', date_venue: 'Balai Desa' },
      remarks: `${REMARK_MARKER} untuk bazar`,
    });
    const id = created.body.data.id as string;
    await settle(owner, id);
    expect((await api().get(`/api/v1/generations/${id}`).set(bearer(owner.accessToken))).text).toContain(REMARK_MARKER);
    expect((await api().get('/api/v1/generations').set(bearer(other.accessToken))).text).not.toContain(REMARK_MARKER);
    expect((await api().get('/api/v1/gallery').set(bearer(other.accessToken))).text).not.toContain(REMARK_MARKER);
  });
});
