import React from 'react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/** One captured request of the fake backend. */
export interface FakeRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

type Reply = { status: number; body: unknown };
type Handler = (req: FakeRequest) => Reply | Promise<Reply>;

/** `{ status: 'success', data, meta }` with HTTP 200 (or `status`). */
export const ok = (data: unknown, meta?: unknown, status = 200): Reply => ({
  status,
  body: { status: 'success', message: 'ok', data, ...(meta ? { meta } : {}) },
});

/** The API's error envelope. */
export const fail = (status: number, error_code: string, errors?: Array<{ field: string; message: string }>): Reply => ({
  status,
  body: { status: 'error', message: 'server text that must never be shown', error_code, ...(errors ? { errors } : {}) },
});

export const pageMeta = (total: number, extra: Record<string, unknown> = {}) => ({ page: 1, limit: 20, total, total_pages: 1, ...extra });

/**
 * Replaces `fetch` with a router keyed by `"METHOD /path"` (path relative to the API base, e.g. `GET /admin/users`).
 * Unknown routes answer 404. Returns the list of captured requests.
 */
export function stubApi(routes: Record<string, Handler>) {
  const calls: FakeRequest[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api\/v1/, '');
    let body: unknown;
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const req: FakeRequest = { method, path, query: url.searchParams, body };
    calls.push(req);
    const handler = routes[`${method} ${path}`];
    const reply = handler ? await handler(req) : fail(404, 'NOT_FOUND');
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock, count: (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path).length };
}

export function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
