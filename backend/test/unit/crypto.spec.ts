import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DecryptionError, decryptSecret, encryptSecret, parseKey, randomToken, safeEqual, sha256Hex } from '../../src/lib/crypto.js';

const key = randomBytes(32);
const SECRET = 'Create a professional poster of [___] with {{subject_lock}}';

describe('AES-256-GCM helpers', () => {
  it('round-trips plaintext, including unicode', () => {
    const text = `${SECRET} - kemasan higienis, cahaya hangat`;
    const enc = encryptSecret(text, key);
    expect(decryptSecret(enc, key)).toBe(text);
  });

  it('does not leak plaintext in the ciphertext and uses a fresh iv every time', () => {
    const a = encryptSecret(SECRET, key);
    const b = encryptSecret(SECRET, key);
    expect(a.ciphertext.toString('utf8')).not.toContain('professional poster');
    expect(a.iv).toHaveLength(12);
    expect(a.authTag).toHaveLength(16);
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it('detects a tampered ciphertext', () => {
    const enc = encryptSecret(SECRET, key);
    const tampered = Buffer.from(enc.ciphertext);
    tampered.writeUInt8(tampered.readUInt8(0) ^ 0xff, 0);
    expect(() => decryptSecret({ ...enc, ciphertext: tampered }, key)).toThrow(DecryptionError);
  });

  it('detects a tampered auth tag and iv', () => {
    const enc = encryptSecret(SECRET, key);
    const badTag = Buffer.from(enc.authTag);
    badTag.writeUInt8(badTag.readUInt8(0) ^ 0x01, 0);
    expect(() => decryptSecret({ ...enc, authTag: badTag }, key)).toThrow(DecryptionError);
    const badIv = Buffer.from(enc.iv);
    badIv.writeUInt8(badIv.readUInt8(0) ^ 0x01, 0);
    expect(() => decryptSecret({ ...enc, iv: badIv }, key)).toThrow(DecryptionError);
  });

  it('fails with the wrong key and never reveals why', () => {
    const enc = encryptSecret(SECRET, key);
    try {
      decryptSecret(enc, randomBytes(32));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DecryptionError);
      expect((err as Error).message).not.toContain('professional');
    }
  });

  it('binds ciphertext to its AAD so rows cannot be swapped', () => {
    const enc = encryptSecret(SECRET, key, 'core_prompt:product.poster:v1');
    expect(decryptSecret(enc, key, 'core_prompt:product.poster:v1')).toBe(SECRET);
    expect(() => decryptSecret(enc, key, 'core_prompt:product.psa:v1')).toThrow(DecryptionError);
    expect(() => decryptSecret(enc, key)).toThrow(DecryptionError);
  });

  it('parseKey accepts only 32 bytes', () => {
    expect(parseKey(key.toString('base64'))).toHaveLength(32);
    expect(() => parseKey(randomBytes(16).toString('base64'))).toThrow();
    expect(() => parseKey('not base64 at all !!!')).toThrow();
  });

  it('hash and token helpers behave', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(randomToken()).not.toBe(randomToken());
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
