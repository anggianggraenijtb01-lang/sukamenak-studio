import { AppError } from '../lib/errors.js';

/**
 * Words that must never reach the image model: it would try to render them as glyphs.
 * Text is applied afterwards by the application, never by the model (PRD section 5 rule 5).
 */
export const FORBIDDEN_PROMPT_WORDS = [
  'text',
  'texts',
  'typography',
  'typographic',
  'headline',
  'headlines',
  'caption',
  'captions',
  'font',
  'fonts',
  'typeface',
  'typefaces',
  'lettering',
  'teks',
  'tipografi',
] as const;

const FORBIDDEN_PATTERN = new RegExp(`\\b(?:${FORBIDDEN_PROMPT_WORDS.join('|')})\\b`, 'gi');

export const containsForbiddenWords = (value: string): boolean => {
  FORBIDDEN_PATTERN.lastIndex = 0;
  return FORBIDDEN_PATTERN.test(value);
};

/** Removes forbidden words (whole words, case-insensitive) and tidies the whitespace they leave behind. */
export const stripForbiddenWords = (value: string): string =>
  value
    .replace(FORBIDDEN_PATTERN, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/** Lower-cases, removes diacritics and collapses everything that is not a letter or digit to one space. */
export function normalizeForMatch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Blocked terms found in `texts` (whole-word match on normalised text). Returns the matched terms. */
export function findBlockedTerms(texts: readonly string[], blockedTerms: readonly string[]): string[] {
  const haystack = ` ${texts.map(normalizeForMatch).join(' ')} `;
  const hits: string[] = [];
  for (const term of blockedTerms) {
    const needle = normalizeForMatch(term);
    if (needle && haystack.includes(` ${needle} `) && !hits.includes(term)) hits.push(term);
  }
  return hits;
}

/**
 * Throws CONTENT_POLICY_VIOLATION naming only the offending FIELDS. The matched term is never
 * echoed back, so the blocklist cannot be probed out of error messages.
 */
export function assertContentPolicy(
  fields: Record<string, string | null | undefined>,
  blockedTerms: readonly string[],
): void {
  if (blockedTerms.length === 0) return;
  const offending = Object.entries(fields)
    .filter(([, value]) => typeof value === 'string' && value !== '' && findBlockedTerms([value], blockedTerms).length > 0)
    .map(([field]) => field);
  if (offending.length > 0) {
    throw new AppError('CONTENT_POLICY_VIOLATION', 'Konten melanggar kebijakan penggunaan', {
      errors: offending.map((field) => ({ field, message: 'Mengandung istilah yang tidak diizinkan' })),
    });
  }
}

/** Removes blocked terms (whole-word, case/diacritic-insensitive) from free text. */
export function stripBlockedTerms(value: string, blockedTerms: readonly string[]): string {
  let result = value;
  for (const term of blockedTerms) {
    const trimmed = term.trim();
    if (!trimmed) continue;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    result = result.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu'), ' ');
  }
  return result.replace(/\s+/g, ' ').trim();
}
