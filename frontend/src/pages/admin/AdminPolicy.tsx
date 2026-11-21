import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCheck, Lock, Plus, Save, Trash2 } from 'lucide-react';
import { adminGetPolicy, adminUpdatePolicy } from '../../api/admin';
import { queryKeys } from '../../api/queryKeys';
import type { ContentPolicy, ModerationLevel, TemplateCategory } from '../../api/types';
import { toFormError } from '../../components/admin/adminErrors';
import { CATEGORY_LABELS, formatDateTime } from '../../components/admin/format';
import { Banner, ErrorState, Field, LoadingBlock, NoticeBanner, PageHeader, Spinner, btnPrimary, btnSecondary, inputCls, textareaCls, useNotice } from '../../components/admin/ui';

const MAX_TERMS = 1000;
const MAX_TERM_LENGTH = 80;
const MAX_DISCLAIMER = 500;
const CATEGORIES = Object.keys(CATEGORY_LABELS) as TemplateCategory[];

const LEVELS: Array<{ id: ModerationLevel; title: string; desc: string }> = [
  { id: 'lenient', title: 'Longgar', desc: 'Hanya memblokir istilah terlarang yang cocok persis.' },
  { id: 'standard', title: 'Standar', desc: 'Keseimbangan perlindungan dan kebebasan membuat konten (disarankan).' },
  { id: 'strict', title: 'Ketat', desc: 'Pemeriksaan paling hati-hati; lebih banyak teks yang akan ditolak.' },
];

/** Same normalisation as the server: trimmed, lower-cased, whitespace collapsed. */
export function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Splits a pasted list (comma or line separated), normalises and drops empties and duplicates against `existing`. */
export function parseTerms(input: string, existing: string[]): { added: string[]; skipped: number } {
  const seen = new Set(existing);
  const added: string[] = [];
  let skipped = 0;
  for (const raw of input.split(/[\n,]/)) {
    const t = normalizeTerm(raw);
    if (!t) continue;
    if (seen.has(t)) {
      skipped += 1;
      continue;
    }
    seen.add(t);
    added.push(t);
  }
  return { added, skipped };
}

