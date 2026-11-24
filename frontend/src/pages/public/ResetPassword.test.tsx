import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResetPassword, validateNewPassword } from './ResetPassword';

const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ok = (data: unknown) => res(200, { status: 'success', message: 'ok', data });
const pathOf = (input: RequestInfo | URL) => String(input).replace(/^.*\/api\/v1/, '').split('?')[0];

function stubReset(answer: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) =>
    pathOf(input) === '/auth/reset-password' ? answer() : res(404, { status: 'error', message: 'x', error_code: 'NOT_FOUND' }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const fill = (next: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText('Kata sandi baru'), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('Ulangi kata sandi baru'), { target: { value: confirm } });
};
const submit = () => fireEvent.click(screen.getByRole('button', { name: /Simpan Kata Sandi Baru|Menyimpan/ }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('validateNewPassword', () => {
  it('requires 8+ characters and a matching confirmation', () => {
    expect(validateNewPassword('', '')).toEqual({ new_password: 'Wajib diisi', confirm_password: 'Wajib diisi' });
    expect(validateNewPassword('pendek', 'pendek').new_password).toBe('Minimal 8 karakter');
    expect(validateNewPassword('rahasia123', 'rahasia124').confirm_password).toBe('Konfirmasi tidak sama dengan kata sandi baru');
    expect(validateNewPassword('a'.repeat(73), 'a'.repeat(73)).new_password).toBe('Terlalu panjang (maksimal 72 byte)');
    expect(validateNewPassword('rahasia123', 'rahasia123')).toEqual({});
  });
});

describe('ResetPassword page', () => {
  it('explains a missing token and offers the way back to /login instead of the form', () => {
    const fetchMock = stubReset(() => ok({ reset: true }));
    renderAt('/reset-password');
    expect(screen.getByRole('alert').textContent).toContain('kode atur ulang tidak ditemukan');
    expect(screen.queryByLabelText('Kata sandi baru')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: /Kembali ke Halaman Masuk/ }));
    expect(screen.getByText('LOGIN PAGE')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks the fields locally before calling the server', () => {
    const fetchMock = stubReset(() => ok({ reset: true }));
    renderAt('/reset-password?token=abc');
    fill('rahasia123', 'beda12345');
    submit();
    expect(screen.getByText('Konfirmasi tidak sama dengan kata sandi baru')).toBeTruthy();
    fill('pendek', 'pendek');
    submit();
    expect(screen.getByText('Minimal 8 karakter')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the invalid-link card when the server rejects the token (expired / used / unknown)', async () => {
    stubReset(() => res(400, { status: 'error', message: 'x', error_code: 'INVALID_RESET_TOKEN' }));
    renderAt('/reset-password?token=kedaluwarsa');
    fill('rahasia123', 'rahasia123');
    submit();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Tautan tidak dapat dipakai');
    expect(alert.textContent).toContain('kedaluwarsa');
    expect(screen.queryByLabelText('Kata sandi baru')).toBeNull();
    expect(screen.getByRole('link', { name: /Kembali ke Halaman Masuk/ })).toBeTruthy();
  });

  it('sends the token and new password, shows a busy state, then a success notice with a link to /login', async () => {
    let answer: (r: Response) => void = () => undefined;
    const fetchMock = stubReset(() => new Promise<Response>((resolve) => (answer = resolve)));
    renderAt('/reset-password?token=tok-123');
    fill('rahasia123', 'rahasia123');
    submit();

    const busy = await screen.findByRole('button', { name: /Menyimpan/ });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'tok-123', new_password: 'rahasia123' });

    answer(ok({ reset: true }));
    expect((await screen.findByRole('status')).textContent).toContain('Kata sandi berhasil diganti');
    fireEvent.click(screen.getByRole('link', { name: /Masuk Sekarang/ }));
    expect(screen.getByText('LOGIN PAGE')).toBeTruthy();
  });

  it('keeps the form and shows a generic error for other failures', async () => {
    stubReset(() => res(503, { status: 'error', message: 'x', error_code: 'INTERNAL_ERROR' }));
    renderAt('/reset-password?token=tok-123');
    fill('rahasia123', 'rahasia123');
    submit();
    expect((await screen.findByRole('alert')).textContent).toContain('kesalahan pada server');
    expect(screen.getByLabelText('Kata sandi baru')).toBeTruthy();
  });
});
