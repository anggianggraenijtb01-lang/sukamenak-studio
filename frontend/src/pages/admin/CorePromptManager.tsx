import React, { useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeOff, History, KeyRound, Lock, Play, ShieldCheck, Terminal } from 'lucide-react';
import {
  adminActivateCorePrompt,
  adminCreateCorePrompt,
  adminGetTemplate,
  adminListCorePrompts,
  adminListTemplates,
  adminTestRenderCorePrompt,
} from '../../api/admin';
import { queryKeys } from '../../api/queryKeys';
import type {
  CorePromptMeta,
  CorePromptTestRenderResponse,
  TemplateCategory,
  TemplateSubject,
} from '../../api/types';
import { corePromptErrorMessage, toFormError } from '../../components/admin/adminErrors';
import { CATEGORY_LABELS, formatDateTime } from '../../components/admin/format';
import { StandInPromptBanner } from '../../components/admin/StandInPromptBanner';
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
  inputCls,
  selectCls,
  useNotice,
} from '../../components/admin/ui';

/** The blank marker of a core prompt. Counted locally only to give feedback while typing; the server validates. */
export const BLANK_TOKEN = '[___]';
export const MIN_BODY_LENGTH = 20;
const PUBLICATIONS = Object.keys(CATEGORY_LABELS) as TemplateCategory[];
const PAGE_SIZE = 100;

const monoInput = 'w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-mono text-xs focus:outline-none focus:border-[#2563EB] disabled:opacity-60';

