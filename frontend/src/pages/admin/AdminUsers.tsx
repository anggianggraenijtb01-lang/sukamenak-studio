import React, { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, LogOut, Pencil, Plus, Search, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import {
  adminCreateUser,
  adminDeleteUser,
  adminListUsers,
  adminResetUserPassword,
  adminRevokeUserSessions,
  adminUpdateUser,
} from '../../api/admin';
import { queryKeys } from '../../api/queryKeys';
import type { AdminUser, AdminUsersQuery, Role } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { TempPasswordModal } from '../../components/admin/TempPasswordModal';
import { toFormError, userActionErrorMessage } from '../../components/admin/adminErrors';
import { formatDateTime } from '../../components/admin/format';
import { triState, useDebouncedValue } from '../../components/admin/hooks';
import {
  Badge,
  Banner,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  NoticeBanner,
  PageHeader,
  Pagination,
  Spinner,
  btnOutline,
  btnPrimary,
  btnSecondary,
  inputCls,
  selectCls,
  useNotice,
} from '../../components/admin/ui';

const PAGE_SIZE = 20;

interface TempSecret {
  email: string;
  password: string;
  title: string;
}

type Dialog =
  | { type: 'create' }
  | { type: 'edit'; user: AdminUser }
  | { type: 'reset'; user: AdminUser }
  | { type: 'revoke'; user: AdminUser }
  | { type: 'deactivate'; user: AdminUser }
  | { type: 'delete'; user: AdminUser };

/** Empty string -> null (use the global default), otherwise a non-negative integer. */
function parseLimit(raw: string): { value: number | null; error?: string } {
  const t = raw.trim();
  if (t === '') return { value: null };
  if (!/^\d+$/.test(t) || Number(t) > 1000) return { value: null, error: 'Isi bilangan bulat 0-1000, atau kosongkan untuk memakai batas bawaan.' };
  return { value: Number(t) };
}

// ---------------------------------------------------------------------------------------------------
// Create / edit form
// ---------------------------------------------------------------------------------------------------

const UserFormModal: React.FC<{
  user?: AdminUser;
  onClose: () => void;
  onSaved: (message: string, secret?: TempSecret) => void;
}> = ({ user, onClose, onSaved }) => {
  const editing = !!user;
  const [email, setEmail] = useState(user?.email ?? '');
  const [name, setName] = useState(user?.name ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'creator');
  const [password, setPassword] = useState('');
  const [limit, setLimit] = useState(user?.daily_limit_override != null ? String(user.daily_limit_override) : '');
  const [isActive, setIsActive] = useState(user?.is_active ?? true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    const parsed = parseLimit(limit);
    if (parsed.error) errors.daily_limit_override = parsed.error;
    if (name.trim().length < 2) errors.name = 'Nama minimal 2 karakter.';
    if (!editing && !email.trim()) errors.email = 'Email wajib diisi.';
    if (!editing && password && password.length < 8) errors.password = 'Kata sandi minimal 8 karakter (atau kosongkan agar dibuat otomatis).';
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    setError(null);
    try {
      if (user) {
        const body: Parameters<typeof adminUpdateUser>[1] = {};
        if (name.trim() !== user.name) body.name = name.trim();
        if (role !== user.role) body.role = role;
        if (isActive !== user.is_active) body.is_active = isActive;
        if (parsed.value !== user.daily_limit_override) body.daily_limit_override = parsed.value;
        if (Object.keys(body).length === 0) {
          onClose();
          return;
        }
        await adminUpdateUser(user.id, body);
        onSaved(`Data ${name.trim()} berhasil diperbarui.`);
      } else {
        const res = await adminCreateUser({
          email: email.trim(),
          name: name.trim(),
          role,
          ...(password ? { password } : {}),
          ...(parsed.value !== null ? { daily_limit_override: parsed.value } : {}),
        });
        onSaved(
          `Akun ${res.user.email} berhasil dibuat.`,
          res.temporary_password ? { email: res.user.email, password: res.temporary_password, title: 'Kata sandi sementara akun baru' } : undefined,
        );
      }
    } catch (err) {
      const fe = toFormError(err);
      if (user) fe.message = userActionErrorMessage(err, role !== user.role && user.role === 'admin' ? 'demote' : !isActive && user.is_active ? 'deactivate' : 'update');
      setError(fe);
      setPending(false);
    }
  };

  const fieldError = (f: string) => localErrors[f] ?? error?.fields[f] ?? null;

  return (
    <Modal
      title={editing ? `Edit Pengguna: ${user.name}` : 'Tambah Pengguna Baru'}
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>
            Batal
          </button>
          <button type="submit" form="user-form" disabled={pending} className={btnPrimary}>
            {pending && <Spinner />}
            {editing ? 'Simpan Perubahan' : 'Buat Akun'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && <Banner kind="error">{error.message}</Banner>}
        <Field label="Email" htmlFor="user-email" error={fieldError('email')} required={!editing}>
          <input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={editing || pending}
            autoComplete="off"
            className={inputCls}
            placeholder="nama@contoh.id"
          />
        </Field>
        <Field label="Nama" htmlFor="user-name" error={fieldError('name')} required>
          <input id="user-name" value={name} onChange={(e) => setName(e.target.value)} disabled={pending} className={inputCls} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Peran" htmlFor="user-role" error={fieldError('role')}>
            <select id="user-role" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={pending} className={selectCls}>
              <option value="creator">Kreator</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field
            label="Batas harian khusus"
            htmlFor="user-limit"
            error={fieldError('daily_limit_override')}
            hint="Kosongkan untuk memakai batas bawaan global."
          >
            <input
              id="user-limit"
              inputMode="numeric"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              disabled={pending}
              className={inputCls}
              placeholder="Bawaan"
            />
          </Field>
        </div>
        {!editing && (
          <Field
            label="Kata sandi awal (opsional)"
            htmlFor="user-password"
            error={fieldError('password')}
            hint="Kosongkan agar sistem membuat kata sandi sementara acak yang ditampilkan sekali."
          >
            <input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              autoComplete="new-password"
              className={inputCls}
            />
          </Field>
        )}
        {editing && (
          <label className="flex items-center gap-2.5 text-xs font-bold text-[#0F172A] cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={pending} className="w-4 h-4 accent-[#2563EB]" />
            Akun aktif (nonaktif = tidak bisa masuk, berlaku segera)
          </label>
        )}
      </form>
    </Modal>
  );
};

// ---------------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------------

export const AdminUsers: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const { notice, show, clear } = useNotice();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  // The temporary password lives here only while its dialog is open; closing the dialog drops it.
  const [secret, setSecret] = useState<TempSecret | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim());
  const query: AdminUsersQuery = {
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    role: (role || undefined) as Role | undefined,
    active: triState(active),
  };

  const users = useQuery({
    queryKey: queryKeys.admin.users.list(query),
    queryFn: ({ signal }) => adminListUsers(query, signal),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard.all });
  };

  const setFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  const meta = users.data?.meta;
  const warnings = meta?.warnings ?? [];

  const closeDialog = () => setDialog(null);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        icon={<Users className="w-5 h-5" />}
        title={
          <>
            Manajemen <span className="text-[#2563EB]">Pengguna</span>
          </>
        }
        description="Kelola akun, peran, status aktif, dan batas harian. Kata sandi sementara hanya tampil sekali."
        actions={
          <button type="button" onClick={() => setDialog({ type: 'create' })} className={btnPrimary}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            Tambah Pengguna
          </button>
        }
      />

      <NoticeBanner notice={notice} onDismiss={clear} />

      {warnings.length > 0 && (
        <Banner kind="warning">
          <div>Peringatan admin: {meta?.active_admins != null && <>tersisa {meta.active_admins} admin aktif.</>}</div>
          <ul className="list-disc pl-4 mt-1 font-semibold">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Banner>
      )}

      {/* Filters */}
      <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-slate-200/90 px-4 py-3.5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-3.5" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setFilter(() => setSearch(e.target.value))}
            placeholder="Cari nama atau email..."
            aria-label="Cari pengguna"
            className={`${inputCls} !pl-9 !py-2`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={role}
            onChange={(e) => setFilter(() => setRole(e.target.value))}
            aria-label="Filter peran"
            className={`${selectCls} !w-auto !py-2`}
          >
            <option value="">Semua peran</option>
            <option value="creator">Kreator</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={active}
            onChange={(e) => setFilter(() => setActive(e.target.value))}
            aria-label="Filter status"
            className={`${selectCls} !w-auto !py-2`}
          >
            <option value="">Semua status</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {users.isPending && <LoadingBlock label="Memuat pengguna..." />}
        {users.isError && !users.data && <ErrorState error={users.error} onRetry={() => void users.refetch()} title="Daftar pengguna tidak dapat dimuat" />}
        {users.data && users.data.items.length === 0 && (
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title="Tidak ada pengguna yang cocok"
            hint="Ubah kata kunci atau filter, atau tambahkan pengguna baru."
          />
        )}
        {users.data && users.data.items.length > 0 && (
          <div className={`overflow-x-auto ${users.isFetching ? 'opacity-70' : ''}`} tabIndex={0} role="region" aria-label="Tabel pengguna (geser untuk melihat kolom lain)">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Peran</th>
                  <th className="py-3 px-4">Batas Harian</th>
                  <th className="py-3 px-4">Status Akun</th>
                  <th className="py-3 px-4">Login Terakhir</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.data.items.map((u) => {
                  const isSelf = me?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-extrabold text-[#0F172A] text-xs sm:text-sm flex items-center gap-2">
                          {u.name}
                          {isSelf && <Badge tone="dark">Anda</Badge>}
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium">{u.email}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge tone={u.role === 'admin' ? 'dark' : 'blue'}>{u.role === 'admin' ? 'Admin' : 'Kreator'}</Badge>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px]">
                        {u.daily_limit_override != null ? `${u.daily_limit_override} / hari` : <span className="text-slate-500">Bawaan</span>}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge tone={u.is_active ? 'blue' : 'slate'}>{u.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-[11px] text-slate-500">{u.last_login_at ? formatDateTime(u.last_login_at) : 'Belum pernah'}</td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex flex-wrap items-center gap-1.5 justify-end">
                          <button type="button" onClick={() => setDialog({ type: 'edit', user: u })} className={btnOutline} aria-label={`Edit ${u.name}`}>
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            Edit
                          </button>
                          <button type="button" onClick={() => setDialog({ type: 'reset', user: u })} className={btnOutline} aria-label={`Reset kata sandi ${u.name}`}>
                            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                            Reset Sandi
                          </button>
                          <button type="button" onClick={() => setDialog({ type: 'revoke', user: u })} className={btnOutline} aria-label={`Cabut sesi ${u.name}`}>
                            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                            Cabut Sesi
                          </button>
                          {u.is_active ? (
                            <button type="button" onClick={() => setDialog({ type: 'deactivate', user: u })} className={btnOutline} aria-label={`Nonaktifkan ${u.name}`}>
                              <UserX className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                              Nonaktifkan
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await adminUpdateUser(u.id, { is_active: true });
                                  show('success', `Akun ${u.name} diaktifkan kembali.`);
                                  refresh();
                                } catch (err) {
                                  show('error', userActionErrorMessage(err, 'update'));
                                }
                              }}
                              className={btnOutline}
                              aria-label={`Aktifkan ${u.name}`}
                            >
                              <UserCheck className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                              Aktifkan
                            </button>
                          )}
                          <button type="button" onClick={() => setDialog({ type: 'delete', user: u })} className={`${btnOutline} hover:!border-red-400 hover:!text-red-600`} aria-label={`Hapus ${u.name}`}>
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination meta={meta} onPage={setPage} busy={users.isFetching} noun="pengguna" />

      {/* Dialogs */}
      {dialog?.type === 'create' && (
        <UserFormModal
          onClose={closeDialog}
          onSaved={(msg, tmp) => {
            closeDialog();
            show('success', msg);
            if (tmp) setSecret(tmp);
            refresh();
          }}
        />
      )}
      {dialog?.type === 'edit' && (
        <UserFormModal
          user={dialog.user}
          onClose={closeDialog}
          onSaved={(msg) => {
            closeDialog();
            show('success', msg);
            refresh();
          }}
        />
      )}
      {dialog?.type === 'reset' && (
        <ConfirmModal
          title="Reset kata sandi?"
          confirmLabel="Reset Kata Sandi"
          danger
          message={
            <>
              Kata sandi <strong>{dialog.user.name}</strong> ({dialog.user.email}) akan diganti dengan kata sandi sementara acak, dan <strong>semua sesi aktifnya dicabut</strong>.
              Kata sandi baru hanya ditampilkan sekali.
            </>
          }
          formatError={(err) => userActionErrorMessage(err, 'reset-password')}
          onClose={closeDialog}
          onConfirm={async () => {
            const res = await adminResetUserPassword(dialog.user.id);
            setSecret({ email: res.user.email, password: res.temporary_password, title: 'Kata sandi sementara baru' });
            show('success', `Kata sandi ${res.user.name} direset dan semua sesinya dicabut.`);
            refresh();
          }}
        />
      )}
      {dialog?.type === 'revoke' && (
        <ConfirmModal
          title="Cabut semua sesi?"
          confirmLabel="Cabut Sesi"
          message={
            <>
              <strong>{dialog.user.name}</strong> akan keluar dari semua perangkat dan harus masuk lagi.
            </>
          }
          formatError={(err) => userActionErrorMessage(err, 'revoke')}
          onClose={closeDialog}
          onConfirm={async () => {
            const res = await adminRevokeUserSessions(dialog.user.id);
            show('success', `${res.revoked_sessions} sesi ${dialog.user.name} dicabut.`);
          }}
        />
      )}
      {dialog?.type === 'deactivate' && (
        <ConfirmModal
          title="Nonaktifkan akun?"
          confirmLabel="Nonaktifkan"
          danger
          message={
            <>
              <strong>{dialog.user.name}</strong> tidak akan bisa masuk atau memakai studio mulai permintaan berikutnya, dan sesinya dicabut. Akun bisa diaktifkan lagi kapan saja.
            </>
          }
          formatError={(err) => userActionErrorMessage(err, dialog.user.role === 'admin' ? 'deactivate' : 'update')}
          onClose={closeDialog}
          onConfirm={async () => {
            await adminUpdateUser(dialog.user.id, { is_active: false });
            show('success', `Akun ${dialog.user.name} dinonaktifkan.`);
            refresh();
          }}
        />
      )}
      {dialog?.type === 'delete' && (
        <ConfirmModal
          title="Hapus pengguna?"
          confirmLabel="Hapus Pengguna"
          danger
          message={
            <>
              Akun <strong>{dialog.user.name}</strong> ({dialog.user.email}) akan dihapus dan datanya dianonimkan. Email dibebaskan dan konten pribadinya dihapus.{' '}
              <strong>Tindakan ini tidak dapat dibatalkan.</strong>
            </>
          }
          formatError={(err) => userActionErrorMessage(err, 'delete')}
          onClose={closeDialog}
          onConfirm={async () => {
            await adminDeleteUser(dialog.user.id);
            show('success', `Akun ${dialog.user.name} dihapus.`);
            refresh();
          }}
        />
      )}
      {secret && <TempPasswordModal email={secret.email} password={secret.password} title={secret.title} onClose={() => setSecret(null)} />}
    </div>
  );
};
export default AdminUsers;
