import React, { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Eye, EyeOff, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import {
  adminCreateGalleryFromGeneration,
  adminCreateGalleryFromUpload,
  adminDeleteGalleryItem,
  adminGetTemplate,
  adminListGallery,
  adminListGenerations,
  adminListTemplates,
  adminUpdateGalleryItem,
} from '../../api/admin';
import { fileUrl } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import type { AdminGalleryItem, AdminGalleryQuery } from '../../api/types';
import { toFormError } from '../../components/admin/adminErrors';
import { formatDate, formatNumber, shortId } from '../../components/admin/format';
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
  btnPrimary,
  btnSecondary,
  inputCls,
  selectCls,
  textareaCls,
  useNotice,
} from '../../components/admin/ui';

const PAGE_SIZE = 12;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

const parseSort = (raw: string): { value: number | undefined; error?: string } => {
  const t = raw.trim();
  if (t === '') return { value: undefined };
  if (!/^-?\d+$/.test(t)) return { value: undefined, error: 'Bilangan bulat.' };
  return { value: Number(t) };
};

// ---------------------------------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------------------------------

const CreateModal: React.FC<{ onClose: () => void; onSaved: (msg: string) => void }> = ({ onClose, onSaved }) => {
  const [source, setSource] = useState<'generation' | 'upload'>('generation');
  const [title, setTitle] = useState('');
  const [generationId, setGenerationId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [slotValues, setSlotValues] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState('');
  const [featured, setFeatured] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [sortOrder, setSortOrder] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);

  const doneGenerations = useQuery({
    queryKey: queryKeys.admin.generations.list({ status: 'done', available: true, limit: 30 }),
    queryFn: ({ signal }) => adminListGenerations({ status: 'done', available: true, limit: 30 }, signal),
    staleTime: 60_000,
    enabled: source === 'generation',
  });
  const templates = useQuery({
    queryKey: queryKeys.admin.templates.list({ limit: 100 }),
    queryFn: ({ signal }) => adminListTemplates({ limit: 100 }, signal),
    staleTime: 60_000,
    enabled: source === 'upload',
  });
  const template = useQuery({
    queryKey: queryKeys.admin.templates.detail(templateId),
    queryFn: ({ signal }) => adminGetTemplate(templateId, signal),
    enabled: source === 'upload' && !!templateId,
    staleTime: 30_000,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    const sort = parseSort(sortOrder);
    if (sort.error) local.sort_order = sort.error;
    if (title.trim().length < 2) local.title = 'Judul minimal 2 karakter.';
    if (source === 'generation') {
      if (!UUID_RE.test(generationId.trim())) local.generation_id = 'Pilih generasi selesai atau tempel ID generasi (UUID) dari halaman Log.';
    } else {
      if (!file) local.file = 'Pilih file gambar.';
      else if (!ACCEPTED.includes(file.type)) local.file = 'Format harus JPEG, PNG, atau WebP.';
      if (!templateId) local.template_id = 'Pilih template.';
    }
    if (Object.keys(local).length > 0) {
      setError({ message: 'Periksa kembali isian yang ditandai.', fields: local });
      return;
    }

    setPending(true);
    setError(null);
    try {
      if (source === 'generation') {
        await adminCreateGalleryFromGeneration({
          generation_id: generationId.trim(),
          title: title.trim(),
          is_featured: featured,
          is_hidden: hidden,
          ...(sort.value !== undefined ? { sort_order: sort.value } : {}),
        });
      } else {
        const values: Record<string, string> = {};
        for (const [k, v] of Object.entries(slotValues)) if (v.trim()) values[k] = v.trim();
        await adminCreateGalleryFromUpload({
          file: file!,
          template_id: templateId,
          title: title.trim(),
          slot_values: values,
          ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
          is_featured: featured,
          is_hidden: hidden,
          ...(sort.value !== undefined ? { sort_order: sort.value } : {}),
        });
      }
      onSaved('Item galeri dibuat. Teks prompt tampilan disusun otomatis oleh server dari isian slot dan catatan.');
    } catch (err) {
      setError(toFormError(err));
      setPending(false);
    }
  };

  const fe = (f: string) => error?.fields[f] ?? null;

  return (
    <Modal
      title="Tambah Item Galeri"
      size="lg"
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>
            Batal
          </button>
          <button type="submit" form="curation-create" disabled={pending} className={btnPrimary}>
            {pending && <Spinner />}
            Tambahkan ke Galeri
          </button>
        </>
      }
    >
      <form id="curation-create" onSubmit={submit} className="space-y-4" noValidate>
        {error && <Banner kind="error">{error.message}</Banner>}
        <div className="flex gap-2 p-1 rounded-2xl bg-slate-100 w-fit" role="tablist" aria-label="Sumber item">
          {(
            [
              ['generation', 'Dari generasi'],
              ['upload', 'Dari unggahan gambar'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={source === id}
              onClick={() => setSource(id)}
              disabled={pending}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${source === id ? 'bg-white text-[#2563EB] shadow-xs' : 'text-slate-500 hover:text-[#0F172A]'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <Field label="Judul" htmlFor="cur-title" error={fe('title')} required>
          <input id="cur-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={pending} maxLength={120} className={inputCls} />
        </Field>

        {source === 'generation' ? (
          <>
            <Field label="Pilih dari generasi selesai terbaru" htmlFor="cur-gen-pick" hint="Hanya generasi berstatus selesai dan belum dibersihkan yang dapat dikurasi.">
              <select
                id="cur-gen-pick"
                value={UUID_RE.test(generationId) && doneGenerations.data?.items.some((g) => g.id === generationId) ? generationId : ''}
                onChange={(e) => setGenerationId(e.target.value)}
                disabled={pending || doneGenerations.isPending}
                className={selectCls}
              >
                <option value="">{doneGenerations.isPending ? 'Memuat...' : 'Pilih generasi...'}</option>
                {doneGenerations.data?.items.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.template?.name ?? 'Tanpa template'} &middot; {g.user?.name ?? 'Akun dihapus'} &middot; {formatDate(g.created_at)} &middot; {shortId(g.id)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ID generasi" htmlFor="cur-gen-id" error={fe('generation_id')} required>
              <input id="cur-gen-id" value={generationId} onChange={(e) => setGenerationId(e.target.value)} disabled={pending} className={`${inputCls} font-mono`} placeholder="UUID generasi" autoComplete="off" />
            </Field>
          </>
        ) : (
          <>
            <Field label="File gambar" htmlFor="cur-file" error={fe('file')} required>
              <input
                id="cur-file"
                type="file"
                accept={ACCEPTED.join(',')}
                disabled={pending}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-slate-600 file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-[#EFF6FF] file:text-[#2563EB] file:font-bold file:cursor-pointer"
              />
            </Field>
            <Field label="Template" htmlFor="cur-template" error={fe('template_id') ?? fe('template_slug')} required>
              <select
                id="cur-template"
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  setSlotValues({});
                }}
                disabled={pending}
                className={selectCls}
              >
                <option value="">Pilih template...</option>
                {templates.data?.items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.slug})
                  </option>
                ))}
              </select>
            </Field>
            {templateId && template.isPending && <LoadingBlock label="Memuat slot template..." className="!py-3" />}
            {template.data && template.data.slots.length > 0 && (
              <fieldset className="space-y-3 p-3.5 rounded-2xl border border-slate-200 bg-[#F8FAFC]">
                <legend className="px-1 text-xs font-bold text-[#0F172A]">Isian slot (membentuk teks prompt tampilan)</legend>
                {template.data.slots.map((s) => (
                  <Field key={s.id} label={`${s.label}${s.required ? ' *' : ''}`} htmlFor={`cur-slot-${s.key}`} error={fe(`slot_values.${s.key}`)}>
                    <input
                      id={`cur-slot-${s.key}`}
                      value={slotValues[s.key] ?? ''}
                      onChange={(e) => setSlotValues((p) => ({ ...p, [s.key]: e.target.value }))}
                      disabled={pending}
                      maxLength={s.max_length ?? 500}
                      className={inputCls}
                    />
                  </Field>
                ))}
              </fieldset>
            )}
            <Field label="Catatan (opsional)" htmlFor="cur-remarks" error={fe('remarks')}>
              <textarea id="cur-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={pending} maxLength={1000} className={textareaCls} />
            </Field>
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <Field label="Urutan" htmlFor="cur-sort" error={fe('sort_order')} hint="Angka kecil tampil lebih dulu.">
            <input id="cur-sort" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} disabled={pending} className={inputCls} placeholder="0" />
          </Field>
          <label className="flex items-center gap-2 text-xs font-bold text-[#0F172A] cursor-pointer pb-2.5">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} disabled={pending} className="w-4 h-4 accent-[#2563EB]" />
            Unggulan
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-[#0F172A] cursor-pointer pb-2.5">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} disabled={pending} className="w-4 h-4 accent-[#2563EB]" />
            Sembunyikan dari publik
          </label>
        </div>
      </form>
    </Modal>
  );
};

// ---------------------------------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------------------------------

const EditModal: React.FC<{ item: AdminGalleryItem; onClose: () => void; onSaved: () => void }> = ({ item, onClose, onSaved }) => {
  const [title, setTitle] = useState(item.title);
  const [displayPrompt, setDisplayPrompt] = useState(item.display_prompt);
  const [featured, setFeatured] = useState(item.is_featured);
  const [hidden, setHidden] = useState(item.is_hidden);
  const [sortOrder, setSortOrder] = useState(String(item.sort_order));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    const sort = parseSort(sortOrder);
    if (sort.error || sort.value === undefined) local.sort_order = 'Bilangan bulat.';
    if (title.trim().length < 2) local.title = 'Judul minimal 2 karakter.';
    if (/\[\s*_{2,}\s*\]|\{\{/.test(displayPrompt)) local.display_prompt = 'Teks tampilan tidak boleh memuat penanda [___] atau {{...}}.';
    if (Object.keys(local).length > 0) {
      setError({ message: 'Periksa kembali isian yang ditandai.', fields: local });
      return;
    }
    const body: Parameters<typeof adminUpdateGalleryItem>[1] = {};
    if (title.trim() !== item.title) body.title = title.trim();
    if (displayPrompt !== item.display_prompt) body.display_prompt = displayPrompt;
    if (featured !== item.is_featured) body.is_featured = featured;
    if (hidden !== item.is_hidden) body.is_hidden = hidden;
    if (sort.value !== item.sort_order) body.sort_order = sort.value;
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    setPending(true);
    setError(null);
    try {
      await adminUpdateGalleryItem(item.id, body);
      onSaved();
    } catch (err) {
      setError(toFormError(err));
      setPending(false);
    }
  };

  const fe = (f: string) => error?.fields[f] ?? null;

  return (
    <Modal
      title={`Edit Item Galeri`}
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>
            Batal
          </button>
          <button type="submit" form="curation-edit" disabled={pending} className={btnPrimary}>
            {pending && <Spinner />}
            Simpan
          </button>
        </>
      }
    >
      <form id="curation-edit" onSubmit={submit} className="space-y-4" noValidate>
        {error && <Banner kind="error">{error.message}</Banner>}
        <Field label="Judul" htmlFor="cur-edit-title" error={fe('title')} required>
          <input id="cur-edit-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={pending} maxLength={120} className={inputCls} />
        </Field>
        <Field
          label="Teks prompt tampilan"
          htmlFor="cur-edit-prompt"
          error={fe('display_prompt')}
          hint="Teks yang dilihat publik. Tidak boleh memuat penanda [___], {{...}}, potongan core prompt, atau kata terlarang; server memeriksanya."
        >
          <textarea id="cur-edit-prompt" rows={4} value={displayPrompt} onChange={(e) => setDisplayPrompt(e.target.value)} disabled={pending} className={textareaCls} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <Field label="Urutan" htmlFor="cur-edit-sort" error={fe('sort_order')}>
            <input id="cur-edit-sort" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} disabled={pending} className={inputCls} />
          </Field>
          <label className="flex items-center gap-2 text-xs font-bold text-[#0F172A] cursor-pointer pb-2.5">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} disabled={pending} className="w-4 h-4 accent-[#2563EB]" />
            Unggulan
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-[#0F172A] cursor-pointer pb-2.5">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} disabled={pending} className="w-4 h-4 accent-[#2563EB]" />
            Sembunyikan dari publik
          </label>
        </div>
      </form>
    </Modal>
  );
};

// ---------------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------------

const useCount = (q: AdminGalleryQuery) =>
  useQuery({
    queryKey: queryKeys.admin.gallery.list({ ...q, limit: 1 }),
    queryFn: ({ signal }) => adminListGalleryCount(q, signal),
    staleTime: 30_000,
  });
const adminListGalleryCount = (q: AdminGalleryQuery, signal?: AbortSignal) => adminListGallery({ ...q, limit: 1 }, signal);

export const AdminCuration: React.FC = () => {
  const queryClient = useQueryClient();
  const { notice, show, showError, clear } = useNotice();
  const [search, setSearch] = useState('');
  const [hiddenFilter, setHiddenFilter] = useState('');
  const [featuredFilter, setFeaturedFilter] = useState('');
  const [templateSlug, setTemplateSlug] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ type: 'create' } | { type: 'edit'; item: AdminGalleryItem } | { type: 'delete'; item: AdminGalleryItem } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const debounced = useDebouncedValue(search.trim());
  const query: AdminGalleryQuery = {
    page,
    limit: PAGE_SIZE,
    search: debounced || undefined,
    hidden: triState(hiddenFilter),
    featured: triState(featuredFilter),
    template: templateSlug || undefined,
  };
  const gallery = useQuery({
    queryKey: queryKeys.admin.gallery.list(query),
    queryFn: ({ signal }) => adminListGallery(query, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const templates = useQuery({
    queryKey: queryKeys.admin.templates.list({ limit: 100 }),
    queryFn: ({ signal }) => adminListTemplates({ limit: 100 }, signal),
    staleTime: 60_000,
  });
  const totalAll = useCount({});
  const totalFeatured = useCount({ featured: true });
  const totalHidden = useCount({ hidden: true });

  const setFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.gallery.all });
    // The public gallery shares the data.
    void queryClient.invalidateQueries({ queryKey: queryKeys.gallery.all });
  };

  const patch = async (item: AdminGalleryItem, body: Parameters<typeof adminUpdateGalleryItem>[1], success: string) => {
    setBusyId(item.id);
    try {
      await adminUpdateGalleryItem(item.id, body);
      show('success', success);
      refresh();
    } catch (err) {
      showError(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={<Award className="w-6 h-6" />}
        title={
          <>
            Kurasi <span className="text-[#2563EB]">Galeri Unggulan UMKM</span>
          </>
        }
        description="Pilih karya terbaik untuk galeri publik. Teks prompt tampilan disusun server dari isian slot dan catatan, tidak pernah dari core prompt."
        actions={
          <button type="button" onClick={() => setDialog({ type: 'create' })} className={btnPrimary}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            Tambah Item
          </button>
        }
      />

      <NoticeBanner notice={notice} onDismiss={clear} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-blue-50/80 via-white to-blue-50/30 rounded-3xl border-2 border-[#BFDBFE] p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] block">Poster Unggulan Beranda</span>
          <div className="text-3xl font-black text-[#0F172A] mt-2">
            {formatNumber(totalFeatured.data?.meta.total)} <span className="text-xs font-semibold text-slate-500">Materi Terpilih</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Ditampilkan di etalase inspirasi publik</p>
        </div>
        <div className="bg-gradient-to-br from-sky-50/80 via-white to-sky-50/30 rounded-3xl border-2 border-[#BAE6FD] p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#0284C7] block">Item Tersembunyi</span>
          <div className="text-3xl font-black text-[#0F172A] mt-2">
            {formatNumber(totalHidden.data?.meta.total)} <span className="text-xs font-semibold text-slate-500">Tidak Tampil</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Masih tersimpan tetapi tidak muncul di galeri publik</p>
        </div>
        <div className="bg-gradient-to-br from-slate-100/90 via-white to-slate-50/50 rounded-3xl border-2 border-slate-300 p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Total Item Galeri</span>
          <div className="text-3xl font-black text-[#0F172A] mt-2">
            {formatNumber(totalAll.data?.meta.total)} <span className="text-xs font-semibold text-slate-500">Item</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Termasuk yang tersembunyi</p>
        </div>
      </div>

      <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setFilter(() => setSearch(e.target.value))} placeholder="Cari judul..." aria-label="Cari item galeri" className={`${inputCls} !pl-10`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={hiddenFilter} onChange={(e) => setFilter(() => setHiddenFilter(e.target.value))} aria-label="Filter visibilitas" className={`${selectCls} !w-auto`}>
            <option value="">Tampil &amp; tersembunyi</option>
            <option value="false">Hanya tampil</option>
            <option value="true">Hanya tersembunyi</option>
          </select>
          <select value={featuredFilter} onChange={(e) => setFilter(() => setFeaturedFilter(e.target.value))} aria-label="Filter unggulan" className={`${selectCls} !w-auto`}>
            <option value="">Semua</option>
            <option value="true">Unggulan</option>
            <option value="false">Bukan unggulan</option>
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

      {gallery.isPending && <LoadingBlock label="Memuat galeri..." />}
      {gallery.isError && !gallery.data && <ErrorState error={gallery.error} onRetry={() => void gallery.refetch()} title="Galeri tidak dapat dimuat" />}
      {gallery.data && gallery.data.items.length === 0 && (
        <EmptyState
          icon={<Award className="w-6 h-6" />}
          title="Tidak ada item galeri"
          hint="Tambahkan karya dari generasi yang sudah selesai atau unggah gambar bersama template-nya."
          action={
            <button type="button" onClick={() => setDialog({ type: 'create' })} className={btnPrimary}>
              Tambah Item
            </button>
          }
        />
      )}

      {gallery.data && gallery.data.items.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${gallery.isFetching ? 'opacity-70' : ''}`}>
          {gallery.data.items.map((item) => (
            <div key={item.id} className="bg-white rounded-3xl border border-[#CBD5E1] p-4 shadow-xs hover:shadow-xl transition-all space-y-3.5 flex flex-col justify-between">
              <div>
                <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 border border-slate-100 mb-3">
                  <img src={fileUrl(item.image_url)} alt={item.title} loading="lazy" className={`w-full h-full object-cover ${item.is_hidden ? 'opacity-50' : ''}`} />
                  {item.is_featured && (
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-[#2563EB] text-white text-[10px] font-black flex items-center gap-1 shadow-md">
                      <Star className="w-3 h-3 fill-white" aria-hidden="true" />
                      <span>Etalase Utama</span>
                    </span>
                  )}
                  {item.is_hidden && (
                    <span className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-full bg-[#0F172A] text-white text-[10px] font-black flex items-center gap-1 shadow-md">
                      <EyeOff className="w-3 h-3" aria-hidden="true" />
                      <span>Tersembunyi</span>
                    </span>
                  )}
                  <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/60 text-[9px] font-bold text-white">Urutan: {item.sort_order}</span>
                </div>
                <h3 className="text-sm font-bold text-[#0F172A] line-clamp-1">{item.title}</h3>
                <p className="text-xs text-[#2563EB] font-bold mt-0.5">{item.template?.name ?? 'Tanpa template'}</p>
                <p className="mt-2 text-[11px] text-slate-500 line-clamp-3">{item.display_prompt}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.generation_id ? <Badge tone="blue">Dari generasi</Badge> : <Badge tone="slate">Unggahan</Badge>}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void patch(item, { is_featured: !item.is_featured }, item.is_featured ? 'Dilepas dari etalase utama.' : 'Ditampilkan di etalase utama.')}
                  className={`w-full py-2 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                    item.is_featured ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${item.is_featured ? 'text-amber-500 fill-amber-500' : 'text-white'}`} aria-hidden="true" />
                  <span>{item.is_featured ? 'Lepas dari Etalase' : 'Tampilkan di Beranda'}</span>
                </button>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void patch(item, { is_hidden: !item.is_hidden }, item.is_hidden ? 'Item ditampilkan kembali.' : 'Item disembunyikan dari publik.')}
                    className="py-1.5 rounded-full bg-white border border-slate-200 hover:border-[#2563EB] hover:text-[#2563EB] text-slate-600 text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1 disabled:opacity-60"
                    aria-label={item.is_hidden ? `Tampilkan ${item.title}` : `Sembunyikan ${item.title}`}
                  >
                    {item.is_hidden ? <Eye className="w-3 h-3" aria-hidden="true" /> : <EyeOff className="w-3 h-3" aria-hidden="true" />}
                    {item.is_hidden ? 'Tampilkan' : 'Sembunyi'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog({ type: 'edit', item })}
                    className="py-1.5 rounded-full bg-white border border-slate-200 hover:border-[#2563EB] hover:text-[#2563EB] text-slate-600 text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1"
                    aria-label={`Edit ${item.title}`}
                  >
                    <Pencil className="w-3 h-3" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog({ type: 'delete', item })}
                    className="py-1.5 rounded-full bg-white border border-slate-200 hover:border-red-400 hover:text-red-600 text-slate-600 text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1"
                    aria-label={`Hapus ${item.title}`}
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" />
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination meta={gallery.data?.meta} onPage={setPage} busy={gallery.isFetching} noun="item" />

      {dialog?.type === 'create' && (
        <CreateModal
          onClose={() => setDialog(null)}
          onSaved={(msg) => {
            setDialog(null);
            show('success', msg);
            refresh();
          }}
        />
      )}
      {dialog?.type === 'edit' && (
        <EditModal
          item={dialog.item}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            show('success', 'Item galeri diperbarui.');
            refresh();
          }}
        />
      )}
      {dialog?.type === 'delete' && (
        <ConfirmModal
          title="Hapus item galeri?"
          confirmLabel="Hapus Item"
          danger
          message={<>Item <strong>{dialog.item.title}</strong> dan salinan gambarnya akan dihapus dari galeri.</>}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await adminDeleteGalleryItem(dialog.item.id);
            show('success', 'Item galeri dihapus.');
            refresh();
          }}
        />
      )}
    </div>
  );
};
export default AdminCuration;
