import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger, redactDeep } from '../../src/lib/logger.js';

function capture(): { lines: () => string; dest: Writable } {
  const chunks: string[] = [];
  const dest = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  return { lines: () => chunks.join(''), dest };
}

describe('logger redaction', () => {
  it('redacts sensitive keys at any depth, by name substring', () => {
    const out = redactDeep({
      password: 'hunter2',
      user: { email: 'a@b.c', token: 'tok', nested: { final_prompt: 'secret prompt', body_ciphertext: Buffer.from('xx') } },
      displayPrompt: 'x',
      Authorization: 'Bearer abc',
      list: [{ api_key: 'k' }, { ok: 1 }],
    }) as Record<string, unknown>;
    const json = JSON.stringify(out);
    for (const secret of ['hunter2', 'tok"', 'secret prompt', 'Bearer abc', '"k"']) {
      expect(json).not.toContain(secret);
    }
    expect(json).toContain('a@b.c');
    expect(json).toContain('"ok":1');
  });

  it('keeps secrets out of emitted log lines', () => {
    const { lines, dest } = capture();
    const log = createLogger(dest, 'info');
    log.info(
      {
        password: 'p@ssw0rd-LEAK',
        req: { headers: { authorization: 'Bearer LEAK-TOKEN', cookie: 'refresh_token=LEAK-COOKIE' } },
        row: { body_ciphertext: 'LEAK-CIPHER', final_prompt_ciphertext: 'LEAK-CIPHER2', core_prompt: 'LEAK-CORE' },
        safe: 'visible',
      },
      'event',
    );
    const out = lines();
    expect(out).toContain('visible');
    expect(out).not.toMatch(/LEAK/);
  });

  it('truncates absurd nesting instead of recursing forever', () => {
    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let i = 0; i < 20; i++) {
      const next: Record<string, unknown> = {};
      cursor.a = next;
      cursor = next;
    }
    expect(() => redactDeep(deep)).not.toThrow();
  });
});
