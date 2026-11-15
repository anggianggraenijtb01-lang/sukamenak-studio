import React, { useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderArchive, Pencil, Plus, Search, Trash2, Upload, UserCheck } from 'lucide-react';
import { adminDeleteReference, adminListReferences, adminListTemplates, adminUpdateReference, adminUploadReference } from '../../api/admin';
import { fileUrl } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import type { AdminReference, AdminReferencesQuery, ReferenceRole } from '../../api/types';
import { toFormError } from '../../components/admin/adminErrors';
import { REFERENCE_ROLE_LABELS, formatDate } from '../../components/admin/format';
import { useDebouncedValue } from '../../components/admin/hooks';
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
  btnPrimary,
  btnSecondary,
  inputCls,
  selectCls,
  textareaCls,
  useNotice,
} from '../../components/admin/ui';

const ROLES = Object.keys(REFERENCE_ROLE_LABELS) as ReferenceRole[];
const PAGE_SIZE = 12;
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/** `human_model` references need a non-empty consent note. Shared by the upload and edit forms. */
export function consentNoteError(role: ReferenceRole, note: string): string | null {
  return role === 'human_model' && !note.trim() ? 'Catatan persetujuan wajib diisi untuk foto model manusia (siapa, kapan, dan untuk keperluan apa persetujuan diberikan).' : null;
}

const useTemplateChoices = () =>
  useQuery({
    queryKey: queryKeys.admin.templates.list({ limit: 100 }),
    queryFn: ({ signal }) => adminListTemplates({ limit: 100 }, signal),
    staleTime: 60_000,
  });

const ReferenceFormModal: React.FC<{
  reference?: AdminReference;
  onClose: () => void;
  onSaved: (message: string) => void;
}> = ({ reference, onClose, onSaved }) => {
  const editing = !!reference;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const templates = useTemplateChoices();
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState<ReferenceRole>(reference?.role ?? 'product');
  const [label, setLabel] = useState(reference?.label ?? '');
  const [consent, setConsent] = useState(reference?.consent_note ?? '');
  const [templateId, setTemplateId] = useState(reference?.template?.id ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!editing) {
      if (!file) local.file = 'Pilih file gambar terlebih dahulu.';
      else if (!ACCEPTED.includes(file.type)) local.file = 'Format harus JPEG, PNG, atau WebP.';
      else if (file.size > MAX_BYTES) local.file = 'Ukuran file maksimal 8 MB.';
    }
    const consentMsg = consentNoteError(role, consent);
    if (consentMsg) local.consent_note = consentMsg;
    if (Object.keys(local).length > 0) {
      setError({ message: 'Periksa kembali isian yang ditandai.', fields: local });
      return;
    }

    setPending(true);
    setError(null);
    try {
      if (reference) {
        const body: Parameters<typeof adminUpdateReference>[1] = {};
        if (role !== reference.role) body.role = role;
        if ((label.trim() || null) !== reference.label) body.label = label.trim() || null;
        if ((consent.trim() || null) !== reference.consent_note) body.consent_note = consent.trim() || null;
        if ((templateId || null) !== (reference.template?.id ?? null)) body.template_id = templateId || null;
        if (Object.keys(body).length === 0) {
          onClose();
          return;
        }
        await adminUpdateReference(reference.id, body);
        onSaved('Referensi diperbarui.');
      } else {
        await adminUploadReference({
          file: file!,
          role,
          ...(label.trim() ? { label: label.trim() } : {}),
          ...(consent.trim() ? { consent_note: consent.trim() } : {}),
          ...(templateId ? { template_id: templateId } : {}),
        });
        onSaved('Referensi berhasil diunggah ke library.');
      }
    } catch (err) {
      setError(toFormError(err));
      setPending(false);
    }
  };

  const fe = (f: string) => error?.fields[f] ?? null;

  return (
    <Modal
      title={editing ? 'Edit Referensi' : 'Unggah Referensi Library'}
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>
            Batal
          </button>
          <button type="submit" form="reference-form" disabled={pending} className={btnPrimary}>
            {pending && <Spinner />}
            {editing ? 'Simpan' : 'Unggah'}
          </button>
        </>
      }
    >
      <form id="reference-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && <Banner kind="error">{error.message}</Banner>}
        {!editing && (
          <Field label="File gambar" htmlFor="ref-file" error={fe('file')} hint="JPEG, PNG, atau WebP, maksimal 8 MB. Data lokasi (EXIF) dihapus dan gambar dikecilkan otomatis." required>
            <input
              ref={fileRef}
              id="ref-file"
              type="file"
              accept={ACCEPTED.join(',')}
              disabled={pending}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-slate-600 file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-[#EFF6FF] file:text-[#2563EB] file:font-bold file:cursor-pointer"
            />
          </Field>
        )}
        {editing && reference && (
          <div className="flex items-center gap-3">
            <img src={fileUrl(reference.url)} alt={reference.label ?? 'Referensi'} className="w-16 h-20 rounded-xl object-cover border border-slate-200" />
            <p className="text-xs text-slate-500">Gambar tidak dapat diganti. Hapus referensi ini dan unggah yang baru bila perlu.</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Peran" htmlFor="ref-role" error={fe('role')} required>
            <select id="ref-role" value={role} onChange={(e) => setRole(e.target.value as ReferenceRole)} disabled={pending} className={selectCls}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {REFERENCE_ROLE_LABELS[r]} ({r})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Label" htmlFor="ref-label" error={fe('label')}>
            <input id="ref-label" value={label} onChange={(e) => setLabel(e.target.value)} disabled={pending} maxLength={120} className={inputCls} placeholder="Contoh: Keripik tempe iris" />
          </Field>
        </div>
        <Field label="Terkait template (opsional)" htmlFor="ref-template" error={fe('template_id') ?? fe('template_slug')} hint="Referensi terkait template ditawarkan pada template itu di studio.">
          <select id="ref-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={pending} className={selectCls}>
            <option value="">Semua template</option>
            {templates.data?.items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.slug})
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={role === 'human_model' ? 'Catatan persetujuan (wajib)' : 'Catatan persetujuan (opsional)'}
          htmlFor="ref-consent"
          error={fe('consent_note')}
          hint={
            role === 'human_model'
              ? 'Foto model manusia hanya boleh disimpan bila ada persetujuan. Tulis siapa yang menyetujui, kapan, dan untuk apa.'
              : 'Isi bila ada persetujuan atau lisensi yang perlu dicatat.'
          }
          required={role === 'human_model'}
        >
          <textarea id="ref-consent" rows={3} value={consent} onChange={(e) => setConsent(e.target.value)} disabled={pending} className={textareaCls} maxLength={500} />
        </Field>
      </form>
    </Modal>
  );
};

