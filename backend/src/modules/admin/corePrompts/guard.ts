import { query } from '../../../db/pool.js';
import { BLANK_TOKEN } from '../../../engine/placeholders.js';
import { corePromptAad, decryptWithCoreKey } from '../../../lib/coreCipher.js';

const WINDOW = 20;

const normalise = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim();

/** Static pieces of a core prompt: the text between blanks and named placeholders. */
function staticPieces(body: string): string[] {
  return body
    .split(BLANK_TOKEN)
    .flatMap((part) => part.split(/\{\{[^{}]*\}\}/))
    .map(normalise)
    .filter((p) => p.length >= WINDOW);
}

/** Every `WINDOW`-character window of every active core prompt, for substring leak checks. */
async function loadWindows(): Promise<Set<string>> {
  const rows = await query<{ key: string; version: number; body_ciphertext: Buffer; body_iv: Buffer; body_auth_tag: Buffer }>(
    'SELECT key, version, body_ciphertext, body_iv, body_auth_tag FROM core_prompts WHERE is_active',
  );
  const windows = new Set<string>();
  for (const row of rows) {
    let body: string;
    try {
      body = decryptWithCoreKey(
        { ciphertext: row.body_ciphertext, iv: row.body_iv, authTag: row.body_auth_tag },
        corePromptAad(row.key, row.version),
      );
    } catch {
      continue;
    }
    for (const piece of staticPieces(body)) {
      for (let i = 0; i + WINDOW <= piece.length; i++) windows.add(piece.slice(i, i + WINDOW));
    }
  }
  return windows;
}

/**
 * True when `text` contains any 20-character contiguous run of an active core prompt. Used to stop an
 * admin from pasting core prompt text into a field that is shown publicly (gallery titles and prompts).
 */
export async function containsCorePromptText(...texts: (string | null | undefined)[]): Promise<boolean> {
  const candidates = texts.filter((t): t is string => typeof t === 'string' && t.length >= WINDOW).map(normalise);
  if (candidates.length === 0) return false;
  const windows = await loadWindows();
  return candidates.some((text) => {
    for (let i = 0; i + WINDOW <= text.length; i++) if (windows.has(text.slice(i, i + WINDOW))) return true;
    return false;
  });
}
