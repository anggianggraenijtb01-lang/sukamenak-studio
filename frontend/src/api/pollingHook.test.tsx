import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useGenerationPolling } from './useGenerationPolling';
import { queryKeys } from './queryKeys';

const gen = (status: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ status: 'success', message: 'ok', data: { id: 'g1', status, ...extra } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useGenerationPolling', () => {
  it('polls until done, then stops, refreshes /me and calls onFinished once', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => gen('queued'))
      .mockImplementationOnce(async () => gen('running', { progress_step: 'generate' }))
      .mockImplementation(async () => gen('done', { result_url: 'http://x/y.png' }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const onFinished = vi.fn();
    const { result } = renderHook(() => useGenerationPolling('g1', { intervalMs: 20, onFinished }), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(result.current.isDone).toBe(true), { timeout: 3000 });
    expect(result.current.isPolling).toBe(false);
    const callsAtDone = fetchMock.mock.calls.length;
    expect(callsAtDone).toBe(3);

    await new Promise((r) => setTimeout(r, 120)); // would have polled ~5 more times if it had not stopped
    expect(fetchMock.mock.calls.length).toBe(callsAtDone);
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.me });
  });

  it('stops polling on unmount', async () => {
    const fetchMock = vi.fn(async () => gen('running'));
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = renderHook(() => useGenerationPolling('g1', { intervalMs: 20 }), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
    unmount();
    await new Promise((r) => setTimeout(r, 30)); // let an in-flight poll settle
    const after = fetchMock.mock.calls.length;
    await new Promise((r) => setTimeout(r, 120));
    expect(fetchMock.mock.calls.length).toBe(after);
  });

  it('does nothing without an id', async () => {
    const fetchMock = vi.fn(async () => gen('running'));
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient();
    const { result } = renderHook(() => useGenerationPolling(null), { wrapper: wrapperFor(client) });
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isPolling).toBe(false);
  });
});
