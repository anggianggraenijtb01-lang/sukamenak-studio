import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';
import { AuthProvider, homePathForRole, useAuth } from './AuthProvider';
import { RequireAuth, RequireRole } from './guards';

type Role = 'creator' | 'admin';
const user = (role: Role) => ({ id: 'u1', email: 'u@x.id', name: 'Siti Aminah', role, last_login_at: null, created_at: '2026-01-01T00:00:00Z' });
const sessionBody = (role: Role) => ({
  status: 'success',
  message: 'ok',
  data: { user: user(role), access_token: 'tok', token_type: 'Bearer', expires_in: 3600 },
});
const meBody = (role: Role) => ({
  status: 'success',
  message: 'ok',
  data: { user: user(role), usage: { date: '2026-11-14', daily_limit: 15, used_today: 3, in_flight: 0, remaining_today: 12 } },
});
const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const unauthorized = () => res(401, { status: 'error', message: 'x', error_code: 'UNAUTHORIZED' });

/** Fake backend: refresh works when `cookie` is true. */
function stubBackend(opts: { cookie: boolean; role?: Role }) {
  const role = opts.role ?? 'creator';
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/auth/refresh')) return opts.cookie ? res(200, sessionBody(role)) : unauthorized();
    if (url.endsWith('/me')) return res(200, meBody(role));
    if (url.endsWith('/auth/logout')) return res(200, { status: 'success', message: 'ok', data: { logged_out: true } });
    return res(404, { status: 'error', message: 'x', error_code: 'NOT_FOUND' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const refreshCalls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter((c) => String(c[0]).endsWith('/auth/refresh')).length;

const Where: React.FC = () => {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}</div>;
};
const Status: React.FC = () => {
  const { status, user: u } = useAuth();
  return <div data-testid="status">{`${status}:${u?.role ?? '-'}`}</div>;
};

function renderApp(initial: string, strict = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initial]}>
          <Status />
          <Routes>
            <Route path="/login" element={<><div>LOGIN PAGE</div><Where /></>} />
            <Route element={<RequireRole role="creator" />}>
              <Route path="/creator/studio" element={<div>CREATOR AREA</div>} />
            </Route>
            <Route element={<RequireRole role="admin" />}>
              <Route path="/admin/dashboard" element={<div>ADMIN AREA</div>} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route path="/any" element={<div>ANY AUTH</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  return render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
}

afterEach(() => {
  apiClient.clearSession();
  vi.unstubAllGlobals();
});

describe('homePathForRole', () => {
  it('sends a creator to the dashboard (not the studio) and an admin to the admin dashboard', () => {
    expect(homePathForRole('creator')).toBe('/creator/dashboard');
    expect(homePathForRole('admin')).toBe('/admin/dashboard');
  });
});

describe('AuthProvider start-up', () => {
  it('restores the session from the cookie, then reads /me', async () => {
    const fetchMock = stubBackend({ cookie: true });
    renderApp('/creator/studio');
    expect(screen.getByTestId('status').textContent).toBe('loading:-');
    await screen.findByText('CREATOR AREA');
    expect(screen.getByTestId('status').textContent).toBe('authenticated:creator');
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.endsWith('/auth/refresh'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/me'))).toBe(true);
  });

  it('does a single refresh even under React StrictMode (refresh tokens must not be replayed)', async () => {
    const fetchMock = stubBackend({ cookie: true });
    renderApp('/creator/studio', true);
    await screen.findByText('CREATOR AREA');
    expect(refreshCalls(fetchMock)).toBe(1);
  });

  it('becomes anonymous without a cookie', async () => {
    stubBackend({ cookie: false });
    renderApp('/any');
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous:-'));
  });

  describe('when the server cannot be reached', () => {
    // A fake backend that is down until `bringUp()` is called, then behaves like a signed-in creator.
    function stubFlakyBackend(mode: 'refresh-503' | 'network-error' | 'me-503') {
      let up = false;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input);
          if (!up && mode === 'network-error') throw new TypeError('fetch failed');
          if (url.endsWith('/auth/refresh')) {
            return !up && mode === 'refresh-503' ? res(503, { status: 'error', message: 'x', error_code: 'INTERNAL_ERROR' }) : res(200, sessionBody('creator'));
          }
          if (url.endsWith('/me')) {
            return !up && mode === 'me-503' ? res(503, { status: 'error', message: 'x', error_code: 'INTERNAL_ERROR' }) : res(200, meBody('creator'));
          }
          return res(404, { status: 'error', message: 'x', error_code: 'NOT_FOUND' });
        }),
      );
      return { bringUp: () => (up = true) };
    }

    it.each(['refresh-503', 'network-error', 'me-503'] as const)(
      'is "unavailable", not signed out, and does not bounce to /login (%s)',
      async (mode) => {
        stubFlakyBackend(mode);
        renderApp('/creator/studio');
        await screen.findByText('Tidak dapat menghubungi server');
        expect(screen.getByTestId('status').textContent).toBe('unavailable:-');
        expect(screen.queryByText('LOGIN PAGE')).toBeNull();
        expect(screen.queryByText('CREATOR AREA')).toBeNull();
        expect(screen.getByRole('alert')).toBeTruthy();
      },
    );

    it('shows the same screen on an admin route, never the login page', async () => {
      stubFlakyBackend('refresh-503');
      renderApp('/admin/dashboard');
      await screen.findByText('Tidak dapat menghubungi server');
      expect(screen.queryByText('LOGIN PAGE')).toBeNull();
    });

    it('recovers with "Coba Lagi" once the server is back, keeping the user signed in', async () => {
      const backend = stubFlakyBackend('refresh-503');
      renderApp('/creator/studio');
      await screen.findByText('Tidak dapat menghubungi server');

      backend.bringUp();
      fireEvent.click(screen.getByRole('button', { name: /coba lagi/i }));

      await screen.findByText('CREATOR AREA');
      expect(screen.getByTestId('status').textContent).toBe('authenticated:creator');
      expect(screen.queryByText('Tidak dapat menghubungi server')).toBeNull();
    });
  });
});

describe('guards', () => {
  it('sends anonymous visitors to /login and remembers where they were going', async () => {
    stubBackend({ cookie: false });
    renderApp('/admin/dashboard');
    await screen.findByText('LOGIN PAGE');
    expect(screen.getByTestId('where').textContent).toBe('/login');
    expect(screen.queryByText('ADMIN AREA')).toBeNull();
  });

  it('shows the 403 page to a creator on an admin route', async () => {
    stubBackend({ cookie: true, role: 'creator' });
    renderApp('/admin/dashboard');
    await screen.findByText('Halaman Khusus Admin');
    expect(screen.queryByText('ADMIN AREA')).toBeNull();
  });

  it('lets an admin into the admin area and the creator area', async () => {
    stubBackend({ cookie: true, role: 'admin' });
    const first = renderApp('/admin/dashboard');
    await screen.findByText('ADMIN AREA');
    first.unmount();
    apiClient.clearSession();
    renderApp('/creator/studio');
    await screen.findByText('CREATOR AREA');
  });

  it('shows nothing from a protected route while the session is still loading', () => {
    // A refresh that never answers keeps the provider in the loading state.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    renderApp('/creator/studio');
    expect(screen.queryByText('CREATOR AREA')).toBeNull();
    expect(screen.queryByText('LOGIN PAGE')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