const PolicyForm: React.FC<{ policy: ContentPolicy; onSaved: (p: ContentPolicy) => void }> = ({ policy, onSaved }) => {
  const [terms, setTerms] = useState<string[]>(policy.blocked_terms);
  const [level, setLevel] = useState<ModerationLevel>(policy.moderation_level);
  const [disclaimers, setDisclaimers] = useState<Record<string, string>>(() => Object.fromEntries(CATEGORIES.map((c) => [c, policy.disclaimers[c] ?? ''])));
  const [newTerm, setNewTerm] = useState('');
  const [termError, setTermError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);

  const termsChanged = JSON.stringify(terms) !== JSON.stringify(policy.blocked_terms);
  const levelChanged = level !== policy.moderation_level;
  const changedCategories = CATEGORIES.filter((c) => (disclaimers[c] ?? '').trim() !== (policy.disclaimers[c] ?? ''));
  const dirty = termsChanged || levelChanged || changedCategories.length > 0;

  const addTerms = (e: React.FormEvent) => {
    e.preventDefault();
    const { added, skipped } = parseTerms(newTerm, terms);
    if (added.length === 0) {
      setTermError(skipped > 0 ? 'Istilah itu sudah ada dalam daftar.' : 'Ketik minimal satu istilah.');
      return;
    }
    const tooLong = added.find((t) => t.length > MAX_TERM_LENGTH);
    if (tooLong) {
      setTermError(`Setiap istilah maksimal ${MAX_TERM_LENGTH} karakter.`);
      return;
    }
    if (terms.length + added.length > MAX_TERMS) {
      setTermError(`Daftar maksimal ${MAX_TERMS} istilah.`);
      return;
    }
    setTerms([...terms, ...added]);
    setNewTerm('');
    setTermError(null);
  };

  const reset = () => {
    setTerms(policy.blocked_terms);
    setLevel(policy.moderation_level);
    setDisclaimers(Object.fromEntries(CATEGORIES.map((c) => [c, policy.disclaimers[c] ?? ''])));
    setError(null);
    setTermError(null);
    setNewTerm('');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!(disclaimers.psa ?? '').trim()) local['disclaimers.psa'] = 'Disclaimer PSA tidak boleh kosong: template kategori PSA tidak dapat diterbitkan tanpanya.';
    for (const c of CATEGORIES) if ((disclaimers[c] ?? '').length > MAX_DISCLAIMER) local[`disclaimers.${c}`] = `Maksimal ${MAX_DISCLAIMER} karakter.`;
    if (Object.keys(local).length > 0) {
      setError({ message: 'Periksa kembali isian yang ditandai.', fields: local });
      return;
    }
    setPending(true);
    setError(null);
    try {
      const body: Parameters<typeof adminUpdatePolicy>[0] = {};
      if (termsChanged) body.blocked_terms = terms;
      if (levelChanged) body.moderation_level = level;
      if (changedCategories.length > 0) {
        body.disclaimers = Object.fromEntries(changedCategories.map((c) => [c, (disclaimers[c] ?? '').trim() || null]));
      }
      onSaved(await adminUpdatePolicy(body));
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setPending(false);
    }
  };

  const fe = (f: string) => error?.fields[f] ?? null;

  return (
    <form onSubmit={save} noValidate className="space-y-6">
      {error && <Banner kind="error">{error.message}</Banner>}

      {/* 3 Kartu ringkasan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-blue-50/80 via-white to-blue-50/30 rounded-3xl border-2 border-[#BFDBFE] p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] block">Filter Kata Terlarang</span>
          <div className="text-3xl font-black text-[#0F172A] mt-2">
            {terms.length} <span className="text-xs font-semibold text-slate-500">Istilah</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Diblokir otomatis pada prompt, catatan, dan judul</p>
        </div>
        <div className="bg-gradient-to-br from-sky-50/80 via-white to-sky-50/30 rounded-3xl border-2 border-[#BAE6FD] p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#0369A1] block">Tingkat Moderasi</span>
          <div className="text-3xl font-black text-[#0F172A] mt-2">{LEVELS.find((l) => l.id === level)?.title}</div>
          <p className="text-xs text-slate-500 mt-1">Berlaku mulai permintaan generasi berikutnya</p>
        </div>
        <div className="bg-gradient-to-br from-slate-100/90 via-white to-slate-50/50 rounded-3xl border-2 border-slate-300 p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Disclaimer Kategori</span>
          <div className="text-3xl font-black text-[#0F172A] mt-2">
            {CATEGORIES.filter((c) => (disclaimers[c] ?? '').trim()).length} <span className="text-xs font-semibold text-slate-500">dari {CATEGORIES.length} terisi</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Disclaimer PSA wajib ada</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Moderasi + disclaimer */}
        <div className="lg:col-span-6 space-y-6">
          <section className="bg-white rounded-3xl border border-[#CBD5E1] p-6 shadow-xs space-y-4" aria-label="Tingkat moderasi">
            <h2 className="text-base font-black text-[#0F172A]">Tingkat Moderasi</h2>
            <div className="space-y-2.5" role="radiogroup" aria-label="Tingkat moderasi">
              {LEVELS.map((l) => (
                <label
                  key={l.id}
                  className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${level === l.id ? 'bg-[#EFF6FF] border-[#2563EB] ring-1 ring-blue-500/20' : 'bg-[#F8FAFC] border-slate-200 hover:border-slate-300'}`}
                >
                  <input type="radio" name="moderation" value={l.id} checked={level === l.id} onChange={() => setLevel(l.id)} disabled={pending} className="mt-0.5 accent-[#2563EB]" />
                  <span>
                    <span className="block text-xs font-bold text-[#0F172A]">{l.title}</span>
                    <span className="block text-xs text-slate-600 leading-relaxed">{l.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-3xl border border-[#CBD5E1] p-6 shadow-xs space-y-4" aria-label="Disclaimer per kategori">
            <div>
              <h2 className="text-base font-black text-[#0F172A]">Disclaimer per Kategori</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ditampilkan pada template dan hasil sesuai kategori. Kosongkan untuk menghapus, kecuali PSA yang wajib terisi.</p>
            </div>
            {CATEGORIES.map((c) => (
              <Field
                key={c}
                label={`${CATEGORY_LABELS[c]}${c === 'psa' ? ' (wajib)' : ''}`}
                htmlFor={`disc-${c}`}
                error={fe(`disclaimers.${c}`)}
                hint={c === 'psa' ? 'Tidak boleh kosong.' : undefined}
                required={c === 'psa'}
              >
                <textarea id={`disc-${c}`} rows={2} value={disclaimers[c] ?? ''} onChange={(e) => setDisclaimers((p) => ({ ...p, [c]: e.target.value }))} disabled={pending} maxLength={MAX_DISCLAIMER} className={textareaCls} />
              </Field>
            ))}
          </section>
        </div>

        {/* Right: kata terlarang */}
        <section className="lg:col-span-6 bg-white rounded-3xl border border-[#CBD5E1] p-6 shadow-xs space-y-4" aria-label="Istilah terlarang">
          <h2 className="text-base font-black text-[#0F172A]">Daftar Istilah Terlarang (Blocked Keywords)</h2>
          <p className="text-xs text-slate-500">
            Prompt, catatan, dan judul yang mengandung istilah ini ditolak pada tahap validasi awal. Istilah otomatis diseragamkan (huruf kecil, spasi tunggal) dan duplikat dibuang. Pisahkan beberapa istilah dengan koma.
          </p>

          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={newTerm}
                onChange={(e) => {
                  setNewTerm(e.target.value);
                  setTermError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTerms(e);
                }}
                placeholder="Ketik istilah baru (contoh: judol)..."
                aria-label="Istilah terlarang baru"
                disabled={pending}
                className={inputCls}
              />
            </div>
            <button type="button" onClick={addTerms} disabled={pending} className="px-5 py-2.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60">
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Tambah</span>
            </button>
          </div>
          {termError && (
            <p role="alert" className="text-[11px] font-bold text-red-600 -mt-2">
              {termError}
            </p>
          )}

          {terms.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">Belum ada istilah terlarang.</p>
          ) : (
            <ul className="flex flex-wrap gap-2 pt-2" aria-label="Daftar istilah terlarang">
              {terms.map((term) => (
                <li key={term} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
                  <span>{term}</span>
                  <button type="button" onClick={() => setTerms((p) => p.filter((t) => t !== term))} disabled={pending} className="hover:text-red-600 transition-colors cursor-pointer" title="Hapus kata ini" aria-label={`Hapus istilah ${term}`}>
                    <Trash2 className="w-3 h-3 text-slate-500 hover:text-red-600" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-slate-500">
            {terms.length} / {MAX_TERMS} istilah &bull; terakhir diperbarui {formatDateTime(policy.updated_at)}
          </p>
        </section>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 bg-white/95 backdrop-blur-md border border-[#BFDBFE] rounded-2xl px-5 py-3 shadow-lg">
        <span className="text-xs font-bold text-slate-500">{dirty ? 'Ada perubahan yang belum disimpan.' : 'Semua perubahan tersimpan.'}</span>
        <div className="flex gap-2">
          <button type="button" onClick={reset} disabled={!dirty || pending} className={btnSecondary}>
            Batalkan Perubahan
          </button>
          <button type="submit" disabled={!dirty || pending} className={btnPrimary}>
            {pending ? <Spinner /> : <Save className="w-4 h-4" aria-hidden="true" />}
            Simpan Kebijakan
          </button>
        </div>
      </div>
    </form>
  );
};

export const AdminPolicy: React.FC = () => {
  const queryClient = useQueryClient();
  const { notice, show, clear } = useNotice();
  const policy = useQuery({
    queryKey: queryKeys.admin.policy,
    queryFn: ({ signal }) => adminGetPolicy(signal),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={<FileCheck className="w-6 h-6" />}
        title={
          <>
            Content <span className="text-[#2563EB]">Policy</span> &amp; Sensor Moderasi
          </>
        }
        description="Atur istilah terlarang, tingkat moderasi, dan disclaimer per kategori. Perubahan berlaku pada permintaan generasi berikutnya."
        actions={
          <span className="px-3 py-1 rounded-full bg-white border border-[#BFDBFE] text-[11px] font-bold text-[#1E40AF] inline-flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            Istilah yang cocok tidak pernah dikutip ke pengguna
          </span>
        }
      />
      <NoticeBanner notice={notice} onDismiss={clear} />
      {policy.isPending && <LoadingBlock label="Memuat kebijakan..." />}
      {policy.isError && <ErrorState error={policy.error} onRetry={() => void policy.refetch()} title="Kebijakan tidak dapat dimuat" />}
      {policy.data && (
        <PolicyForm
          key={policy.data.updated_at}
          policy={policy.data}
          onSaved={(next) => {
            queryClient.setQueryData(queryKeys.admin.policy, next);
            show('success', 'Kebijakan konten berhasil disimpan dan langsung berlaku.');
          }}
        />
      )}
    </div>
  );
};
export default AdminPolicy;
