import { describe, expect, it } from 'vitest';
import {
  GENERATION_POLL_INTERVAL_MS,
  GENERATION_POLL_MAX_DELAY_MS,
  isPermanentPollError,
  nextPollDelay,
} from './useGenerationPolling';
import { ApiError } from './errors';

describe('nextPollDelay', () => {
  it('polls every 2 seconds while queued or running', () => {
    expect(GENERATION_POLL_INTERVAL_MS).toBe(2000);
    expect(nextPollDelay({ status: undefined, error: null, failureCount: 0 })).toBe(2000);
    expect(nextPollDelay({ status: 'queued', error: null, failureCount: 0 })).toBe(2000);
    expect(nextPollDelay({ status: 'running', error: null, failureCount: 0 })).toBe(2000);
  });

  it('stops when the generation is done or failed', () => {
    expect(nextPollDelay({ status: 'done', error: null, failureCount: 0 })).toBe(false);
    expect(nextPollDelay({ status: 'failed', error: null, failureCount: 0 })).toBe(false);
    // A final status wins even if a later poll errored.
    expect(nextPollDelay({ status: 'done', error: new ApiError({ status: 500, code: 'INTERNAL_ERROR' }), failureCount: 3 })).toBe(false);
  });

  it('backs off exponentially on transient errors, with a cap', () => {
    const e500 = new ApiError({ status: 503, code: 'INTERNAL_ERROR' });
    expect(nextPollDelay({ status: 'running', error: e500, failureCount: 1 })).toBe(4000);
    expect(nextPollDelay({ status: 'running', error: e500, failureCount: 2 })).toBe(8000);
    expect(nextPollDelay({ status: 'running', error: e500, failureCount: 3 })).toBe(16_000);
    expect(nextPollDelay({ status: 'running', error: e500, failureCount: 10 })).toBe(GENERATION_POLL_MAX_DELAY_MS);
    const net = new ApiError({ status: 0, code: 'NETWORK_ERROR' });
    expect(nextPollDelay({ status: undefined, error: net, failureCount: 1 })).toBe(4000);
    const limited = new ApiError({ status: 429, code: 'RATE_LIMIT_EXCEEDED' });
    expect(nextPollDelay({ status: 'running', error: limited, failureCount: 1 })).toBe(4000);
  });

  it('stops on errors that retrying cannot fix (404, 403, 401)', () => {
    for (const status of [401, 403, 404]) {
      const err = new ApiError({ status, code: 'NOT_FOUND' });
      expect(isPermanentPollError(err)).toBe(true);
      expect(nextPollDelay({ status: undefined, error: err, failureCount: 1 })).toBe(false);
    }
    expect(isPermanentPollError(new ApiError({ status: 429, code: 'RATE_LIMIT_EXCEEDED' }))).toBe(false);
  });
});
