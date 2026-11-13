/** Token a core prompt uses for a slot-filled gap. Same token the admin UI documents. */
export const BLANK_TOKEN = '[___]';

/** Named placeholders a core prompt may contain. Anything else is rejected with UNKNOWN_PLACEHOLDER. */
export const NAMED_PLACEHOLDERS = ['subject_lock', 'negative', 'text_zone', 'aspect_ratio', 'brand_palette'] as const;
export type NamedPlaceholder = (typeof NAMED_PLACEHOLDERS)[number];

const WHITELIST: ReadonlySet<string> = new Set(NAMED_PLACEHOLDERS);

/** Matches `{{ name }}` with optional inner whitespace; capture 1 is the trimmed name. */
const NAMED_PATTERN = /\{\{\s*([^{}]*?)\s*\}\}/g;
/** Any blank-like token a user might type to imitate a real one: `[___]`, `[__]`, `[ ____ ]`. */
const BLANK_LIKE_PATTERN = /\[\s*_{2,}\s*\]/g;

export const isNamedPlaceholder = (name: string): name is NamedPlaceholder => WHITELIST.has(name);

/** Number of `[___]` blanks in a core prompt body. */
export function countBlanks(body: string): number {
  return body.split(BLANK_TOKEN).length - 1;
}

/**
 * Names of `{{...}}` placeholders that are not in the whitelist (deduplicated, in order of first
 * appearance). Unbalanced braces are reported as `{{` / `}}`.
 */
export function findUnknownPlaceholders(body: string): string[] {
  const unknown: string[] = [];
  const push = (n: string) => {
    if (!unknown.includes(n)) unknown.push(n);
  };
  for (const match of body.matchAll(NAMED_PATTERN)) {
    const name = match[1] ?? '';
    if (!WHITELIST.has(name)) push(name);
  }
  const withoutValid = body.replace(NAMED_PATTERN, '');
  if (withoutValid.includes('{{')) push('{{');
  if (withoutValid.includes('}}')) push('}}');
  return unknown;
}

/** Removes anything that looks like a blank token or named placeholder from user-supplied text. */
export function stripPlaceholderTokens(value: string): string {
  return value
    .replace(BLANK_LIKE_PATTERN, ' ')
    .replace(NAMED_PATTERN, ' ')
    .replace(/\{\{|\}\}/g, ' ');
}
