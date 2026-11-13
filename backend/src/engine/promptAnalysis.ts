import { hintScore } from './slotHints.js';

export const ANALYSIS_ASPECTS = ['product', 'background', 'color', 'lighting', 'angle', 'composition', 'style'] as const;

const FILLER_WORDS = new Set([
  'very', 'really', 'just', 'please', 'basically', 'actually', 'literally', 'quite', 'maybe', 'something', 'stuff',
  'things', 'nice', 'good', 'amazing', 'awesome', 'kinda', 'sorta', 'somehow', 'like',
  'tolong', 'sangat', 'banget', 'sekali', 'agak', 'kayak', 'semacam', 'gitu', 'saja', 'dong', 'deh', 'pokoknya',
  'mungkin', 'bagus', 'keren', 'kira', 'ya', 'nih', 'sih',
]);

const FILLER_PHRASES = ['kind of', 'sort of', 'a bit', 'a lot of', 'you know', 'tolong buatkan', 'tolong bikin'];

export interface PromptAnalysis {
  /** 0-100 compactness: how much useful direction per word. Deterministic. */
  score: number;
  word_count: number;
  char_count: number;
  breakdown: { length: number; conciseness: number; uniqueness: number; coverage: number };
  filler_words: string[];
  repeated_terms: string[];
  covered_aspects: string[];
  missing_aspects: string[];
  suggestions: string[];
}

const stripEdges = (token: string): string => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((t) => stripEdges(t).toLowerCase())
    .filter(Boolean);
}

const clamp = (n: number, lo = 0, hi = 100): number => Math.min(hi, Math.max(lo, n));

export function analyzePrompt(text: string): PromptAnalysis {
  const normalized = text.trim().replace(/\s+/g, ' ');
  const tokens = tokenize(normalized);
  const wordCount = tokens.length;

  if (wordCount === 0) {
    return {
      score: 0,
      word_count: 0,
      char_count: 0,
      breakdown: { length: 0, conciseness: 0, uniqueness: 0, coverage: 0 },
      filler_words: [],
      repeated_terms: [],
      covered_aspects: [],
      missing_aspects: [...ANALYSIS_ASPECTS],
      suggestions: ['Tulis deskripsi singkat tentang subjek, latar, warna, dan pencahayaan.'],
    };
  }

  const lowered = ` ${tokens.join(' ')} `;
  const fillerSet = new Set<string>();
  let fillerCount = 0;
  for (const phrase of FILLER_PHRASES) {
    const occurrences = lowered.split(` ${phrase} `).length - 1;
    if (occurrences > 0) {
      fillerSet.add(phrase);
      fillerCount += occurrences * phrase.split(' ').length;
    }
  }
  for (const t of tokens) {
    if (FILLER_WORDS.has(t)) {
      fillerSet.add(t);
      fillerCount += 1;
    }
  }

  const counts = new Map<string, number>();
  const contentTokens = tokens.filter((t) => t.length >= 4 && !FILLER_WORDS.has(t));
  for (const t of contentTokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  const repeated = [...counts.entries()].filter(([, c]) => c >= 2);
  const excess = repeated.reduce((sum, [, c]) => sum + (c - 1), 0);

  const covered = ANALYSIS_ASPECTS.filter((a) => hintScore(normalized, a) > 0);
  const missing = ANALYSIS_ASPECTS.filter((a) => !covered.includes(a));

  // Length counts words that carry direction (filler does not), so padding cannot inflate the score.
  const usefulCount = Math.max(0, wordCount - fillerCount);
  const length =
    usefulCount < 8 ? (usefulCount / 8) * 100 : wordCount <= 60 ? 100 : 100 - (wordCount - 60) * (100 / 140);
  const conciseness = 100 - (fillerCount / wordCount) * 400;
  const uniqueness = 100 - (excess / Math.max(1, contentTokens.length)) * 300;
  const coverage = (covered.length / 5) * 100;

  const breakdown = {
    length: Math.round(clamp(length)),
    conciseness: Math.round(clamp(conciseness)),
    uniqueness: Math.round(clamp(uniqueness)),
    coverage: Math.round(clamp(coverage)),
  };
  const score = Math.round(
    0.35 * breakdown.length + 0.2 * breakdown.conciseness + 0.15 * breakdown.uniqueness + 0.3 * breakdown.coverage,
  );

  const suggestions: string[] = [];
  if (wordCount < 8) suggestions.push('Prompt terlalu singkat; tambahkan detail subjek, latar, atau suasana.');
  if (wordCount > 60) suggestions.push('Prompt terlalu panjang; ringkas menjadi poin-poin penting saja.');
  if (fillerSet.size > 0) suggestions.push(`Hapus kata pengisi: ${[...fillerSet].join(', ')}.`);
  if (repeated.length > 0) suggestions.push(`Hindari pengulangan: ${repeated.map(([t]) => t).join(', ')}.`);
  if (missing.length > 0 && covered.length < 5) {
    suggestions.push(`Pertimbangkan menambah aspek: ${missing.slice(0, 3).join(', ')}.`);
  }

  return {
    score: clamp(score),
    word_count: wordCount,
    char_count: normalized.length,
    breakdown,
    filler_words: [...fillerSet],
    repeated_terms: repeated.map(([t]) => t),
    covered_aspects: [...covered],
    missing_aspects: [...missing],
    suggestions,
  };
}

export interface HeuristicImprovement {
  text: string;
  changes: string[];
}

/** Rule-based clean-up: drops filler, adjacent repeats and duplicate clauses. Never invents content. */
export function heuristicImprove(text: string): HeuristicImprovement {
  const changes: string[] = [];
  let working = ` ${text.trim().replace(/\s+/g, ' ')} `;

  for (const phrase of FILLER_PHRASES) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${phrase.replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, 'giu');
    if (re.test(working)) {
      working = working.replace(re, ' ');
      changes.push(`Menghapus frasa pengisi "${phrase}"`);
    }
  }

  const kept: string[] = [];
  let prev = '';
  for (const raw of working.split(' ').filter(Boolean)) {
    const bare = stripEdges(raw).toLowerCase();
    if (bare && FILLER_WORDS.has(bare)) {
      if (!changes.includes(`Menghapus kata pengisi "${bare}"`)) changes.push(`Menghapus kata pengisi "${bare}"`);
      continue;
    }
    if (bare && bare === prev) {
      changes.push(`Menghapus pengulangan "${bare}"`);
      continue;
    }
    kept.push(raw);
    prev = bare || prev;
  }

  const seenClauses: string[] = [];
  const clauses = kept
    .join(' ')
    .split(/([,;.])/)
    .reduce<string[]>((acc, part, i, arr) => {
      if (i % 2 === 1) return acc;
      // Removing filler can strand connectors at the edges of a clause ("... yang dan").
      const clause = part.trim().replace(/(?:\s+(?:dan|yang|and|or|atau|with|dengan|of|a|an|the))+$/i, '').trim();
      if (!clause) return acc;
      const key = clause.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
      // A clause that repeats (or is fully contained in) an earlier one adds nothing.
      if (key && seenClauses.some((earlier) => earlier.includes(key))) {
        changes.push('Menghapus klausa yang berulang');
        return acc;
      }
      seenClauses.push(key);
      acc.push(clause + (arr[i + 1] === '.' ? '.' : ''));
      return acc;
    }, []);

  let out = clauses.join(', ').replace(/\.,/g, '.').replace(/\s+/g, ' ').trim();
  out = out.replace(/[,;]+$/, '');
  if (out) out = out.charAt(0).toUpperCase() + out.slice(1);
  return { text: out, changes };
}