export const CorePromptManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { notice, show, clear } = useNotice(8000);

  // ---- write-only editor. The body only ever lives in this state, until the request succeeds. ----------
  const [editorContent, setEditorContent] = useState('');
  const [promptKey, setPromptKey] = useState('');
  const [subject, setSubject] = useState<TemplateSubject>('product');
  const [publication, setPublication] = useState<TemplateCategory>('poster');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<{ message: string; fields: Record<string, string> } | null>(null);
  const [created, setCreated] = useState<CorePromptMeta | null>(null);
  const [page, setPage] = useState(1);
  const [activating, setActivating] = useState<CorePromptMeta | null>(null);

  const placeholderCount = editorContent.split(BLANK_TOKEN).length - 1;

  const prompts = useQuery({
    queryKey: queryKeys.admin.corePrompts.list({ page, limit: PAGE_SIZE }),
    queryFn: ({ signal }) => adminListCorePrompts({ page, limit: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const groups = useMemo(() => {
    const map = new Map<string, CorePromptMeta[]>();
    for (const p of prompts.data?.items ?? []) map.set(p.key, [...(map.get(p.key) ?? []), p]);
    return [...map.entries()].map(([key, versions]) => ({ key, versions: versions.sort((a, b) => b.version - a.version) }));
  }, [prompts.data]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.corePrompts.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.templates.all });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const key = promptKey.trim();
    const local: Record<string, string> = {};
    if (!key) local.key = 'Key wajib diisi, contoh: product.poster';
    if (editorContent.trim().length < MIN_BODY_LENGTH) local.body = `Master prompt minimal ${MIN_BODY_LENGTH} karakter.`;
    else if (placeholderCount < 1) local.body = 'Master prompt wajib memiliki minimal satu placeholder [___] untuk injeksi slot.';
    if (Object.keys(local).length > 0) {
      setFormError({ message: 'Periksa kembali isian yang ditandai.', fields: local });
      return;
    }

    setSending(true);
    try {
      const meta = await adminCreateCorePrompt({ key, subject, publication, body: editorContent });
      setEditorContent(''); // write-only: the plaintext leaves the view as soon as the server has it
      setCreated(meta);
      show('success', `Versi ${meta.version} dari "${meta.key}" tersimpan terenkripsi di server (${meta.blank_count} isian). Versi ini belum aktif.`);
      refresh();
    } catch (err) {
      const fe = toFormError(err);
      fe.message = corePromptErrorMessage(err);
      setFormError(fe);
    } finally {
      setSending(false);
    }
  };

  const keys = groups.map((g) => g.key);

  return (
    <div className="space-y-5">
      {/* HEADER MENU CORE PROMPT MANAGER */}
      <PageHeader
        icon={<Lock className="w-5 h-5" />}
        title={
          <>
            Core Prompt <span className="text-[#2563EB]">Manager (AES-256-GCM)</span>
          </>
        }
        description={
          <>
            Write-Only Mode: master prompt dikirim sekali, dienkripsi di server, dan tidak pernah ditampilkan kembali. Penanda isian:{' '}
            <code className="text-[#1E40AF] font-bold">{BLANK_TOKEN}</code>.
          </>
        }
        actions={
          <span className="px-3 py-1 rounded-full bg-[#F0F9FF] border border-[#0284C7] text-[#0F172A] text-xs font-mono font-bold inline-flex items-center gap-1.5">
            <EyeOff className="w-3.5 h-3.5 text-[#1E40AF]" aria-hidden="true" />
            Write-Only Mode (AES-256-GCM)
          </span>
        }
      />

      <NoticeBanner notice={notice} onDismiss={clear} />

      {/* Active prompts that are still the committed stand-in: production refuses to generate from them. */}
      <StandInPromptBanner keys={groups.filter((g) => g.versions.some((v) => v.is_active && v.is_placeholder)).map((g) => g.key)} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ---------------- create a new version ---------------- */}
        <form onSubmit={handleSubmit} noValidate className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-5 space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
            <span className="text-xs font-mono font-bold text-[#0F172A]">master_prompt_vault.aes256 (Write-Only)</span>
            <span className="text-[11px] font-mono text-[#0369A1] font-bold" aria-live="polite">
              Placeholder: {placeholderCount}x {BLANK_TOKEN}
            </span>
          </div>

          {formError && <Banner kind="error">{formError.message}</Banner>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Field label="Key" htmlFor="cp-key" error={formError?.fields.key}>
              <input
                id="cp-key"
                type="text"
                list="cp-keys"
                value={promptKey}
                onChange={(e) => setPromptKey(e.target.value)}
                disabled={sending}
                placeholder="product.poster"
                autoComplete="off"
                className={monoInput}
              />
              <datalist id="cp-keys">
                {keys.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </Field>
            <Field label="Subjek" htmlFor="cp-subject" error={formError?.fields.subject}>
              <select id="cp-subject" value={subject} onChange={(e) => setSubject(e.target.value as TemplateSubject)} disabled={sending} className={monoInput}>
                <option value="product">product</option>
                <option value="human_model">human_model</option>
              </select>
            </Field>
            <Field label="Publikasi" htmlFor="cp-publication" error={formError?.fields.publication}>
              <select id="cp-publication" value={publication} onChange={(e) => setPublication(e.target.value as TemplateCategory)} disabled={sending} className={monoInput}>
                {PUBLICATIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-[11px] text-slate-500">
            Key yang sudah ada otomatis membuat versi berikutnya; subjek dan publikasi harus sama dengan versi sebelumnya. Placeholder bernama yang diizinkan:{' '}
            <code>{'{{subject_lock}}'}</code>, <code>{'{{negative}}'}</code>, <code>{'{{text_zone}}'}</code>, <code>{'{{aspect_ratio}}'}</code>, <code>{'{{brand_palette}}'}</code>.
          </p>

          <Field label="Isi master prompt (tidak pernah ditampilkan kembali)" htmlFor="cp-body" error={formError?.fields.body}>
            <textarea
              id="cp-body"
              rows={9}
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              placeholder="Tulis core prompt versi baru. Gunakan [___] untuk setiap isian slot. Isi tidak pernah ditampilkan kembali."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={sending}
              className="w-full p-3.5 rounded-xl bg-[#F8FAFC] border border-[#0F172A] font-mono text-xs text-[#0F172A] leading-relaxed focus:bg-white focus:outline-none focus:border-[#0284C7] disabled:opacity-60"
            />
          </Field>

          {created && (
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] font-mono text-[11px] text-[#475569] space-y-1" data-testid="last-version">
              <div className="flex items-center justify-between text-[#1E40AF] font-bold">
                <span className="inline-flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                  Versi terakhir dikirim: {created.key} v{created.version} ({created.blank_count} isian)
                </span>
                <span>{created.is_active ? 'AKTIF' : 'BELUM AKTIF'}</span>
              </div>
              {!created.is_active && (
                <button type="button" onClick={() => setActivating(created)} className="text-[#EA580C] font-bold hover:underline cursor-pointer">
                  Aktifkan versi ini
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="w-full py-2.5 rounded-xl bg-[#C2410C] hover:bg-[#9A3412] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
          >
            {sending ? <Spinner className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" aria-hidden="true" />}
            {sending ? 'Mengirim...' : 'Kirim Versi Baru Master Prompt (Terenkripsi di Server)'}
          </button>
        </form>

        {/* ---------------- test render ---------------- */}
        <TestRenderPanel groups={groups} />
      </div>

      {/* ---------------- versions per key ---------------- */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-5 space-y-4 shadow-2xs" aria-label="Versi core prompt">
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2.5">
          <History className="w-4 h-4 text-[#1E40AF]" aria-hidden="true" />
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A]">Versi per Key (hanya metadata)</h2>
        </div>
        {prompts.isPending && <LoadingBlock label="Memuat versi..." />}
        {prompts.isError && !prompts.data && <ErrorState error={prompts.error} onRetry={() => void prompts.refetch()} title="Daftar versi tidak dapat dimuat" />}
        {prompts.data && groups.length === 0 && (
          <EmptyState icon={<Lock className="w-6 h-6" />} title="Belum ada core prompt" hint="Kirim versi pertama lewat formulir di atas. Template tidak dapat diterbitkan tanpa core prompt aktif." />
        )}
        {groups.map((g) => (
          <div key={g.key} className="rounded-2xl border border-slate-200 overflow-hidden" data-testid={`group-${g.key}`}>
            <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-slate-200 flex flex-wrap items-center gap-2">
              <code className="text-xs font-bold text-[#0F172A]">{g.key}</code>
              <Badge tone="slate">{g.versions[0].subject}</Badge>
              <Badge tone="slate">{g.versions[0].publication}</Badge>
              {g.versions.some((v) => v.is_active) ? <Badge tone="blue">Ada versi aktif</Badge> : <Badge tone="amber">Belum ada versi aktif</Badge>}
            </div>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`Tabel versi core prompt ${g.key} (geser untuk melihat kolom lain)`}>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 font-bold border-b border-slate-100">
                    <th className="py-2 px-4">Versi</th>
                    <th className="py-2 px-4">Status</th>
                    <th className="py-2 px-4">Isian [___]</th>
                    <th className="py-2 px-4">Dipakai template</th>
                    <th className="py-2 px-4">Dibuat</th>
                    <th className="py-2 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {g.versions.map((v) => (
                    <tr key={v.id}>
                      <td className="py-2 px-4 font-mono font-bold">v{v.version}</td>
                      <td className="py-2 px-4 space-x-1">
                        {v.is_active ? <Badge tone="blue">Aktif</Badge> : <Badge tone="slate">Tidak aktif</Badge>}
                        {v.is_placeholder && <Badge tone="amber">Pengganti</Badge>}
                      </td>
                      <td className="py-2 px-4 font-mono">{v.blank_count}</td>
                      <td className="py-2 px-4 font-mono">{v.templates_using}</td>
                      <td className="py-2 px-4 text-slate-500">
                        {formatDateTime(v.created_at)}
                        {v.created_by && <span className="block text-[11px]">oleh {v.created_by.name}</span>}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {v.is_active ? (
                          <span className="text-[11px] text-slate-500">Versi berjalan</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActivating(v)}
                            aria-label={`Aktifkan ${v.key} versi ${v.version}`}
                            className="px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-[#2563EB] hover:text-[#2563EB] text-slate-600 text-xs font-bold cursor-pointer"
                          >
                            Aktifkan
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <Pagination meta={prompts.data?.meta} onPage={setPage} busy={prompts.isFetching} noun="versi" />
      </section>

      {activating && (
        <ConfirmModal
          title="Aktifkan versi ini?"
          confirmLabel="Aktifkan"
          message={
            <>
              <strong>
                {activating.key} v{activating.version}
              </strong>{' '}
              akan menjadi satu-satunya versi aktif untuk key ini dan dipakai generasi berikutnya. Ditolak otomatis bila ada template terbit yang jumlah slot ber-blank-nya tidak sama dengan {activating.blank_count} isian.
            </>
          }
          formatError={corePromptErrorMessage}
          onClose={() => setActivating(null)}
          onConfirm={async () => {
            const meta = await adminActivateCorePrompt(activating.id);
            setCreated((c) => (c && c.id === meta.id ? meta : c));
            show('success', `Versi ${meta.version} dari "${meta.key}" sekarang aktif.`);
            refresh();
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------------
// Test render
// ---------------------------------------------------------------------------------------------------

const TestRenderPanel: React.FC<{ groups: Array<{ key: string; versions: CorePromptMeta[] }> }> = ({ groups }) => {
  const [testKey, setTestKey] = useState('');
  const [versionId, setVersionId] = useState(''); // '' = active version of the key
  const [templateId, setTemplateId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CorePromptTestRenderResponse | null>(null);
  const [error, setError] = useState<unknown>(null);

  const effectiveKey = testKey || groups[0]?.key || '';
  const versions = groups.find((g) => g.key === effectiveKey)?.versions ?? [];
  const selectedVersion = versions.find((v) => v.id === versionId) ?? versions.find((v) => v.is_active) ?? versions[0];

  const templates = useQuery({
    queryKey: queryKeys.admin.templates.list({ limit: 100 }),
    queryFn: ({ signal }) => adminListTemplates({ limit: 100 }, signal),
    staleTime: 60_000,
  });
  const template = useQuery({
    queryKey: queryKeys.admin.templates.detail(templateId),
    queryFn: ({ signal }) => adminGetTemplate(templateId, signal),
    enabled: !!templateId,
    staleTime: 30_000,
  });

  // Slots to fill: the template's own slots, or generic blank_1..blank_n when no template is chosen.
  const slotInputs: Array<{ key: string; label: string }> = templateId
    ? (template.data?.slots ?? []).map((s) => ({ key: s.key, label: `${s.label} (${s.key}${s.blank_index != null ? `, blank ${s.blank_index}` : ''})` }))
    : Array.from({ length: selectedVersion?.blank_count ?? 0 }, (_, i) => ({ key: `blank_${i + 1}`, label: `blank_${i + 1}` }));

  const run = async () => {
    if (!effectiveKey) return;
    setRunning(true);
    setError(null);
    try {
      const slot_values: Record<string, string> = {};
      for (const s of slotInputs) if (values[s.key]?.trim()) slot_values[s.key] = values[s.key].trim();
      const slug = templates.data?.items.find((t) => t.id === templateId)?.slug;
      const res = await adminTestRenderCorePrompt({
        ...(versionId ? { id: versionId } : { key: effectiveKey }),
        ...(slug ? { template_slug: slug } : {}),
        slot_values,
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      });
      setResult(res);
    } catch (err) {
      setResult(null);
      setError(err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-5 space-y-3.5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#1E40AF]" aria-hidden="true" />
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A]">Test Render Preview [HIDDEN_CORE_PROMPT]</h2>
        </div>
        <Play className="w-3.5 h-3.5 text-[#EA580C]" aria-hidden="true" />
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-slate-500">Belum ada core prompt untuk diuji.</p>
      ) : (
        <div className="space-y-2.5 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Key yang diuji" htmlFor="tr-key">
              <select
                id="tr-key"
                value={effectiveKey}
                onChange={(e) => {
                  setTestKey(e.target.value);
                  setVersionId('');
                  setResult(null);
                }}
                className={monoInput}
              >
                {groups.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.key}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Versi yang diuji" htmlFor="tr-version">
              <select
                id="tr-version"
                value={versionId}
                onChange={(e) => {
                  setVersionId(e.target.value);
                  setResult(null);
                }}
                className={monoInput}
              >
                <option value="">Versi aktif</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version}
                    {v.is_active ? ' (aktif)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Template (opsional)" htmlFor="tr-template" hint="Tanpa template, isian dialamatkan sebagai blank_1, blank_2, ...">
            <select
              id="tr-template"
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                setValues({});
                setResult(null);
              }}
              className={monoInput}
            >
              <option value="">Tanpa template</option>
              {templates.data?.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </Field>

          {templateId && template.isPending && <LoadingBlock label="Memuat slot template..." className="!py-3" />}
          {templateId && template.isError && <Banner kind="error">Slot template tidak dapat dimuat.</Banner>}

          {slotInputs.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {slotInputs.map((s) => (
                <Field key={s.key} label={s.label} htmlFor={`tr-slot-${s.key}`}>
                  <input
                    id={`tr-slot-${s.key}`}
                    type="text"
                    value={values[s.key] ?? ''}
                    onChange={(e) => setValues((p) => ({ ...p, [s.key]: e.target.value }))}
                    className={monoInput}
                    autoComplete="off"
                  />
                </Field>
              ))}
            </div>
          )}

          <Field label="Catatan uji (remarks)" htmlFor="tr-remarks">
            <input id="tr-remarks" type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} className={monoInput} autoComplete="off" />
          </Field>
          <button
            type="button"
            disabled={running || !effectiveKey}
            onClick={() => void run()}
            className="w-full py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-extrabold text-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {running && <Spinner className="w-3.5 h-3.5" />}
            {running ? 'Menguji...' : `Uji Render "${effectiveKey || '...'}"`}
          </button>
        </div>
      )}

      {error != null && <Banner kind="error">{corePromptErrorMessage(error)}</Banner>}

      <div className="p-3.5 rounded-xl bg-[#F0F9FF] border border-[#0284C7] font-mono text-xs text-[#0F172A] space-y-1.5" data-testid="masked-output">
        <div className="flex items-center justify-between text-[10px] text-[#0369A1] font-bold">
          <span>OUTPUT COMPILER (MASKED):</span>
          <span>{result ? `v${result.core_prompt.version} - ${result.filled_count} terisi / ${result.empty_count} kosong` : 'BELUM DIUJI'}</span>
        </div>
        <pre className="whitespace-pre-wrap text-[11px] leading-relaxed">{result ? result.masked_prompt : '[HIDDEN_CORE_PROMPT]'}</pre>
      </div>

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0369A1]">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Status per isian ({result.core_prompt.key} v{result.core_prompt.version}, {result.core_prompt.blank_count} isian)
          </div>
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="text-slate-500 font-bold border-b border-slate-100">
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Slot</th>
                <th className="py-1 pr-2">Status</th>
                <th className="py-1">Sumber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.blanks.map((b) => (
                <tr key={b.index}>
                  <td className="py-1 pr-2 font-mono">{b.index}</td>
                  <td className="py-1 pr-2 font-mono">{b.slot_key}</td>
                  <td className="py-1 pr-2">{b.status === 'filled' ? <Badge tone="green">Terisi</Badge> : <Badge tone="amber">Kosong</Badge>}</td>
                  <td className="py-1 font-mono text-slate-500">{b.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.remarks_dropped && <Banner kind="warning">Catatan uji dibuang oleh penyaring server (mengandung isi yang tidak diizinkan).</Banner>}
          {!result.remarks_dropped && result.sanitized_remarks && (
            <p className="text-[11px] text-slate-500">
              Catatan setelah disaring: <span className="font-mono text-slate-700">{result.sanitized_remarks}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
