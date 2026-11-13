import { SEED_CORE_PROMPTS } from '../../src/seed/data/corePrompts.js';

export const AES_KEY_MARKER = 'SUKAMENAK-STUDIO-AES256-GCM-KEY';

/** The mock "core prompt" that still ships inside frontend/src/services/aesEncryption.ts (Phase D removes it). */
export const FRONTEND_MOCK_PROMPT_LINES = [
  'You are Sukamenak Studio Visual Engine v2.4.',
  'Compose an ultra-clean commercial graphic for',
  'Apply lighting & composition extracted from Vision Profile:',
  'Maintain authentic local Indonesian UMKM / RW 15 Desa Sukamenak identity',
];

/** Tokens that must not appear in ANY response, whatever the endpoint. */
export const FORBIDDEN_TOKENS = ['[___]', '{{', 'body_ciphertext', 'body_iv', 'body_auth_tag', 'final_prompt', 'auth_tag'] as const;

export const WINDOW = 20;
/** Source and bundle scans use a longer run: UI copy shares short generic phrases ("commercial product") with prompts. */
export const BUNDLE_WINDOW = 40;

/** Lines of a prompt that are long enough to be a meaningful fragment. */
export function fragmentsOf(text: string, size: number = WINDOW): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= size);
}

/** All contiguous WINDOW-character substrings of every fragment, in raw and JSON-escaped form. */
export function windowsOf(texts: readonly string[], size: number = WINDOW): Set<string> {
  const windows = new Set<string>();
  for (const text of texts) {
    for (const fragment of fragmentsOf(text, size)) {
      for (const variant of new Set([fragment, JSON.stringify(fragment).slice(1, -1)])) {
        for (let i = 0; i + size <= variant.length; i++) windows.add(variant.slice(i, i + size));
      }
    }
  }
  return windows;
}

/** The first leaked window found in `haystack`, or null. */
export function findWindow(haystack: string, windows: ReadonlySet<string>, size: number = WINDOW): string | null {
  for (let i = 0; i + size <= haystack.length; i++) {
    const w = haystack.slice(i, i + size);
    if (windows.has(w)) return w;
  }
  return null;
}

/** Textual encodings a binary secret could leak as (hex, base64, base64url, Postgres bytea hex). */
export function encodingsOf(buf: Buffer): string[] {
  if (buf.length < 12) return [];
  return [buf.toString('hex'), `\\x${buf.toString('hex')}`, buf.toString('base64'), buf.toString('base64url')];
}

export const seededCoreBodies = (): string[] => SEED_CORE_PROMPTS.map((c) => c.body);

export interface LeakCorpus {
  windows: Set<string>;
  /** Encoded ciphertext / iv / tag values and other literal secrets. */
  literals: string[];
}

export function leakProblems(text: string, corpus: LeakCorpus): string[] {
  const problems: string[] = [];
  for (const token of FORBIDDEN_TOKENS) if (text.includes(token)) problems.push(`forbidden token ${JSON.stringify(token)}`);
  const hit = findWindow(text, corpus.windows);
  if (hit) problems.push(`core/final prompt fragment ${JSON.stringify(hit)}`);
  for (const literal of corpus.literals) if (text.includes(literal)) problems.push(`secret literal ${literal.slice(0, 12)}...`);
  return problems;
}
