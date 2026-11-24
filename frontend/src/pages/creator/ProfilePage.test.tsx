import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { AuthProvider } from '../../auth/AuthProvider';
import { AVATAR_MAX_BYTES, ProfilePage, validateAvatarFile } from './ProfilePage';

const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ok = (data: unknown) => res(200, { status: 'success', message: 'ok', data });
const pathOf = (input: RequestInfo | URL) => String(input).replace(/^.*\/api\/v1/, '').split('?')[0];

interface Backend {
  avatar: string | null;
  /** Overrides the answer of PUT /me/avatar (default: success). */
  uploadAnswer?: () => Response | Promise<Response>;
}

const userWith = (avatar: string | null) => ({
  id: 'u1', email: 'siti@x.id', name: 'Siti Aminah', role: 'creator', last_login_at: null, created_at: '2026-01-01T00:00:00Z', avatar_url: avatar,
});

/** Signed-in creator whose `/me` reflects avatar changes, like the real server. */
function stubBackend(state: Backend) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = pathOf(input);
    const method = init?.method ?? 'GET';
    if (path === '/auth/refresh') return ok({ user: userWith(state.avatar), access_token: 'tok', token_type: 'Bearer', expires_in: 3600 });
    if (path === '/me') return ok({ user: userWith(state.avatar), usage: { date: '2026-11-14', daily_limit: 10, used_today: 2, in_flight: 0, remaining_today: 8 } });
    if (path === '/me/avatar' && method === 'PUT') {
      if (state.uploadAnswer) return state.uploadAnswer();
      state.avatar = 'https://files.test/avatars/new.png?sig=1';
      return ok({ user: userWith(state.avatar) });
    }
    if (path === '/me/avatar' && method === 'DELETE') {
      state.avatar = null;
      return ok({ user: userWith(null) });
    }
    return res(404, { status: 'error', message: 'x', error_code: 'NOT_FOUND' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/creator/profile']}>
          <ProfilePage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

const avatarCalls = (f: ReturnType<typeof vi.fn>, method: string) =>
  f.mock.calls.filter((c) => pathOf(c[0]) === '/me/avatar' && (c[1] as RequestInit | undefined)?.method === method);
const pick = (file: File) => fireEvent.change(screen.getByTestId('avatar-input'), { target: { files: [file] } });
const png = (bytes = 1024) => new File([new Uint8Array(bytes)], 'foto.png', { type: 'image/png' });
const ready = () => screen.findByText('Siti Aminah', { selector: '[data-testid="profile-name"]' });

afterEach(() => {
  apiClient.clearSession();
  vi.unstubAllGlobals();
});

describe('validateAvatarFile', () => {
  it('accepts images up to 5 MB and rejects other files', () => {
    expect(validateAvatarFile({ type: 'image/jpeg', size: AVATAR_MAX_BYTES })).toBeNull();
    expect(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toContain('maksimal 5 MB');
    expect(validateAvatarFile({ type: 'application/pdf', size: 10 })).toContain('harus berupa gambar');
  });
});

describe('ProfilePage avatar', () => {
  it('shows the initial when there is no photo, and only offers "Ganti Foto"', async () => {
    stubBackend({ avatar: null });
    renderProfile();
    await ready();
    expect(screen.queryByTestId('user-avatar-img')).toBeNull();
    expect(screen.getAllByText('S').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Ganti Foto/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Hapus Foto/ })).toBeNull();
    expect((screen.getByTestId('avatar-input') as HTMLInputElement).accept).toBe('image/*');
  });

  it('shows the stored photo, falling back to the initial when it fails to load', async () => {
    stubBackend({ avatar: 'https://files.test/avatars/old.png?sig=0' });
    renderProfile();
    const img = await screen.findByAltText('Foto profil Siti Aminah');
    expect(img.getAttribute('src')).toBe('https://files.test/avatars/old.png?sig=0');
    // A broken (e.g. expired signed) URL falls back to the initial.
    fireEvent.error(img);
    await waitFor(() => expect(screen.queryByAltText('Foto profil Siti Aminah')).toBeNull());
  });

  it('uploads a picked image as multipart field "avatar" without a manual Content-Type, then shows it', async () => {
    const fetchMock = stubBackend({ avatar: null });
    renderProfile();
    await ready();
    const file = png();
    pick(file);

    expect(await screen.findByText('Foto profil berhasil diperbarui.')).toBeTruthy();
    const [call] = avatarCalls(fetchMock, 'PUT');
    const init = call[1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('avatar')).toBeInstanceOf(File);
    expect(((init.body as FormData).get('avatar') as File).name).toBe('foto.png');
    expect(Object.keys(init.headers as Record<string, string>).map((h) => h.toLowerCase())).not.toContain('content-type');

    const img = await screen.findByAltText('Foto profil Siti Aminah');
    expect(img.getAttribute('src')).toBe('https://files.test/avatars/new.png?sig=1');
    expect(screen.getByRole('button', { name: /Hapus Foto/ })).toBeTruthy();
  });

  it('shows the busy state while uploading', async () => {
    let answer: (r: Response) => void = () => undefined;
    stubBackend({ avatar: null, uploadAnswer: () => new Promise<Response>((resolve) => (answer = resolve)) });
    renderProfile();
    await ready();
    pick(png());

    const busy = await screen.findByRole('button', { name: /Mengunggah/ });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('avatar-busy')).toBeTruthy();
    answer(ok({ user: userWith(null) }));
    await waitFor(() => expect(screen.queryByTestId('avatar-busy')).toBeNull());
  });

  it('rejects a file over 5 MB or a non-image before uploading', async () => {
    const fetchMock = stubBackend({ avatar: null });
    renderProfile();
    await ready();

    pick(png(AVATAR_MAX_BYTES + 1));
    expect((await screen.findByRole('alert')).textContent).toContain('maksimal 5 MB');

    pick(new File(['%PDF'], 'dok.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('harus berupa gambar'));
    expect(avatarCalls(fetchMock, 'PUT')).toHaveLength(0);
  });

  it('shows a server error through the notice box', async () => {
    stubBackend({ avatar: null, uploadAnswer: () => res(400, { status: 'error', message: 'x', error_code: 'VALIDATION_ERROR' }) });
    renderProfile();
    await ready();
    pick(png());
    expect((await screen.findByRole('alert')).textContent).toContain('belum sesuai');
    expect(screen.queryByTestId('user-avatar-img')).toBeNull();
  });

  it('removes the photo with "Hapus Foto" and falls back to the initial', async () => {
    const fetchMock = stubBackend({ avatar: 'https://files.test/avatars/old.png?sig=0' });
    renderProfile();
    await screen.findByAltText('Foto profil Siti Aminah');

    fireEvent.click(screen.getByRole('button', { name: /Hapus Foto/ }));

    expect(await screen.findByText('Foto profil dihapus.')).toBeTruthy();
    expect(avatarCalls(fetchMock, 'DELETE')).toHaveLength(1);
    expect(screen.queryByAltText('Foto profil Siti Aminah')).toBeNull();
    expect(screen.queryByRole('button', { name: /Hapus Foto/ })).toBeNull();
  });
});
