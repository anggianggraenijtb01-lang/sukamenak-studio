/**
 * sanitizeRemark - cleans a creator's free-text remarks before they can reach the prompt composer.
 *
 * Remarks are untrusted input that ends up inside a prompt sent to an image model, so this is
 * the injection boundary for the free-text field. The composer calls it on every remark and
 * additionally enforces its own hard guarantees (no blank/placeholder tokens, no
 * text/typography/headline words) on the final prompt, so a gap here degrades quality rather
 * than breaking the invariants.
 *
 * Policy: injection is removed per sentence. A sentence matching an injection pattern is dropped
 * whole (stripping only the trigger phrase would leave the malicious payload behind); the other
 * sentences keep the creator's legitimate intent. A remark written without sentence punctuation
 * is a single "sentence", so it is dropped entirely - a safe failure, because a core prompt
 * without remarks still generates a valid image (PRD section 5 rule 6).
 */

import { stripPlaceholderTokens } from './placeholders.js';
import { stripBlockedTerms, stripForbiddenWords } from './policy.js';

export interface SanitizeRemarkOptions {
  /** Terms from the active content policy (already lower-cased or not; match case-insensitively). */
  blockedTerms: string[];
  /** Maximum length of the returned string, in characters. */
  maxLength: number;
}

const L = '\\p{L}\\p{N}';
const START = `(?<![${L}])`;
const END = `(?![${L}])`;
/** Up to `n` filler words between a verb and its object. */
const gap = (n: number) => `(?:[^${L}]+[${L}]+){0,${n}}?[^${L}]+`;

const SYSTEM_OBJECT_EN = '(?:instructions?|rules?|prompts?|directives?|guidelines?|commands?|constraints?|restrictions?)';
const SYSTEM_OBJECT_ID = '(?:instruksi|perintah|aturan|petunjuk|arahan|prompt|batasan|larangan)';

const INJECTION_PATTERNS: RegExp[] = [
  // "ignore (all) previous instructions" - the object keeps "ignore the busy background" and
  // "ignore the rule of thirds" (a composition term the templates offer) from matching.
  new RegExp(
    `${START}(?:ignore|disregard|forget|override|bypass)${END}` +
      `(?:\\s+(?:all|any|the|your|my|previous|prior|above|earlier|preceding|system|these|those|every|other|original|initial)){0,4}` +
      `\\s+${SYSTEM_OBJECT_EN}(?!\\s+of\\s+thirds)${END}`,
    'iu',
  ),
  // "abaikan semua instruksi sebelumnya" - "abaikan latar belakang" has no system object, so it passes.
  new RegExp(
    `${START}(?:abaikan(?:lah)?|lupakan(?:lah)?|kesampingkan|langgar|tiadakan)${END}` +
      `(?:\\s+(?:semua|seluruh|segala|setiap|yang|dari|kamu|anda|sistem|awal|tadi|sebelumnya|di\\s+atas)){0,4}` +
      `\\s+${SYSTEM_OBJECT_ID}${END}`,
    'iu',
  ),
  // Role hijack. "act as" / "berperan sebagai" are deliberately NOT here: remarks such as
  // "model berperan sebagai koki" are legitimate scene directions.
  new RegExp(`${START}you\\s+are\\s+now${END}`, 'iu'),
  new RegExp(`${START}from\\s+now\\s+on${END}${gap(4)}you${END}`, 'iu'),
  new RegExp(`${START}pretend\\s+(?:you|to\\s+be)${END}`, 'iu'),
  new RegExp(`${START}(?:kamu|anda|engkau)\\s+(?:sekarang|kini)\\s+(?:adalah|jadi|menjadi)${END}`, 'iu'),
  new RegExp(`${START}mulai\\s+(?:sekarang|saat\\s+ini)\\s+(?:kamu|anda)${END}`, 'iu'),
  new RegExp(`${START}new\\s+instructions?\\s*:`, 'iu'),
  new RegExp(`${START}(?:system\\s*prompt|prompt\\s+sistem|jailbreak|developer\\s+mode)${END}`, 'iu'),
  // Prompt extraction via the image itself: "write out the instructions above on the poster".
  // The model could paint core-prompt fragments as glyphs, which a JSON-only leak test never sees.
  new RegExp(
    `${START}(?:write|print|show|reveal|display|repeat|output|leak|tell|tulis(?:kan)?|tampilkan|cetak|bocorkan|ungkap(?:kan)?|ulangi|sebutkan|beritahu)${END}` +
      `${gap(6)}(?:prompts?|instructions?|instruksi)${END}`,
    'iu',
  ),
];

/** NFKC folds full-width and compatibility forms; zero-width characters are removed so they cannot split a keyword. */
const ZERO_WIDTH = /[​-‏‪-‮⁠﻿]/g;

function dropInjectionSentences(value: string): string {
  const sentences = value.match(/[^.!?;]+[.!?;]*/g) ?? [];
  return sentences.filter((s) => !INJECTION_PATTERNS.some((re) => re.test(s))).join('');
}

export function sanitizeRemark(input: string, opts: SanitizeRemarkOptions): string {
  const normalised = input.normalize('NFKC').replace(ZERO_WIDTH, '').replace(/\s+/g, ' ').trim();

  let result = dropInjectionSentences(normalised);
  result = stripPlaceholderTokens(result);
  result = stripForbiddenWords(result);
  result = stripBlockedTerms(result, opts.blockedTerms);

  // Length limit last, so removed words do not eat the budget.
  return result.replace(/\s+/g, ' ').trim().slice(0, opts.maxLength).trimEnd();
}
