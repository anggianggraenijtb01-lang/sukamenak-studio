/**
 * Prompt compactness for the Studio and the Advisor.
 *
 * The real score comes from `POST /prompts/analyze` (deterministic, server side). It is requested only after the
 * user stopped typing (debounce) and only for text that is long enough to analyse. Until an answer arrives, or
 * when the call fails (rate limit, offline), `estimateCompactness` gives a rough local estimate so the meter
 * never goes blank. The estimate is always flagged as such in the UI.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyzePrompt } from '../../api/creator';
import { queryKeys } from '../../api/queryKeys';
import type { PromptAnalysis } from '../../api/types';

export const ANALYZE_MIN_CHARS = 8;
export const ANALYZE_MAX_CHARS = 4000;
export const ANALYZE_DEBOUNCE_MS = 700;

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export interface CompactnessView {
  /** 0 to 100, higher is more compact and direct. */
  score: number;
  wordCount: number;
  charCount: number;
  suggestions: string[];
  fillerWords: string[];
  missingAspects: string[];
  /** `server` = real analysis, `estimate` = local rough guess, `none` = nothing to analyse yet. */
  source: 'server' | 'estimate' | 'none';
}

const FILLER = new Set([
  'tolong', 'sangat', 'banget', 'sekali', 'agak', 'kayak', 'semacam', 'gitu', 'saja', 'dong', 'deh', 'pokoknya', 'mungkin',
  'bagus', 'keren', 'ya', 'nih', 'sih', 'very', 'really', 'just', 'please', 'nice', 'good', 'amazing',
]);

/** Rough local stand-in for the server score. Pure; only used while the real analysis is unavailable. */
export function estimateCompactness(text: string): CompactnessView {
  const normalized = text.trim().replace(/\s+/g, ' ');
  const words = normalized ? normalized.split(' ') : [];
  if (words.length === 0) {
    return { score: 0, wordCount: 0, charCount: 0, suggestions: [], fillerWords: [], missingAspects: [], source: 'none' };
  }
  const filler = [...new Set(words.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')).filter((w) => FILLER.has(w)))];
  const fillerCount = words.filter((w) => FILLER.has(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))).length;
  const length = words.length < 8 ? (words.length / 8) * 100 : words.length <= 60 ? 100 : Math.max(0, 100 - (words.length - 60) * (100 / 140));
  const conciseness = Math.max(0, 100 - (fillerCount / words.length) * 400);
  const score = Math.round(Math.min(100, Math.max(0, 0.6 * length + 0.4 * conciseness)));
  const suggestions: string[] = [];
  if (words.length < 8) suggestions.push('Tambahkan detail singkat: subjek, latar, atau suasana.');
  if (words.length > 60) suggestions.push('Terlalu panjang; ringkas menjadi poin-poin penting saja.');
  if (filler.length) suggestions.push(`Hapus kata pengisi: ${filler.join(', ')}.`);
  return { score, wordCount: words.length, charCount: normalized.length, suggestions, fillerWords: filler, missingAspects: [], source: 'estimate' };
}

export function fromAnalysis(a: PromptAnalysis): CompactnessView {
  return {
    score: Math.round(Math.min(100, Math.max(0, a.score))),
    wordCount: a.word_count,
    charCount: a.char_count,
    suggestions: a.suggestions ?? [],
    fillerWords: a.filler_words ?? [],
    missingAspects: a.missing_aspects ?? [],
    source: 'server',
  };
}

/** Indonesian status word for a score. */
export function compactnessLabel(score: number): string {
  if (score >= 80) return 'Ringkas & Padat';
  if (score >= 60) return 'Cukup Baik';
  if (score >= 35) return 'Perlu Dirapikan';
  return 'Belum Efektif';
}

export interface PromptAnalysisState {
  view: CompactnessView;
  /** True while the user is typing or the request is in flight. */
  pending: boolean;
  /** The analysis call failed; the view then carries the local estimate. */
  failed: boolean;
}

/**
 * Debounced `analyzePrompt`. No request is sent per keystroke: the text must rest for `delayMs`, be at least
 * `ANALYZE_MIN_CHARS` long, and an identical text is answered from the cache.
 */
export function usePromptAnalysis(text: string, options: { delayMs?: number; enabled?: boolean } = {}): PromptAnalysisState {
  const { delayMs = ANALYZE_DEBOUNCE_MS, enabled = true } = options;
  const trimmed = text.trim();
  const settled = useDebouncedValue(trimmed, delayMs);
  const canAsk = enabled && settled.length >= ANALYZE_MIN_CHARS && settled.length <= ANALYZE_MAX_CHARS;

  const query = useQuery({
    queryKey: [...queryKeys.prompts.all, 'analysis', settled] as const,
    queryFn: ({ signal }) => analyzePrompt({ text: settled }, signal),
    enabled: canAsk,
    staleTime: 10 * 60_000,
    retry: false,
  });

  return useMemo<PromptAnalysisState>(() => {
    const typing = trimmed !== settled;
    if (!trimmed) return { view: estimateCompactness(''), pending: false, failed: false };
    // The server answer only describes the text it was asked about.
    if (query.data && !typing && canAsk) return { view: fromAnalysis(query.data), pending: false, failed: false };
    return {
      view: estimateCompactness(trimmed),
      pending: enabled && (typing || (canAsk && query.isFetching)),
      failed: canAsk && !typing && query.isError,
    };
  }, [trimmed, settled, query.data, query.isFetching, query.isError, canAsk, enabled]);
}
