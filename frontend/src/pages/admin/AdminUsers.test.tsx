import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { fail, ok, pageMeta, renderWithProviders, stubApi } from '../../test/adminHarness';
import { AdminUsers } from './AdminUsers';

// The page only needs to know who is signed in (to mark "Anda").
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'me', email: 'admin@x.id', name: 'Admin Utama', role: 'admin' } }),
}));

const TEMP = 'Tmp-Pass-9xQ2-secret';

const u = (over: Record<string, unknown>) => ({
  id: 'u2',
  email: 'budi@x.id',
  name: 'Budi Santoso',
  role: 'creator',
  is_active: true,
  daily_limit_override: null,
  last_login_at: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...over,
});

const baseRoutes = () => ({
  'GET /admin/users': () =>
    ok([u({ id: 'me', email: 'admin@x.id', name: 'Admin Utama', role: 'admin' }), u({})], {
      ...pageMeta(2),
      active_admins: 1,
      warnings: ['Hanya 1 admin aktif tersisa'],
    }),
});

afterEach(() => vi.unstubAllGlobals());

describe('AdminUsers', () => {
  it('surfaces the API warnings about the number of active admins', async () => {
    stubApi(baseRoutes());
    renderWithProviders(<AdminUsers />);
    const alert = await screen.findByText('Hanya 1 admin aktif tersisa');
    expect(alert).toBeTruthy();
    expect(screen.getByText(/tersisa 1 admin aktif/)).toBeTruthy();
  });

  it('shows the temporary password once and discards it when the dialog closes', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    stubApi({
      ...baseRoutes(),
      'POST /admin/users/u2/reset-password': () => ok({ user: u({}), temporary_password: TEMP }),
    });
    renderWithProviders(<AdminUsers />);

    fireEvent.click(await screen.findByRole('button', { name: 'Reset kata sandi Budi Santoso' }));
    const confirm = await screen.findByRole('dialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Reset Kata Sandi' }));

    const secret = await screen.findByTestId('temp-password');
    expect(secret.textContent).toBe(TEMP);

    fireEvent.click(screen.getByRole('button', { name: 'Salin kata sandi sementara' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(TEMP));

    fireEvent.click(screen.getByRole('button', { name: 'Saya sudah menyimpannya' }));
    await waitFor(() => expect(screen.queryByTestId('temp-password')).toBeNull());
    expect(document.body.textContent).not.toContain(TEMP);
    expect(document.body.innerHTML).not.toContain(TEMP);
  });

  it('maps CANNOT_MODIFY_SELF to a clear message when deleting yourself', async () => {
    stubApi({ ...baseRoutes(), 'DELETE /admin/users/me': () => fail(409, 'CANNOT_MODIFY_SELF') });
    renderWithProviders(<AdminUsers />);
    fireEvent.click(await screen.findByRole('button', { name: 'Hapus Admin Utama' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hapus Pengguna' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toBe('Anda tidak dapat menghapus akun Anda sendiri.');
  });

  it('maps LAST_ADMIN when deactivating the last active admin', async () => {
    stubApi({ ...baseRoutes(), 'PATCH /admin/users/me': () => fail(409, 'LAST_ADMIN') });
    renderWithProviders(<AdminUsers />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nonaktifkan Admin Utama' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Nonaktifkan' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toMatch(/admin aktif terakhir/);
  });

  it('shows the field errors of the create form next to the input', async () => {
    stubApi({
      ...baseRoutes(),
      'POST /admin/users': () => fail(409, 'EMAIL_EXISTS', [{ field: 'email', message: 'Email sudah terdaftar' }]),
    });
    renderWithProviders(<AdminUsers />);
    fireEvent.click(await screen.findByRole('button', { name: /Tambah Pengguna/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: 'budi@x.id' } });
    fireEvent.change(within(dialog).getByLabelText(/^Nama/), { target: { value: 'Budi Lagi' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Buat Akun' }));
    await waitFor(() => expect(within(dialog).getAllByRole('alert').length).toBeGreaterThan(1));
    expect(within(dialog).getByText('Email sudah terdaftar')).toBeTruthy();
  });

  it('shows an empty state and an error state', async () => {
    stubApi({ 'GET /admin/users': () => ok([], pageMeta(0)) });
    const view = renderWithProviders(<AdminUsers />);
    expect(await screen.findByText('Tidak ada pengguna yang cocok')).toBeTruthy();
    view.unmount();

    stubApi({ 'GET /admin/users': () => fail(500, 'INTERNAL_ERROR') });
    renderWithProviders(<AdminUsers />);
    expect(await screen.findByText('Daftar pengguna tidak dapat dimuat', undefined, { timeout: 3000 })).toBeTruthy();
  });
});