export const AdminReferences: React.FC = () => {
  const queryClient = useQueryClient();
  const { notice, show, clear } = useNotice();
  const [role, setRole] = useState('');
  const [templateSlug, setTemplateSlug] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ type: 'upload' } | { type: 'edit'; ref: AdminReference } | { type: 'delete'; ref: AdminReference } | null>(null);

  const debounced = useDebouncedValue(search.trim());
  const query: AdminReferencesQuery = {
    page,
    limit: PAGE_SIZE,
    role: (role || undefined) as ReferenceRole | undefined,
    template: templateSlug || undefined,
    search: debounced || undefined,
  };
  const templates = useTemplateChoices();
  const references = useQuery({
    queryKey: queryKeys.admin.references.list(query),
    queryFn: ({ signal }) => adminListReferences(query, signal),
    placeholderData: keepPreviousData,
    // Image URLs are signed and expire (15 min by default): refetch when the page is revisited, never serve them for long.
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const setFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.admin.references.all });

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={<FolderArchive className="w-6 h-6" />}
        title={
          <>
            Bank Referensi <span className="text-[#2563EB]">Visual</span>
          </>
        }
        description="Library foto referensi yang boleh dipakai kreator. Foto model manusia wajib disertai catatan persetujuan."
        actions={
          <button type="button" onClick={() => setDialog({ type: 'upload' })} className={btnPrimary}>
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>Unggah Referensi</span>
          </button>
        }
      />

      <NoticeBanner notice={notice} onDismiss={clear} />

      <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setFilter(() => setSearch(e.target.value))} placeholder="Cari label referensi..." aria-label="Cari referensi" className={`${inputCls} !pl-10`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={role} onChange={(e) => setFilter(() => setRole(e.target.value))} aria-label="Filter peran" className={`${selectCls} !w-auto`}>
            <option value="">Semua peran</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {REFERENCE_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <select value={templateSlug} onChange={(e) => setFilter(() => setTemplateSlug(e.target.value))} aria-label="Filter template" className={`${selectCls} !w-auto max-w-[14rem]`}>
            <option value="">Semua template</option>
            {templates.data?.items.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {references.isPending && <LoadingBlock label="Memuat referensi..." />}
      {references.isError && !references.data && <ErrorState error={references.error} onRetry={() => void references.refetch()} title="Library tidak dapat dimuat" />}
      {references.data && references.data.items.length === 0 && (
        <EmptyState
          icon={<FolderArchive className="w-6 h-6" />}
          title="Belum ada referensi"
          hint="Unggah foto produk, pencahayaan, atau gaya yang boleh dipakai kreator."
          action={
            <button type="button" onClick={() => setDialog({ type: 'upload' })} className={btnPrimary}>
              <Plus className="w-4 h-4" aria-hidden="true" />
              Unggah Referensi
            </button>
          }
        />
      )}

      {references.data && references.data.items.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${references.isFetching ? 'opacity-70' : ''}`}>
          {references.data.items.map((item) => (
            <div key={item.id} className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-4 shadow-xs hover:shadow-xl transition-all space-y-3.5 flex flex-col justify-between">
              <div>
                <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 border border-slate-100 mb-3">
                  <img src={fileUrl(item.url)} alt={item.label ?? `Referensi ${item.role}`} loading="lazy" className="w-full h-full object-cover" />
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-white/95 text-[10px] font-black text-[#2563EB] shadow-xs">{REFERENCE_ROLE_LABELS[item.role]}</span>
                  {item.width && item.height && (
                    <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/60 text-[9px] font-bold text-white">
                      {item.width}&times;{item.height}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-[#0F172A] line-clamp-1">{item.label || 'Tanpa label'}</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Template: <strong className="text-[#0F172A]">{item.template?.name ?? 'Semua'}</strong>
                </p>
                {item.consent_note && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-emerald-700">
                    <UserCheck className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
                    <span className="line-clamp-3">{item.consent_note}</span>
                  </p>
                )}
              </div>
              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-400">
                  {formatDate(item.created_at)} &bull; {Math.max(1, Math.round(item.bytes / 1024))} KB
                  {item.role === 'human_model' && (
                    <span className="block">
                      <Badge tone="amber">Model manusia</Badge>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setDialog({ type: 'edit', ref: item })} className="p-2 rounded-full hover:bg-blue-50 text-slate-600 hover:text-[#2563EB] cursor-pointer" title="Edit" aria-label={`Edit referensi ${item.label ?? item.role}`}>
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setDialog({ type: 'delete', ref: item })} className="p-2 rounded-full hover:bg-red-50 text-slate-600 hover:text-red-600 cursor-pointer" title="Hapus" aria-label={`Hapus referensi ${item.label ?? item.role}`}>
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination meta={references.data?.meta} onPage={setPage} busy={references.isFetching} noun="referensi" />

      {dialog?.type === 'upload' && (
        <ReferenceFormModal
          onClose={() => setDialog(null)}
          onSaved={(msg) => {
            setDialog(null);
            show('success', msg);
            refresh();
          }}
        />
      )}
      {dialog?.type === 'edit' && (
        <ReferenceFormModal
          reference={dialog.ref}
          onClose={() => setDialog(null)}
          onSaved={(msg) => {
            setDialog(null);
            show('success', msg);
            refresh();
          }}
        />
      )}
      {dialog?.type === 'delete' && (
        <ConfirmModal
          title="Hapus referensi?"
          confirmLabel="Hapus Referensi"
          danger
          message={<>Referensi <strong>{dialog.ref.label ?? dialog.ref.role}</strong> dan file gambarnya akan dihapus permanen dari penyimpanan.</>}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await adminDeleteReference(dialog.ref.id);
            show('success', 'Referensi dihapus.');
            refresh();
          }}
        />
      )}
    </div>
  );
};
export default AdminReferences;
