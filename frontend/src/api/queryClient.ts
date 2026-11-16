import { QueryClient } from '@tanstack/react-query';
import { isApiError } from './errors';

/** Retry only what can succeed later: network errors, 5xx and 429, at most twice. Never 4xx. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (!isApiError(error)) return false;
  return error.status === 0 || error.status === 429 || error.status >= 500;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        staleTime: 30_000,
        refetchOnWindowFocus: false, // no refetch storms when the user switches tabs (global limit is 60 req/min)
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
    },
  });
}

/** The app-wide client. Cleared on logout / session expiry so one user's data never reaches the next. */
export const queryClient = createQueryClient();
