/**
 * Polls `GET /generations/:id` every 2 seconds until the generation is `done` or `failed`.
 *
 * - Stops by itself when the component unmounts (the query observer goes away) and as soon as the status is final.
 * - Backs off exponentially (2 s, 4 s, 8 s ... capped at 30 s) on network errors, 5xx and 429; stops on other 4xx
 *   (404 / 403 / 401: retrying cannot help).
 * - When the generation finishes it invalidates `me` (the remaining daily limit changed) and the generation lists.
 * - Shares the cache entry `queryKeys.generations.detail(id)` with any other reader of that generation.
 */
import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getGeneration } from './creator';
import { isApiError } from './errors';
import { queryKeys } from './queryKeys';
import type { Generation, GenerationStatus } from './types';

export const GENERATION_POLL_INTERVAL_MS = 2000;
export const GENERATION_POLL_MAX_DELAY_MS = 30_000;

export const isGenerationFinal = (status: GenerationStatus | undefined): boolean => status === 'done' || status === 'failed';

/** True when polling again after this error cannot help (4xx other than 429). */
export const isPermanentPollError = (error: unknown): boolean =>
  isApiError(error) && error.status >= 400 && error.status < 500 && error.status !== 429;

/**
 * Delay before the next poll, or `false` to stop. Pure, so the schedule is unit-tested.
 * `failureCount` is the number of consecutive failed polls.
 */
export function nextPollDelay(args: {
  status: GenerationStatus | undefined;
  error: unknown;
  failureCount: number;
  intervalMs?: number;
}): number | false {
  const interval = args.intervalMs ?? GENERATION_POLL_INTERVAL_MS;
  if (isGenerationFinal(args.status)) return false;
  if (args.error) {
    if (isPermanentPollError(args.error)) return false;
    return Math.min(interval * 2 ** Math.max(1, args.failureCount), GENERATION_POLL_MAX_DELAY_MS);
  }
  return interval;
}

export interface UseGenerationPollingOptions {
  /** Default true. Pass false to pause (for example before the id exists). */
  enabled?: boolean;
  /** Default 2000. */
  intervalMs?: number;
  /** Called once when the generation reaches `done` or `failed`. */
  onFinished?: (generation: Generation) => void;
}

export function useGenerationPolling(id: string | null | undefined, options: UseGenerationPollingOptions = {}) {
  const { enabled = true, intervalMs = GENERATION_POLL_INTERVAL_MS, onFinished } = options;
  const queryClient = useQueryClient();
  const active = enabled && !!id;

  const query = useQuery({
    queryKey: queryKeys.generations.detail(id ?? ''),
    queryFn: ({ signal }) => getGeneration(id as string, signal),
    enabled: active,
    retry: false, // the backoff below is the retry policy
    refetchIntervalInBackground: false,
    refetchInterval: (q) =>
      nextPollDelay({
        status: q.state.data?.status,
        error: q.state.error,
        failureCount: q.state.fetchFailureCount,
        intervalMs,
      }),
  });

  const generation = query.data;
  const status = generation?.status;
  const isFinished = isGenerationFinal(status);

  // Fire the finish side effects once per generation id.
  const notified = useRef<string | null>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  useEffect(() => {
    if (!generation || !isGenerationFinal(generation.status) || notified.current === generation.id) return;
    notified.current = generation.id;
    void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    void queryClient.invalidateQueries({ queryKey: queryKeys.generations.lists() });
    onFinishedRef.current?.(generation);
  }, [generation, queryClient]);

  const error = query.error;
  return {
    generation,
    status,
    isDone: status === 'done',
    isFailed: status === 'failed',
    isFinished,
    /** True while the hook is still asking the server. */
    isPolling: active && !isFinished && !isPermanentPollError(error),
    /** Last polling error (a previous result, if any, stays in `generation`). */
    error: isApiError(error) ? error : error ? new Error(String(error)) : null,
    refetch: query.refetch,
  };
}
