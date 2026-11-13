import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export class DecryptionError extends Error {
  constructor() {
    super('Unable to decrypt payload');
    this.name = 'DecryptionError';
  }
}

export function parseKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes (base64-encoded)');
  return key;
}

/**
 * AES-256-GCM encryption with a fresh random 96-bit IV per call. `aad` binds the ciphertext
 * to its row (for example `core_prompt:<key>:v<version>`) so payloads cannot be swapped
 * between rows without detection.
 */
export function encryptSecret(plaintext: string, key: Buffer, aad?: string): EncryptedPayload {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

/** Throws DecryptionError (never leaks details) when the payload, key or aad is wrong or tampered. */
export function decryptSecret(payload: EncryptedPayload, key: Buffer, aad?: string): string {
  try {
    const decipher = createDecipheriv(ALGORITHM, key, payload.iv, { authTagLength: TAG_BYTES });
    if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(payload.authTag);
    return Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new DecryptionError();
  }
}

export const sha256Hex = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
