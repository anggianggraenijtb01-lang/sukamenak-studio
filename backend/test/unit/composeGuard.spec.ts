import { beforeEach, describe, expect, it, vi } from 'vitest';

// Production NODE_ENV and a fake database: this proves runCompose really calls the guard, without a real database.
const db = vi.hoisted(() => ({ queryOne: vi.fn(), query: vi.fn() }));
vi.mock('../../src/db/pool.js', () => ({ queryOne: db.queryOne, query: db.query }));
vi.mock('../../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config/env.js')>();
  return { ...actual, env: { ...actual.env, NODE_ENV: 'production' } };
});

import { corePromptAad, encryptWithCoreKey } from '../../src/lib/coreCipher.js';
import { AppError } from '../../src/lib/errors.js';
import { runCompose } from '../../src/pipeline/stages/compose.js';
import { SEED_CORE_PROMPTS } from '../../src/seed/data/corePrompts.js';
import type { PipelineContext } from '../../src/pipeline/context.js';

const core = SEED_CORE_PROMPTS[0] as NonNullable<(typeof SEED_CORE_PROMPTS)[number]>;
const ctx = { template: { core_prompt_key: core.key }, gen: { id: 'gen-1' } } as unknown as PipelineContext;

function activeRow(body: string) {
  const enc = encryptWithCoreKey(body, corePromptAad(core.key, 1));
  return { version: 1, body_ciphertext: enc.ciphertext, body_iv: enc.iv, body_auth_tag: enc.authTag };
}

beforeEach(() => {
  db.queryOne.mockReset();
  db.query.mockReset();
});

describe('runCompose in production', () => {
  it('refuses a stand-in core prompt and writes nothing', async () => {
    db.queryOne.mockResolvedValue(activeRow(core.body));
    const failure = await runCompose(ctx, {}).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).code).toBe('CORE_PROMPT_REQUIRED');
    expect(db.query).not.toHaveBeenCalled();
  });
});
