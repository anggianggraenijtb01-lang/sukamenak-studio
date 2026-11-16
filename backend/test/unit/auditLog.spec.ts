import { describe, expect, it } from 'vitest';
import { buildDiff, scrubDiff } from '../../src/modules/admin/auditLog.js';

describe('buildDiff', () => {
  it('lists only allowlisted fields whose value changed', () => {
    const diff = buildDiff(['name', 'role', 'is_active'], { name: 'A', role: 'creator', is_active: true, password_hash: 'x' }, { name: 'B', role: 'creator', is_active: false, password_hash: 'y' });
    expect(diff).toEqual({ changed: { name: { from: 'A', to: 'B' }, is_active: { from: true, to: false } } });
  });

  it('never reads fields outside the allowlist, even when they hold secrets', () => {
    const diff = buildDiff(['name'], null, { name: 'New', password_hash: '$2b$12$abc', body_ciphertext: Buffer.from('aa'), api_key: 'sk-1' });
    expect(JSON.stringify(diff)).toBe('{"changed":{"name":{"from":null,"to":"New"}}}');
  });

  it('records creation as from: null and keeps non-secret context', () => {
    expect(buildDiff(['slug'], null, { slug: 'a' }, { source: 'upload' })).toEqual({ source: 'upload', changed: { slug: { from: null, to: 'a' } } });
  });

  it('truncates long strings and serialises dates', () => {
    const diff = buildDiff(['note', 'at'], {}, { note: 'x'.repeat(500), at: new Date('2026-01-01T00:00:00Z') }) as { changed: { note: { to: string }; at: { to: string } } };
    expect(diff.changed.note.to.length).toBeLessThan(250);
    expect(diff.changed.at.to).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('scrubDiff', () => {
  it('drops secret-looking keys at any depth, even if a caller passes them', () => {
    const dirty = {
      password: 'p', password_hash: 'h', new_password: 'n', refresh_token: 't', access_token: 'a', token_hash: 'th', secret: 's',
      body: 'core prompt', body_ciphertext: 'c', body_iv: 'i', body_auth_tag: 'g', final_prompt: 'f', final_prompt_ciphertext: 'x', api_key: 'k', apiKey: 'k2',
      authorization: 'Bearer x', cookie: 'c', iv: 'iv',
      nested: { cipher: 'z', ok: 1, list: [{ auth_tag: 'q', keep: 'yes' }] },
      keep: 'visible',
      api_key_env: 'GEMINI_API_KEY',
    };
    expect(scrubDiff(dirty)).toEqual({ nested: { ok: 1, list: [{ keep: 'yes' }] }, keep: 'visible', api_key_env: 'GEMINI_API_KEY' });
  });

  it('handles non-objects and caps depth', () => {
    expect(scrubDiff(null)).toEqual({});
    expect(scrubDiff('text')).toEqual({});
    expect(scrubDiff([1, 2])).toEqual({});
    const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    expect(JSON.stringify(scrubDiff(deep))).toContain('[truncated]');
  });
});
