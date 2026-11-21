import React, { useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Edit2,
  Image as ImageIcon,
  Layers,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  adminArchiveTemplate,
  adminCreateTemplate,
  adminDeleteTemplate,
  adminGetTemplate,
  adminListCorePrompts,
  adminListTemplates,
  adminPublishTemplate,
  adminUnpublishTemplate,
  adminUpdateTemplate,
  adminUploadTemplatePreview,
} from '../../api/admin';
import { fileUrl } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import type {
  AdminCreateTemplateRequest,
  AdminTemplate,
  AdminTemplateDetail,
  AdminUpdateTemplateRequest,
  TemplateCategory,
  TemplateMode,
  TemplateStatus,
  TemplateSubject,
} from '../../api/types';
import { SlotsEditor } from '../../components/admin/SlotsEditor';
import { ZonesEditor } from '../../components/admin/ZonesEditor';
import { publishErrorMessage, readinessIssueMessage, toFormError } from '../../components/admin/adminErrors';
import { CATEGORY_LABELS } from '../../components/admin/format';
import { useDebouncedValue } from '../../components/admin/hooks';
import {
  Badge,
  Banner,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
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

const CATEGORIES = Object.keys(CATEGORY_LABELS) as TemplateCategory[];
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KEY_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const RATIOS = [
  { id: '4:5', label: '4:5 Vertikal', sub: 'Feed Medsos' },
  { id: '1:1', label: '1:1 Persegi', sub: 'Katalog & WA' },
  { id: '9:16', label: '9:16 Story', sub: 'Story & Reels' },
  { id: '16:9', label: '16:9 Banner', sub: 'Lanskap Web' },
];
const PAGE_SIZE = 12;

const STATUS_BADGE: Record<TemplateStatus, { tone: 'blue' | 'slate' | 'amber'; label: string }> = {
  published: { tone: 'blue', label: 'Terbit' },
  draft: { tone: 'amber', label: 'Draf' },
  archived: { tone: 'slate', label: 'Arsip' },
};

const ratioClass = (r: string) => (r === '1:1' ? 'aspect-square' : r === '9:16' ? 'aspect-[9/16] max-h-[460px] mx-auto' : r === '16:9' ? 'aspect-video' : 'aspect-[4/5]');

// ---------------------------------------------------------------------------------------------------
// Editor (create + edit)
// ---------------------------------------------------------------------------------------------------

const TemplateEditor: React.FC<{
  id: string | null;
  onBack: () => void;
  onCreated: (id: string) => void;
  onNotice: (kind: 'success' | 'error', text: string) => void;
}> = ({ id, onBack, onCreated, onNotice }) => {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const detail = useQuery({
    queryKey: queryKeys.admin.templates.detail(id ?? 'new'),
    queryFn: ({ signal }) => adminGetTemplate(id!, signal),
    enabled: !!id,
    staleTime: 10_000,
  });
  const corePrompts = useQuery({
    queryKey: queryKeys.admin.corePrompts.list({ limit: 100 }),
    queryFn: ({ signal }) => adminListCorePrompts({ limit: 100 }, signal),
    staleTime: 60_000,
  });
  const coreKeys = [...new Set((corePrompts.data?.items ?? []).map((p) => p.key))];

  const t = detail.data;
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('poster');
  const [mode, setMode] = useState<TemplateMode>('both');
  const [subject, setSubject] = useState<TemplateSubject>('product');
  const [aspect, setAspect] = useState('4:5');
  const [coreKey, setCoreKey] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<{ message: string; fields: Record<string, string> } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'delete' | 'archive' | null>(null);

  // Copy server values into the form once per loaded template (derived state, not an effect).
  if (t && loadedId !== t.id) {
    setLoadedId(t.id);
    setName(t.name);
    setSlug(t.slug);
    setDescription(t.description);
    setCategory(t.category);
    setMode(t.mode);
    setSubject(t.subject);
    setAspect(t.aspect_ratio);
    setCoreKey(t.core_prompt_key);
    setSortOrder(String(t.sort_order));
  }

  const syncDetail = (next: AdminTemplateDetail) => {
    queryClient.setQueryData(queryKeys.admin.templates.detail(next.id), next);
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.templates.lists() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard.all });
  };
  const refetchDetail = () => {
    if (id) void queryClient.invalidateQueries({ queryKey: queryKeys.admin.templates.detail(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.templates.lists() });
  };

  const slotsWithBlank = t ? t.slots.filter((s) => s.blank_index != null).length : 0;
  const publishCtx = { coreKey: t?.core_prompt_key ?? coreKey, slotsWithBlank, category };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Nama minimal 2 karakter.';
    if (!SLUG_RE.test(slug.trim())) e.slug = 'Gunakan huruf kecil, angka, dan tanda hubung (contoh: poster-promo-produk).';
    if (!KEY_RE.test(coreKey.trim())) e.core_prompt_key = 'Gunakan format seperti product.poster.';
    if (!/^[0-9]{1,2}:[0-9]{1,2}$/.test(aspect.trim())) e.aspect_ratio = 'Gunakan format seperti 4:5.';
    if (!/^-?\d+$/.test(sortOrder.trim())) e.sort_order = 'Bilangan bulat.';
    return e;
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setActionError(null);
    const local = validate();
    if (Object.keys(local).length > 0) {
      setFormError({ message: 'Periksa kembali isian yang ditandai.', fields: local });
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const values: AdminCreateTemplateRequest = {
        slug: slug.trim(),
        name: name.trim(),
        description: description.trim(),
        category,
        mode,
        subject,
        aspect_ratio: aspect.trim(),
        core_prompt_key: coreKey.trim(),
        sort_order: Number(sortOrder),
      };
      if (t) {
        const body: AdminUpdateTemplateRequest = {};
        (Object.keys(values) as Array<keyof AdminCreateTemplateRequest>).forEach((k) => {
          if (values[k] !== (t as unknown as Record<string, unknown>)[k]) (body as Record<string, unknown>)[k] = values[k];
        });
        if (Object.keys(body).length === 0) {
          onNotice('success', 'Tidak ada perubahan untuk disimpan.');
        } else {
          const next = await adminUpdateTemplate(t.id, body);
          syncDetail(next);
          onNotice('success', 'Perubahan template berhasil disimpan!');
        }
      } else {
        const created = await adminCreateTemplate(values);
        syncDetail(created);
        onNotice('success', 'Template dibuat sebagai draf. Tambahkan slot, zona teks, dan gambar preview, lalu terbitkan.');
        onCreated(created.id);
      }
    } catch (err) {
      const fe = toFormError(err);
      if (t?.status === 'published') fe.message = publishErrorMessage(err, publishCtx);
      setFormError(fe);
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: 'publish' | 'unpublish' | 'archive') => {
    if (!t) return;
    setBusyAction(action);
    setActionError(null);
    try {
      const fn = { publish: adminPublishTemplate, unpublish: adminUnpublishTemplate, archive: adminArchiveTemplate }[action];
      const next = await fn(t.id);
      syncDetail(next);
      onNotice('success', { publish: 'Template diterbitkan dan langsung tampil bagi kreator.', unpublish: 'Template dikembalikan menjadi draf.', archive: 'Template diarsipkan.' }[action]);
    } catch (err) {
      setActionError(action === 'publish' ? publishErrorMessage(err, publishCtx) : toFormError(err).message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file || !t) return;
    setUploading(true);
    setActionError(null);
    try {
      syncDetail(await adminUploadTemplatePreview(t.id, file));
      onNotice('success', 'Gambar preview berhasil diunggah.');
    } catch (err) {
      setActionError(toFormError(err).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const fe = (f: string) => formError?.fields[f] ?? null;
  const preview = fileUrl(t?.preview_url);
  const ratioIsPreset = RATIOS.some((r) => r.id === aspect);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 hover:border-[#2563EB] text-xs font-bold text-[#0F172A] hover:text-[#2563EB] transition-colors shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Kembali ke Daftar Template</span>
        </button>
        <span className="text-xs font-bold text-slate-500">{id ? 'Mode Edit Template' : 'Mode Tambah Baru'}</span>
      </div>

      <PageHeader
        icon={id ? <Edit2 className="w-5 h-5" /> : <Plus className="w-6 h-6" />}
        title={id ? `Edit Template: ${t?.name ?? '...'}` : 'Tambah Template Baru'}
        description="Konfigurasi template, slot isian, zona teks, dan gambar preview. Isi core prompt tidak pernah ditampilkan di sini."
      />

      {id && detail.isPending && <LoadingBlock label="Memuat template..." />}
      {id && detail.isError && <ErrorState error={detail.error} onRetry={() => void detail.refetch()} title="Template tidak dapat dimuat" />}

      {(!id || t) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: FORM INPUTS */}
          <form onSubmit={handleSave} noValidate className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-5">
            {formError && <Banner kind="error">{formError.message}</Banner>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nama Template" htmlFor="tpl-name" error={fe('name')} required>
                <input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} placeholder="Contoh: Keripik Tempe Gurih Renyah" className={inputCls} />
              </Field>
              <Field label="Slug (alamat unik)" htmlFor="tpl-slug" error={fe('slug')} hint="Huruf kecil, angka, tanda hubung." required>
                <input id="tpl-slug" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={saving} placeholder="keripik-tempe-gurih" className={`${inputCls} font-mono`} autoComplete="off" />
              </Field>
            </div>
            <Field label="Deskripsi" htmlFor="tpl-desc" error={fe('description')}>
              <textarea id="tpl-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} maxLength={1000} className={textareaCls} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Kategori" htmlFor="tpl-category" error={fe('category')}>
                <select id="tpl-category" value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)} disabled={saving} className={selectCls}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Mode" htmlFor="tpl-mode" error={fe('mode')}>
                <select id="tpl-mode" value={mode} onChange={(e) => setMode(e.target.value as TemplateMode)} disabled={saving} className={selectCls}>
                  <option value="both">Keduanya (i2i dan t2i)</option>
                  <option value="i2i">Foto ke gambar (i2i)</option>
                  <option value="t2i">Teks ke gambar (t2i)</option>
                </select>
              </Field>
              <Field label="Subjek" htmlFor="tpl-subject" error={fe('subject')}>
                <select id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value as TemplateSubject)} disabled={saving} className={selectCls}>
                  <option value="product">Produk</option>
                  <option value="human_model">Model manusia</option>
                </select>
              </Field>
            </div>

            <div>
              <span className="block text-xs font-bold text-[#0F172A] mb-1.5">Ukuran &amp; Rasio Template</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Rasio template">
                {RATIOS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={aspect === r.id}
                    onClick={() => setAspect(r.id)}
                    disabled={saving}
                    className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                      aspect === r.id ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB] shadow-xs ring-1 ring-blue-500/20' : 'bg-[#F8FAFC] border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-black">{r.label}</div>
                    <div className="text-[9px] text-slate-500">{r.sub}</div>
                  </button>
                ))}
              </div>
              {!ratioIsPreset && <p className="text-[11px] text-slate-500 mt-1">Rasio khusus saat ini: {aspect}. Pilih salah satu preset untuk menggantinya.</p>}
              {fe('aspect_ratio') && <p className="text-[11px] font-bold text-red-600 mt-1">{fe('aspect_ratio')}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Key core prompt"
                htmlFor="tpl-core-key"
                error={fe('core_prompt_key')}
                hint="Hanya nama key. Template baru bisa diterbitkan bila key ini punya versi aktif dengan jumlah isian yang sama dengan jumlah slot ber-blank."
                required
              >
                <input
                  id="tpl-core-key"
                  list="tpl-core-keys"
                  value={coreKey}
                  onChange={(e) => setCoreKey(e.target.value)}
                  disabled={saving}
                  placeholder="product.poster"
                  className={`${inputCls} font-mono`}
                  autoComplete="off"
                />
                <datalist id="tpl-core-keys">
                  {coreKeys.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </Field>
              <Field label="Urutan tampil" htmlFor="tpl-sort" error={fe('sort_order')} hint="Angka kecil tampil lebih dulu.">
                <input id="tpl-sort" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} disabled={saving} className={inputCls} />
              </Field>
            </div>

            {t?.status === 'published' && <Banner kind="info">Template ini sedang terbit: setiap perubahan diperiksa ulang oleh server dan dibatalkan bila membuatnya tidak valid.</Banner>}

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button type="button" onClick={onBack} disabled={saving} className={btnSecondary}>
                Batal
              </button>
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? <Spinner /> : <Save className="w-4 h-4" aria-hidden="true" />}
                <span>{id ? 'Simpan Perubahan' : 'Simpan Template'}</span>
              </button>
            </div>
          </form>

          {/* RIGHT: PREVIEW, STATUS, READINESS */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">
              Live Preview <span className="text-[#2563EB]">Tampilan Template</span>
            </span>
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-md space-y-4">
              <div className={`relative ${ratioClass(aspect)} rounded-2xl overflow-hidden bg-slate-900 border border-slate-100 shadow-inner flex items-center justify-center`}>
                {preview ? (
                  <img src={preview} alt="Preview Template" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-slate-500 text-xs space-y-1 p-4">
                    <ImageIcon className="w-8 h-8 mx-auto" aria-hidden="true" />
                    <div>{id ? 'Belum ada gambar preview' : 'Simpan template untuk mengunggah gambar preview'}</div>
                  </div>
                )}
                <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-white/95 text-[10px] font-black text-[#2563EB] shadow-xs">{CATEGORY_LABELS[category]}</span>
                {t && (
                  <span className="absolute top-3 right-3">
                    <Badge tone={STATUS_BADGE[t.status].tone}>{STATUS_BADGE[t.status].label}</Badge>
                  </span>
                )}
              </div>
              <h3 className="text-base font-black text-[#0F172A] line-clamp-1">{name || 'Judul Template Baru'}</h3>

              {t && (
                <>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void handleUpload(e.target.files?.[0])} aria-label="Pilih gambar preview" />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] border border-[#BFDBFE] text-xs font-bold transition-all cursor-pointer disabled:opacity-60"
                  >
                    {uploading ? <Spinner className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" aria-hidden="true" />}
                    <span>{preview ? 'Ganti Gambar Preview' : 'Unggah Gambar Preview'}</span>
                  </button>
                  <p className="text-[11px] text-slate-500">JPEG, PNG, atau WebP. Data lokasi (EXIF) dihapus otomatis oleh server.</p>
                </>
              )}
            </div>

            {t && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3" aria-label="Kesiapan dan status template">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-[#0F172A]">Kesiapan Terbit</h3>
                  {t.readiness.publishable ? <Badge tone="green">Siap diterbitkan</Badge> : <Badge tone="amber">Belum siap</Badge>}
                </div>
                {t.readiness.issues.length > 0 ? (
                  <ul className="space-y-1.5">
                    {t.readiness.issues.map((i) => (
                      <li key={`${i.code}-${i.message}`} className="flex items-start gap-2 text-xs text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                        <span>{readinessIssueMessage(i.code, i.message, publishCtx)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    Semua syarat terpenuhi.
                  </p>
                )}
                <p className="text-[11px] text-slate-500">
                  {t.slot_count} slot ({slotsWithBlank} ber-blank) &bull; {t.zone_count} zona teks &bull; key <code>{t.core_prompt_key}</code>
                </p>

                {actionError && <Banner kind="error">{actionError}</Banner>}

                <div className="flex flex-wrap gap-2 pt-1">
                  {t.status !== 'published' && (
                    <button type="button" onClick={() => void runAction('publish')} disabled={busyAction !== null} className={btnPrimary}>
                      {busyAction === 'publish' && <Spinner />}
                      Terbitkan
                    </button>
                  )}
                  {t.status === 'published' && (
                    <button type="button" onClick={() => void runAction('unpublish')} disabled={busyAction !== null} className={btnSecondary}>
                      {busyAction === 'unpublish' && <Spinner />}
                      Tarik dari Terbit
                    </button>
                  )}
                  {t.status === 'archived' && (
                    <button type="button" onClick={() => void runAction('unpublish')} disabled={busyAction !== null} className={btnSecondary}>
                      Jadikan Draf
                    </button>
                  )}
                  {t.status !== 'archived' && (
                    <button type="button" onClick={() => setConfirm('archive')} disabled={busyAction !== null} className={btnSecondary}>
                      Arsipkan
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirm('delete')}
                    disabled={busyAction !== null || t.status === 'published'}
                    title={t.status === 'published' ? 'Tarik template dari terbit sebelum menghapus' : undefined}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 hover:border-red-400 hover:text-red-600 text-slate-600 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Hapus
                  </button>
                </div>
              </div>
            )}
            {!t && (
              <Banner kind="info">
                Setelah disimpan, template berstatus draf. Tambahkan slot dan zona teks, pastikan core prompt aktif, lalu terbitkan.
              </Banner>
            )}
          </div>
        </div>
      )}

      {t && (
        <>
          <SlotsEditor template={t} onChanged={(msg) => { refetchDetail(); onNotice('success', msg); }} />
          <ZonesEditor template={t} onChanged={(msg) => { refetchDetail(); onNotice('success', msg); }} />
        </>
      )}

      {t && confirm === 'archive' && (
        <ConfirmModal
          title="Arsipkan template?"
          confirmLabel="Arsipkan"
          message={<>Template <strong>{t.name}</strong> tidak akan tampil bagi kreator. Anda masih bisa menjadikannya draf lagi.</>}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            syncDetail(await adminArchiveTemplate(t.id));
            onNotice('success', 'Template diarsipkan.');
          }}
        />
      )}
      {t && confirm === 'delete' && (
        <ConfirmModal
          title="Hapus template?"
          confirmLabel="Hapus Template"
          danger
          message={<>Template <strong>{t.name}</strong> beserta slot dan zona teksnya akan dihapus; slug dibebaskan. Hanya template yang tidak terbit yang dapat dihapus.</>}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await adminDeleteTemplate(t.id);
            queryClient.removeQueries({ queryKey: queryKeys.admin.templates.detail(t.id) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.admin.templates.lists() });
            onNotice('success', `Template "${t.name}" dihapus.`);
            onBack();
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------------------------------

type View = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; id: string };

export const AdminTemplates: React.FC = () => {
  const queryClient = useQueryClient();
  const { notice, show, clear } = useNotice();
  const [view, setView] = useState<View>({ mode: 'list' });
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<AdminTemplate | null>(null);

  const debounced = useDebouncedValue(search.trim());
  const query = {
    page,
    limit: PAGE_SIZE,
    status: (status || undefined) as TemplateStatus | undefined,
    category: (category || undefined) as TemplateCategory | undefined,
    search: debounced || undefined,
  };
  const templates = useQuery({
    queryKey: queryKeys.admin.templates.list(query),
    queryFn: ({ signal }) => adminListTemplates(query, signal),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    enabled: view.mode === 'list',
  });

  const setFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  if (view.mode !== 'list') {
    return (
      <div className="space-y-6 pb-12 relative">
        <NoticeBanner notice={notice} onDismiss={clear} />
        <TemplateEditor
          key={view.mode === 'edit' ? view.id : 'new'}
          id={view.mode === 'edit' ? view.id : null}
          onBack={() => setView({ mode: 'list' })}
          onCreated={(id) => setView({ mode: 'edit', id })}
          onNotice={show}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 relative">
      <NoticeBanner notice={notice} onDismiss={clear} />
      <PageHeader
        icon={<Layers className="w-6 h-6" />}
        title={
          <>
            Manajemen Template <span className="text-[#2563EB]">&amp; Slot Studio</span>
          </>
        }
        description="Kelola template poster, slot isian, zona teks, dan status terbit. Perubahan langsung berlaku tanpa deploy."
        actions={
          <button type="button" onClick={() => setView({ mode: 'create' })} className={btnPrimary}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Tambah Template Baru</span>
          </button>
        }
      />

      <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setFilter(() => setSearch(e.target.value))} placeholder="Cari nama template..." aria-label="Cari template" className={`${inputCls} !pl-10`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={status} onChange={(e) => setFilter(() => setStatus(e.target.value))} aria-label="Filter status template" className={`${selectCls} !w-auto`}>
            <option value="">Semua status</option>
            <option value="published">Terbit</option>
            <option value="draft">Draf</option>
            <option value="archived">Arsip</option>
          </select>
          <select value={category} onChange={(e) => setFilter(() => setCategory(e.target.value))} aria-label="Filter kategori template" className={`${selectCls} !w-auto`}>
            <option value="">Semua kategori</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {templates.isPending && <LoadingBlock label="Memuat template..." />}
      {templates.isError && !templates.data && <ErrorState error={templates.error} onRetry={() => void templates.refetch()} title="Daftar template tidak dapat dimuat" />}
      {templates.data && templates.data.items.length === 0 && (
        <EmptyState
          icon={<Layers className="w-6 h-6" />}
          title="Tidak ada template yang cocok"
          hint="Ubah filter atau buat template baru."
          action={
            <button type="button" onClick={() => setView({ mode: 'create' })} className={btnPrimary}>
              Tambah Template Baru
            </button>
          }
        />
      )}

      {templates.data && templates.data.items.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${templates.isFetching ? 'opacity-70' : ''}`}>
          {templates.data.items.map((tpl) => {
            const img = fileUrl(tpl.preview_url);
            return (
              <div key={tpl.id} className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-4 shadow-xs hover:shadow-xl transition-all flex flex-col justify-between space-y-4">
                <div>
                  <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 mb-3 shadow-inner flex items-center justify-center">
                    {img ? <img src={img} alt={tpl.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-slate-300" aria-hidden="true" />}
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-white/95 text-[10px] font-black text-[#2563EB] shadow-xs">{CATEGORY_LABELS[tpl.category]}</span>
                  </div>
                  <h3 className="text-sm font-bold text-[#0F172A] line-clamp-1">{tpl.name}</h3>
                  <p className="text-[11px] font-mono text-slate-500 line-clamp-1">{tpl.slug}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {tpl.slot_count} slot &bull; {tpl.zone_count} zona &bull; {tpl.aspect_ratio}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <Badge tone={STATUS_BADGE[tpl.status].tone}>{STATUS_BADGE[tpl.status].label}</Badge>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setView({ mode: 'edit', id: tpl.id })} className="p-2 rounded-full hover:bg-blue-50 text-slate-600 hover:text-[#2563EB] transition-colors cursor-pointer" title="Edit Template" aria-label={`Edit template ${tpl.name}`}>
                      <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(tpl)}
                      disabled={tpl.status === 'published'}
                      className="p-2 rounded-full hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title={tpl.status === 'published' ? 'Tarik dari terbit sebelum menghapus' : 'Hapus Template'}
                      aria-label={`Hapus template ${tpl.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Pagination meta={templates.data?.meta} onPage={setPage} busy={templates.isFetching} noun="template" />

      {deleting && (
        <ConfirmModal
          title="Hapus template?"
          confirmLabel="Hapus Template"
          danger
          message={<>Template <strong>{deleting.name}</strong> beserta slot dan zona teksnya akan dihapus. Tindakan ini tidak dapat dibatalkan.</>}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await adminDeleteTemplate(deleting.id);
            void queryClient.invalidateQueries({ queryKey: queryKeys.admin.templates.all });
            show('success', `Template "${deleting.name}" dihapus.`);
          }}
        />
      )}
    </div>
  );
};
export default AdminTemplates;
