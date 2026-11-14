import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ApiError,
  CLIENT_ERROR_CODES,
  ERROR_CODES,
  ERROR_MESSAGES,
  GENERIC_ERROR_MESSAGE,
  SERVER_ERROR_CODES,
  generationErrorMessage,
  getErrorMessage,
  messageForCode,
} from './errors';

describe('error messages', () => {
  it('maps every known code to a non-empty Indonesian message', () => {
    for (const code of ERROR_CODES) {
      const message = ERROR_MESSAGES[code];
      expect(message, code).toBeTruthy();
      expect(message.length, code).toBeGreaterThan(10);
    }
    // No message without a code and no duplicate codes.
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual([...ERROR_CODES].sort());
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it('keeps client-only codes out of the server list', () => {
    for (const c of CLIENT_ERROR_CODES) expect((SERVER_ERROR_CODES as readonly string[]).includes(c)).toBe(false);
  });

  it('covers every error_code written in backend/docs/API.md (skipped when the docs are not checked out)', () => {
    const docs = path.resolve(__dirname, '../../../backend/docs/API.md');
    if (!existsSync(docs)) return;
    const text = readFileSync(docs, 'utf8');

    // 1.3 table rows: | `CODE` | 400 | ...
    const tableCodes = [...text.matchAll(/^\|\s*`([A-Z_]+)`\s*\|\s*\d{3}\s*\|/gm)].map((m) => m[1]);
    // "... also include `A`, `B` and `C`." (stored generation failure codes)
    const storedBlock = /also include([\s\S]*?)\.\r?\n/.exec(text)?.[1] ?? '';
    const storedCodes = [...storedBlock.matchAll(/`([A-Z_]+)`/g)].map((m) => m[1]);
    // 3.10 recap of the admin errors
    const recapBlock = /### 3\.10[\s\S]*?(?=\r?\n###)/.exec(text)?.[0] ?? '';
    const recapCodes = [...recapBlock.matchAll(/`([A-Z_]{4,})`/g)].map((m) => m[1]);

    const documented = new Set([...tableCodes, ...storedCodes, ...recapCodes]);
    expect(documented.size).toBeGreaterThan(25); // the parsing itself found the lists
    const missing = [...documented].filter((c) => !(ERROR_CODES as readonly string[]).includes(c));
    expect(missing).toEqual([]);
  });

  it('gives the DAILY_LIMIT_REACHED message the product copy', () => {
    expect(ERROR_MESSAGES.DAILY_LIMIT_REACHED).toBe('Batas harian tercapai. Hubungi admin.');
  });
});

describe('messageForCode', () => {
  it('never shows server text for 5xx, even for unknown codes', () => {
    const err = new ApiError({ status: 500, code: 'SOMETHING_NEW', serverMessage: 'SELECT * FROM users failed at pg.js:12' });
    expect(err.message).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    expect(err.message).not.toContain('SELECT');
    expect(err.serverMessage).toContain('SELECT'); // kept for debugging only
  });

  it('falls back by status for unknown codes', () => {
    expect(messageForCode('NEW_CODE', 404)).toBe(ERROR_MESSAGES.NOT_FOUND);
    expect(messageForCode('NEW_CODE', 403)).toBe(ERROR_MESSAGES.FORBIDDEN);
    expect(messageForCode('NEW_CODE', 429)).toBe(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
    expect(messageForCode('NEW_CODE', 502)).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    expect(messageForCode('NEW_CODE', 418)).toBe(GENERIC_ERROR_MESSAGE);
    expect(messageForCode(null, 0)).toBe(GENERIC_ERROR_MESSAGE);
  });

  it('distinguishes NO_MODEL_AVAILABLE 409 (admin action) from 503 (generation time)', () => {
    expect(messageForCode('NO_MODEL_AVAILABLE', 503)).toBe(ERROR_MESSAGES.NO_MODEL_AVAILABLE);
    expect(messageForCode('NO_MODEL_AVAILABLE', 409)).not.toBe(ERROR_MESSAGES.NO_MODEL_AVAILABLE);
  });

  it('describes stored generation failures', () => {
    expect(generationErrorMessage('PROVIDER_TIMEOUT')).toBe(ERROR_MESSAGES.PROVIDER_TIMEOUT);
    expect(generationErrorMessage(null)).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
  });
});

describe('ApiError', () => {
  it('exposes status, code, message and field errors', () => {
    const err = new ApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: [
        { field: 'email', message: 'Email tidak valid' },
        { field: 'email', message: 'second one is ignored' },
        { field: 'slot_values.title', message: 'Wajib diisi' },
      ],
    });
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe(ERROR_MESSAGES.VALIDATION_ERROR);
    expect(err.fieldErrors).toEqual({ email: 'Email tidak valid', 'slot_values.title': 'Wajib diisi' });
    expect(getErrorMessage(err)).toBe(err.message);
    expect(getErrorMessage(new Error('boom'))).toBe(GENERIC_ERROR_MESSAGE);
  });
});
