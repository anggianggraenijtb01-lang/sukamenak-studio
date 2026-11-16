import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, ShieldAlert, ShieldCheck, Sliders, Sparkles, Trash2, Upload } from 'lucide-react';
import { adminGetBrandIdentity, adminGetSettings, adminUpdateBrandIdentity, adminUpdateSettings, adminUploadBrandLogo } from '../../api/admin';
import { fileUrl } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import type { AdminSettingsResponse, AppSettings, BrandIdentity } from '../../api/types';
import { toFormError } from '../../components/admin/adminErrors';
import { formatDateTime } from '../../components/admin/format';
import { Banner, ErrorState, Field, LoadingBlock, NoticeBanner, PageHeader, Spinner, btnPrimary, inputCls, selectCls, textareaCls, useNotice } from '../../components/admin/ui';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_COLORS = 12;

// ---------------------------------------------------------------------------------------------------
// Global settings
// ---------------------------------------------------------------------------------------------------

const SettingsForm: React.FC<{ data: AdminSettingsResponse; onSaved: (next: AdminSettingsResponse) => void }> = ({ data, onSaved }) => {
  const s = data.settings;
  const [language, setLanguage] = useState<AppSettings['language']>(s.language);
  const [limit, setLimit] = useState(String(s.default_daily_limit));
  const [maxRefs, setMaxRefs] = useState(String(s.max_references));
  const [watermark, setWatermark] = useState(s.watermark_enabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    const limitNum = Number(limit);
    const refsNum = Number(maxRefs);
    if (!/^\d+$/.test(limit.trim()) || limitNum > 1000) local.default_daily_limit = 'Bilangan bulat 0-1000.';
    if (!/^\d+$/.test(maxRefs.trim()) || refsNum < 1 || refsNum > 12) local.max_references = 'Bilangan bulat 1-12.';
    if (Object.keys(local).length > 0) {
      setError({ message: 'Periksa kembali isian yang ditandai.', fields: local });
      return;
    }
    const body: Partial<AppSettings> = {};
    if (language !== s.language) body.language = language;
    if (limitNum !== s.default_daily_limit) body.default_daily_limit = limitNum;
    if (refsNum !== s.max_references) body.max_references = refsNum;
    if (watermark !== s.watermark_enabled) body.watermark_enabled = watermark;
    if (Object.keys(body).length === 0) {
      setError({ message: 'Tidak ada perubahan untuk disimpan.', fields: {} });
      return;
    }
    setPending(true);
    setError(null);
    try {
      onSaved(await adminUpdateSettings(body));
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setPending(false);
    }
  };

  const fe = (f: string) => error?.fields[f] ?? null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      <form onSubmit={save} noValidate className="bg-white/90 backdrop-blur-md rounded-3xl border border-[#BFDBFE] p-6 shadow-xs space-y-5">
        <div>
          <h3 className="text-base font-extrabold text-[#0F172A]">
            Kebijakan Kuota &amp; <span className="text-[#2563EB]">Proteksi Generasi</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Atur batasan alokasi harian per akun dan perlindungan hasil desain. Berlaku pada permintaan berikutnya.</p>
        </div>
        {error && <Banner kind={error.message.startsWith('Tidak ada') ? 'info' : 'error'}>{error.message}</Banner>}

        <Field label="Bahasa antarmuka bawaan" htmlFor="set-language" error={fe('language')}>
          <select id="set-language" value={language} onChange={(e) => setLanguage(e.target.value as AppSettings['language'])} disabled={pending} className={selectCls}>
            <option value="id">Bahasa Indonesia (id)</option>
            <option value="en">English (en)</option>
          </select>
        </Field>

        <Field label="Batas kuota pembuatan harian bawaan" htmlFor="set-limit" error={fe('default_daily_limit')} hint="Desain per akun per hari (0-1000). Akun dengan batas khusus tidak terpengaruh.">
          <div className="flex items-center gap-3">
            <input id="set-limit" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} disabled={pending} className="w-24 px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-sm font-extrabold text-[#0F172A] text-center" />
            <span className="text-xs font-bold text-slate-600">Desain / Akun / Hari</span>
          </div>
        </Field>

        <Field label="Maksimum foto referensi per generasi" htmlFor="set-refs" error={fe('max_references')} hint="1-12. Juga membatasi jumlah referensi tersimpan per pengguna.">
          <input id="set-refs" inputMode="numeric" value={maxRefs} onChange={(e) => setMaxRefs(e.target.value)} disabled={pending} className="w-24 px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-sm font-extrabold text-[#0F172A] text-center" />
        </Field>

        <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 flex items-center justify-between gap-3">
          <div id="wm-label">
            <div className="text-xs font-extrabold text-[#0F172A]">Wajib Watermark Logo Studio</div>
            <div className="text-[11px] text-slate-500">Sematkan cap tipis logo studio di sudut hasil desain.</div>
            {fe('watermark_enabled') && <div className="text-[11px] font-bold text-red-600">{fe('watermark_enabled')}</div>}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={watermark}
            aria-labelledby="wm-label"
            disabled={pending}
            onClick={() => setWatermark(!watermark)}
            className={`w-11 h-6 shrink-0 rounded-full p-0.5 transition-colors flex items-center cursor-pointer disabled:opacity-60 ${watermark ? 'bg-[#2563EB] justify-end' : 'bg-slate-300 justify-start'}`}
          >
            <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
          </button>
        </div>

        <button type="submit" disabled={pending} className={`${btnPrimary} w-full !rounded-2xl`}>
          {pending ? <Spinner /> : <Save className="w-4 h-4" aria-hidden="true" />}
          <span>Simpan Kebijakan &amp; Kuota</span>
        </button>
      </form>

      <div className="bg-gradient-to-br from-white to-blue-50/40 rounded-3xl border border-[#BFDBFE] p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-[#2563EB]">
          <ShieldAlert className="w-5 h-5" aria-hidden="true" />
          <h4 className="text-sm font-extrabold text-[#0F172A]">Berlaku Saat Ini</h4>
        </div>
        <dl className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs font-mono space-y-1.5">
          <div className="flex justify-between gap-3">
            <dt>Bahasa:</dt>
            <dd className="font-bold text-[#0F172A]">{s.language}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Kuota harian bawaan:</dt>
            <dd className="font-bold text-[#0F172A]">{s.default_daily_limit}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Maks. referensi:</dt>
            <dd className="font-bold text-[#0F172A]">{s.max_references}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Watermark:</dt>
            <dd className="font-bold text-[#2563EB]">{s.watermark_enabled ? 'Aktif' : 'Nonaktif'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Diperbarui:</dt>
            <dd className="font-bold text-[#0F172A]">{data.updated_at ? formatDateTime(data.updated_at) : 'Belum pernah'}</dd>
          </div>
        </dl>
        <p className="text-xs text-slate-600 leading-relaxed flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 mt-0.5 text-[#2563EB] shrink-0" aria-hidden="true" />
          <span>
            Istilah terlarang, tingkat moderasi, dan disclaimer diatur di{' '}
            <Link to="/admin/policy" className="font-bold text-[#2563EB] underline">
              Content Policy
            </Link>
            . Perubahan pengaturan dicatat di{' '}
            <Link to="/admin/audit" className="font-bold text-[#2563EB] underline">
              Audit Log
            </Link>
            .
          </span>
        </p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------------
// Brand identity
// ---------------------------------------------------------------------------------------------------

const BrandForm: React.FC<{ brand: BrandIdentity; onSaved: (next: BrandIdentity, message: string) => void }> = ({ brand, onSaved }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(brand.name);
  const [palette, setPalette] = useState<string[]>(brand.palette);
  const [font, setFont] = useState(brand.font_family);
  const [disclaimer, setDisclaimer] = useState(brand.disclaimer ?? '');
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const logo = fileUrl(brand.logo_url);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (name.trim().length < 2) local.name = 'Nama minimal 2 karakter.';
    if (!font.trim()) local.font_family = 'Nama font wajib diisi.';
    if (palette.length > MAX_COLORS) local.palette = `Maksimal ${MAX_COLORS} warna.`;
    else if (palette.some((c) => !HEX_RE.test(c))) local.palette = 'Setiap warna harus berformat #rrggbb.';
    if (disclaimer.length > 500) local.disclaimer = 'Maksimal 500 karakter.';
    if (Object.keys(local).length > 0) {
      setError({ message: 'Periksa kembali isian yang ditandai.', fields: local });
      return;
    }
    const body: Parameters<typeof adminUpdateBrandIdentity>[0] = {};
    if (name.trim() !== brand.name) body.name = name.trim();
    if (font.trim() !== brand.font_family) body.font_family = font.trim();
    if (JSON.stringify(palette.map((c) => c.toLowerCase())) !== JSON.stringify(brand.palette.map((c) => c.toLowerCase()))) body.palette = palette;
    if ((disclaimer.trim() || null) !== brand.disclaimer) body.disclaimer = disclaimer.trim() || null;
    if (Object.keys(body).length === 0) {
      setError({ message: 'Tidak ada perubahan untuk disimpan.', fields: {} });
      return;
    }
    setPending(true);
    setError(null);
    try {
      const next = await adminUpdateBrandIdentity(body);
      setName(next.name);
      setFont(next.font_family);
      setPalette(next.palette);
      setDisclaimer(next.disclaimer ?? '');
      onSaved(next, 'Identitas studio berhasil disimpan.');
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setPending(false);
    }
  };

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    setLogoError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setLogoError('Format logo harus JPEG, PNG, atau WebP.');
      return;
    }
    setUploading(true);
    try {
      onSaved(await adminUploadBrandLogo(file), 'Logo berhasil diganti.');
    } catch (err) {
      setLogoError(toFormError(err).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const fe = (f: string) => error?.fields[f] ?? null;
  const validColors = palette.filter((c) => HEX_RE.test(c));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      <form onSubmit={save} noValidate className="bg-white/90 backdrop-blur-md rounded-3xl border border-[#BFDBFE] p-6 shadow-xs space-y-5">
        <div>
          <h3 className="text-base font-extrabold text-[#0F172A]">
            Identitas Resmi <span className="text-[#2563EB]">Sukamenak Studio</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Nama, palet warna, font, dan disclaimer yang dipakai pada hasil desain.</p>
        </div>
        {error && <Banner kind={error.message.startsWith('Tidak ada') ? 'info' : 'error'}>{error.message}</Banner>}

        <Field label="Nama resmi studio" htmlFor="brand-name" error={fe('name')}>
          <input id="brand-name" value={name} onChange={(e) => setName(e.target.value)} disabled={pending} className={inputCls} />
        </Field>

        <Field label="Font utama" htmlFor="brand-font" error={fe('font_family')} hint="Nama keluarga font, mis. Inter.">
          <input id="brand-font" value={font} onChange={(e) => setFont(e.target.value)} disabled={pending} className={inputCls} />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-[#0F172A] mb-1.5">Palet warna (maks. {MAX_COLORS}, format #rrggbb)</legend>
          {palette.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Pilih warna ${i + 1}`}
                value={HEX_RE.test(c) ? c : '#000000'}
                onChange={(e) => setPalette((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                disabled={pending}
                className="w-10 h-9 rounded-lg border border-slate-200 bg-white cursor-pointer p-0.5"
              />
              <input
                aria-label={`Kode warna ${i + 1}`}
                value={c}
                onChange={(e) => setPalette((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                disabled={pending}
                className={`${inputCls} !py-1.5 font-mono max-w-[9rem] ${HEX_RE.test(c) ? '' : '!border-red-400'}`}
                maxLength={7}
              />
              <button
                type="button"
                onClick={() => setPalette((p) => p.filter((_, j) => j !== i))}
                disabled={pending}
                aria-label={`Hapus warna ${i + 1}`}
                className="p-1.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPalette((p) => [...p, '#2563eb'])}
            disabled={pending || palette.length >= MAX_COLORS}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-[#2563EB] text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Tambah warna
          </button>
          {fe('palette') && <p className="text-[11px] font-bold text-red-600">{fe('palette')}</p>}
        </fieldset>

        <Field label="Teks disclaimer merek (opsional)" htmlFor="brand-disclaimer" error={fe('disclaimer')}>
          <textarea id="brand-disclaimer" rows={2} value={disclaimer} onChange={(e) => setDisclaimer(e.target.value)} disabled={pending} maxLength={500} className={textareaCls} />
        </Field>

        <div>
          <span className="block text-xs font-bold text-[#0F172A] mb-1.5">Logo studio</span>
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200">
            {logo ? (
              <img src={logo} alt="Logo studio saat ini" className="w-12 h-12 rounded-2xl object-contain bg-white border border-slate-200" />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center font-black text-xl shadow-md shadow-blue-500/25" aria-hidden="true">
                {name.trim().charAt(0).toUpperCase() || 'S'}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#0F172A]">{logo ? 'Logo aktif' : 'Belum ada logo'}</div>
              <div className="text-[11px] text-slate-500">PNG, JPEG, atau WebP transparan disarankan.</div>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Pilih file logo" onChange={(e) => void uploadLogo(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-[#2563EB] text-xs font-bold text-[#0F172A] transition-colors cursor-pointer disabled:opacity-60"
            >
              {uploading ? <Spinner className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" aria-hidden="true" />}
              {logo ? 'Ganti Logo' : 'Unggah Logo'}
            </button>
          </div>
          {logoError && (
            <p role="alert" className="text-[11px] font-bold text-red-600 mt-1">
              {logoError}
            </p>
          )}
        </div>

        <button type="submit" disabled={pending} className={`${btnPrimary} w-full !rounded-2xl`}>
          {pending ? <Spinner /> : <Save className="w-4 h-4" aria-hidden="true" />}
          <span>Simpan Identitas Studio</span>
        </button>
      </form>

      {/* Preview identity card: shows the saved brand values only */}
      <div className="bg-gradient-to-br from-[#0F172A] via-[#111C38] to-[#1E3A8A] text-white rounded-3xl p-6 shadow-xl space-y-4">
        <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 block">Pratinjau Wordmark Studio</span>
        <div className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt="" className="w-10 h-10 rounded-2xl object-contain bg-white/10" />
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/25" aria-hidden="true">
              {brand.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-lg font-black tracking-tight" style={{ fontFamily: `${brand.font_family}, sans-serif` }}>
              {brand.name}
            </div>
            <div className="text-xs text-sky-300">Font: {brand.font_family}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Palet warna tersimpan">
          {brand.palette.map((c, i) => (
            <span key={`${c}-${i}`} title={c} className="w-8 h-8 rounded-lg border border-white/20" style={{ backgroundColor: c }} />
          ))}
        </div>
        {validColors.length !== palette.length && <p className="text-[11px] text-amber-300">Ada kode warna yang belum valid pada formulir.</p>}
        <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-xs text-slate-300 leading-relaxed">
          {brand.disclaimer || 'Belum ada disclaimer merek.'}
        </div>
        <p className="text-[11px] text-slate-400">Diperbarui {formatDateTime(brand.updated_at)}</p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------------

export const AdminSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const { notice, show, clear } = useNotice();
  const [activeTab, setActiveTab] = useState<'quota' | 'identity'>('quota');

  const settings = useQuery({ queryKey: queryKeys.admin.settings, queryFn: ({ signal }) => adminGetSettings(signal), staleTime: 60_000 });
  const brand = useQuery({
    queryKey: queryKeys.admin.brandIdentity,
    queryFn: ({ signal }) => adminGetBrandIdentity(signal),
    staleTime: 60_000,
    enabled: activeTab === 'identity',
  });

  const tabCls = (active: boolean) =>
    `flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
      active ? 'bg-[#2563EB] text-white shadow-xs' : 'text-slate-600 hover:text-[#0F172A] hover:bg-slate-50'
    }`;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={<Sliders className="w-5 h-5" />}
        title={
          <>
            Pengaturan Global &amp; <span className="text-[#2563EB]">Identitas Studio</span>
          </>
        }
        description="Sesuaikan kebijakan penggunaan sistem dan identitas resmi studio. Perubahan berlaku langsung tanpa deploy."
      />

      <NoticeBanner notice={notice} onDismiss={clear} />

      <div role="tablist" aria-label="Kategori pengaturan" className="bg-white/90 backdrop-blur-md rounded-2xl border border-[#BFDBFE] p-1.5 shadow-xs flex items-center gap-1.5 max-w-xl">
        <button type="button" role="tab" aria-selected={activeTab === 'quota'} onClick={() => setActiveTab('quota')} className={tabCls(activeTab === 'quota')}>
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          <span>Kebijakan &amp; Kuota</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'identity'} onClick={() => setActiveTab('identity')} className={tabCls(activeTab === 'identity')}>
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          <span>Identitas Studio</span>
        </button>
      </div>

      {activeTab === 'quota' && (
        <>
          {settings.isPending && <LoadingBlock label="Memuat pengaturan..." />}
          {settings.isError && <ErrorState error={settings.error} onRetry={() => void settings.refetch()} title="Pengaturan tidak dapat dimuat" />}
          {settings.data && (
            <SettingsForm
              key={settings.data.updated_at ?? 'initial'}
              data={settings.data}
              onSaved={(next) => {
                queryClient.setQueryData(queryKeys.admin.settings, next);
                show('success', 'Pengaturan berhasil disimpan dan langsung berlaku.');
              }}
            />
          )}
        </>
      )}

      {activeTab === 'identity' && (
        <>
          {brand.isPending && <LoadingBlock label="Memuat identitas..." />}
          {brand.isError && <ErrorState error={brand.error} onRetry={() => void brand.refetch()} title="Identitas tidak dapat dimuat" />}
          {brand.data && (
            <BrandForm
              key={brand.data.id}
              brand={brand.data}
              onSaved={(next, msg) => {
                queryClient.setQueryData(queryKeys.admin.brandIdentity, next);
                show('success', msg);
              }}
            />
          )}
        </>
      )}
    </div>
  );
};
export default AdminSettings;
