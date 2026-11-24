import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { AuthProvider } from '../../auth/AuthProvider';
import { Login } from './Login';

const user = { id: 'u1', email: 'siti@x.id', name: 'Siti', role: 'creator', last_login_at: null, created_at: '2026-01-01T00:00:00Z', avatar_url: null };
const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ok = (data: unknown) => res(200, { status: 'success', message: 'ok', data });
const pathOf = (input: RequestInfo | URL) => String(input).replace(/^.*\/api\/v1/, '').split('?')[0];

/** Anonymous visitor (no refresh cookie). `forgot` decides the answer of POST /auth/forgot-password. */
function stubBackend(forgot: () => Response | Promise<Response> = () => ok({ sent: true })) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const path = pathOf(input);
    if (path === '/auth/refresh') return res(401, { status: 'error', message: 'x', error_code: 'UNAUTHORIZED' });
    if (path === '/auth/login') return ok({ user, access_token: 'tok', token_type: 'Bearer', expires_in: 3600 });
    if (path === '/me') return ok({ user, usage: { date: '2026-11-14', daily_limit: 10, used_today: 0, in_flight: 0, remaining_today: 10 } });
    if (path === '/auth/forgot-password') return forgot();
    return res(404, { status: 'error', message: 'x', error_code: 'NOT_FOUND' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderLogin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/creator/dashboard" element={<div>CREATOR DASHBOARD</div>} />
            <Route path="/creator/studio" element={<div>CREATOR STUDIO</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  apiClient.clearSession();
  vi.unstubAllGlobals();
});

const openForgot = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Lupa kata sandi?' }));
  return screen.getByRole('dialog');
};

describe('Login', () => {
  it('lands a creator on the dashboard, not the studio', async () => {
    stubBackend();
    renderLogin();
    fireEvent.change(await screen.findByPlaceholderText('nama@email.com'), { target: { value: 'siti@x.id' } });
    fireEvent.change(screen.getByPlaceholderText('Masukkan kata sandi'), { target: { value: 'rahasia123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    await screen.findByText('CREATOR DASHBOARD');
    expect(screen.queryByText('CREATOR STUDIO')).toBeNull();
  });

  it('no longer offers the WhatsApp contact for a forgotten password', async () => {
    stubBackend();
    renderLogin();
    await openForgot();
    expect(document.querySelector('a[href*="wa.me"]')).toBeNull();
  });
});

describe('Login: forgot password', () => {
  it('sends the email (prefilled from the form) and shows a notice that does not reveal whether the account exists', async () => {
    const fetchMock = stubBackend();
    renderLogin();
    fireEvent.change(await screen.findByPlaceholderText('nama@email.com'), { target: { value: '  siti@x.id ' } });
    const dialog = await openForgot();
    expect((within(dialog).getByLabelText('Email') as HTMLInputElement).value).toBe('siti@x.id');

    fireEvent.click(within(dialog).getByRole('button', { name: /Kirim Tautan/ }));

    const notice = await within(dialog).findByRole('status');
    expect(notice.textContent).toContain('Jika siti@x.id terdaftar');
    expect(notice.textContent).not.toMatch(/tidak terdaftar|tidak ditemukan/i);
    const call = fetchMock.mock.calls.find((c) => pathOf(c[0]) === '/auth/forgot-password');
    expect(call?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ email: 'siti@x.id' });
  });

  it('validates the email locally before calling the server', async () => {
    const fetchMock = stubBackend();
    renderLogin();
    const dialog = await openForgot();
    fireEvent.click(within(dialog).getByRole('button', { name: /Kirim Tautan/ }));
    expect(await within(dialog).findByText('Wajib diisi')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'bukan-email' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Kirim Tautan/ }));
    expect(await within(dialog).findByText('Format email tidak valid')).toBeTruthy();
    expect(fetchMock.mock.calls.some((c) => pathOf(c[0]) === '/auth/forgot-password')).toBe(false);
  });

  it('shows a busy state while sending and a friendly error when the request fails', async () => {
    let answer: (r: Response) => void = () => undefined;
    stubBackend(() => new Promise<Response>((resolve) => (answer = resolve)));
    renderLogin();
    const dialog = await openForgot();
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'siti@x.id' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Kirim Tautan/ }));

    const busyButton = await within(dialog).findByRole('button', { name: /Mengirim/ });
    expect((busyButton as HTMLButtonElement).disabled).toBe(true);

    answer(res(429, { status: 'error', message: 'x', error_code: 'RATE_LIMIT_EXCEEDED' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain('Terlalu banyak permintaan');
    await waitFor(() => expect(within(dialog).queryByRole('status')).toBeNull());
  });
});
