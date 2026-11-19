import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, RotateCcw, Sliders, Sparkles, ImageIcon, UserCheck } from 'lucide-react';
import { useMe } from '../../auth/AuthProvider';
import { createGeneration, getTemplate, listTemplates } from '../../api/creator';
import { fileUrl } from '../../api/client';
import { getErrorMessage, isApiError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import { useGenerationPolling } from '../../api/useGenerationPolling';
import type { GenerationMode, ReferenceRole } from '../../api/types';
import { CompactnessBar } from '../../components/creator/CompactnessMeter';
import { downloadImage } from '../../components/creator/download';
import { aspectRatioValue, dimensionsLabel, generationTitle, resultFileName } from '../../components/creator/format';
import { DegradedNotice, GenerationErrorNotice, GenerationStepper } from '../../components/creator/GenerationNotices';
import { readStudioHandoff } from '../../components/creator/handoff';
import { categoryLabel } from '../../components/creator/labels';
import { usePromptAnalysis } from '../../components/creator/promptAnalysis';
import { ReferencePicker } from '../../components/creator/ReferencePicker';
import { RemarksField } from '../../components/creator/RemarksField';
import { SlotField } from '../../components/creator/SlotField';
import { ErrorBlock, FieldError, LoadingBlock } from '../../components/creator/StateViews';
import {
  DEFAULT_MAX_REFERENCES,
  MAX_REMARKS_LENGTH,
  SUBMIT_BLOCK_HINTS,
  allowedModes,
  buildGenerationRequest,
  defaultUploadRole,
  imageSlots,
  initialSlotValues,
  needsConsent,
  overlaySlots,
  parseMaxReferences,
  pickDefaultTemplate,
  pickMode,
  referenceBadge,
  slotFieldName,
  submitBlock,
  validateSubmission,
} from '../../components/creator/studioLogic';
import { TemplatePicker } from '../../components/creator/TemplatePicker';
import { useReferences } from '../../components/creator/useReferences';

const MODE_LABELS: Record<GenerationMode, string> = {
  i2i: 'Foto ke Gambar (Utama)',
  t2i: 'Teks ke Gambar',
};

interface SubmitProblem {
  code: string;
}

export const StudioGenerator: React.FC = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { data: me } = useMe();
  const remaining = me?.usage.remaining_today ?? null;

  const requestedSlug = searchParams.get('template');
  const requestedMode = searchParams.get('mode') === 't2i' ? 't2i' : searchParams.get('mode') === 'i2i' ? 'i2i' : null;

  // ---- template ----------------------------------------------------------------------------------------
  const templatesQuery = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: ({ signal }) => listTemplates(undefined, signal),
    staleTime: 5 * 60_000,
  });
  const templates = templatesQuery.data ?? [];
  const [slug, setSlug] = useState<string | null>(requestedSlug);
  const [unknownTemplate, setUnknownTemplate] = useState(false);

  useEffect(() => {
    if (requestedSlug) setSlug(requestedSlug);
  }, [requestedSlug]);

  useEffect(() => {
    if (!templatesQuery.data) return;
    if (slug && templatesQuery.data.some((t) => t.slug === slug)) return;
    if (slug) setUnknownTemplate(true);
    setSlug(pickDefaultTemplate(templatesQuery.data, requestedMode ?? 'i2i')?.slug ?? null);
  }, [templatesQuery.data, slug, requestedMode]);

  const templateQuery = useQuery({
    queryKey: queryKeys.templates.detail(slug ?? ''),
    queryFn: ({ signal }) => getTemplate(slug as string, signal),
    enabled: !!slug && !!templatesQuery.data?.some((t) => t.slug === slug),
    staleTime: 5 * 60_000,
  });
  const template = templateQuery.data ?? null;

  // ---- form state --------------------------------------------------------------------------------------
  const [values, setValues] = useState<Record<string, string>>({});
  // A deep link (`?mode=t2i`) picks the mode; the template then narrows it to what it allows.
  const [mode, setMode] = useState<GenerationMode>(requestedMode ?? 'i2i');
  const [remarks, setRemarks] = useState(() => readStudioHandoff(location.state)?.prompt.slice(0, MAX_REMARKS_LENGTH) ?? '');
  const [consent, setConsent] = useState(false);
  const [uploadRole, setUploadRole] = useState<ReferenceRole>('product');
  const [maxRefs, setMaxRefs] = useState(DEFAULT_MAX_REFERENCES);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitProblem, setSubmitProblem] = useState<SubmitProblem | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const refSet = useReferences(maxRefs);

  // A new template resets the slot form (the remarks and the picked photos stay: they are about the product).
  const templateSlugLoaded = template?.slug ?? null;
  useEffect(() => {
    if (!template) return;
    setValues(initialSlotValues(template));
    setMode((current) => pickMode(template, current));
    setUploadRole(defaultUploadRole(template));
    setConsent(false);
    setFieldErrors({});
    setSubmitProblem(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateSlugLoaded]);

  // ---- generation --------------------------------------------------------------------------------------
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const polling = useGenerationPolling(generationId);
  const generation = generationId ? polling.generation : undefined;
  const generating = submitting || (!!generationId && !polling.isFinished && polling.isPolling);
  const done = generation?.status === 'done' ? generation : null;
  const failed = generation?.status === 'failed' ? generation : null;
  const resultUrl = done?.result_url ? fileUrl(done.result_url) : null;

  const analysis = usePromptAnalysis(remarks);
  const modes = template ? allowedModes(template) : [];
  const usedRefs = mode === 'i2i' ? refSet.ready : [];
  const consentNeeded = needsConsent(template, usedRefs);
  const block = submitBlock({
    template,
    remainingToday: remaining,
    consentNeeded,
    consentGiven: consent,
    uploading: refSet.uploading,
    generating: generating || cooldown > 0,
  });

  // The "upload a photo" message goes away as soon as the photo list changes.
  const refCount = refSet.refs.length;
  useEffect(() => {
    setFieldErrors((prev) => {
      if (!('reference_ids' in prev)) return prev;
      const { reference_ids: _gone, ...rest } = prev;
      return rest;
    });
  }, [refCount]);

  // Cooldown after RATE_LIMIT_EXCEEDED: the button comes back by itself.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const setValue = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const field = slotFieldName(key);
      if (!(field in prev)) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || block || !template) return;
    setSubmitProblem(null);

    const local = validateSubmission({ template, mode, values, refs: usedRefs, maxReferences: maxRefs });
    setFieldErrors(local);
    if (Object.keys(local).length > 0) {
      const first = Object.keys(local)[0];
      document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setGenerationId(null);
    try {
      const created = await createGeneration(
        buildGenerationRequest({ template, mode, values, remarks, refs: usedRefs, consent }),
      );
      setGenerationId(created.id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    } catch (err) {
      if (isApiError(err)) {
        setSubmitProblem({ code: err.code });
        if (err.errors.length > 0) setFieldErrors(err.fieldErrors);
        if (err.code === 'DAILY_LIMIT_REACHED') void queryClient.invalidateQueries({ queryKey: queryKeys.me });
        if (err.code === 'RATE_LIMIT_EXCEEDED') setCooldown(10);
        if (err.code === 'TOO_MANY_REFERENCES') {
          const learned = parseMaxReferences(err.serverMessage);
          if (learned) setMaxRefs(learned);
        }
      } else {
        setSubmitProblem({ code: 'INTERNAL_ERROR' });
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // ---- download ----------------------------------------------------------------------------------------
  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    if (!resultUrl || !done) return;
    setDownloading(true);
    try {
      await downloadImage(resultUrl, resultFileName(generationTitle(done)));
    } finally {
      setDownloading(false);
    }
  };

  const ratio = template?.aspect_ratio ?? '4:5';
  const ratioValue = aspectRatioValue(ratio);
  const previewUrl = resultUrl ?? (template?.preview_url ? fileUrl(template.preview_url) : null);
  const displayedProblem = failed ? failed.error_code : submitProblem?.code;
  const blockedHint = block && block !== 'generating' ? (cooldown > 0 && !generating ? `Tunggu ${cooldown} detik sebelum mencoba lagi.` : SUBMIT_BLOCK_HINTS[block]) : null;
  const pollError = generationId && !generation && polling.error ? polling.error : null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 sm:p-7 shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
            Studio <span className="text-[#2563EB]">Generator</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-1 font-normal">
            Generator visual promosi komersial mandiri untuk UMKM &amp; kreator pengguna Sukamenak Studio.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ── LEFT COLUMN: TEMPLATE, SLOTS, REFERENCES ── */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-[#0F172A] tracking-tight flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#2563EB]" />
              <span>Pengaturan Desain Poster</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">Langkah Praktis</span>
          </div>

          {templatesQuery.isLoading ? (
            <LoadingBlock label="Memuat template..." />
          ) : templatesQuery.isError ? (
            <ErrorBlock error={templatesQuery.error} onRetry={() => void templatesQuery.refetch()} title="Template tidak dapat dimuat" />
          ) : templates.length === 0 ? (
            <ErrorBlock error={null} title="Belum ada template yang dipublikasikan" />
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-label="Formulir pembuatan desain">
              {unknownTemplate && (
                <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-semibold">
                  Template yang diminta tidak ditemukan atau belum dipublikasikan. Template lain dipilih untuk Anda.
                </div>
              )}

              <div>
                <span className="block text-xs font-bold text-[#0F172A] mb-2">Pilih Template</span>
                <TemplatePicker templates={templates} selectedSlug={slug} onSelect={setSlug} disabled={generating} />
              </div>

              {templateQuery.isLoading || (!template && !templateQuery.isError) ? (
                <LoadingBlock label="Memuat isian template..." className="py-8" />
              ) : templateQuery.isError || !template ? (
                <ErrorBlock error={templateQuery.error} onRetry={() => void templateQuery.refetch()} title="Isian template tidak dapat dimuat" />
              ) : (
                <>
                  {template.description && <p className="text-xs text-slate-500 leading-relaxed">{template.description}</p>}

                  {/* Mode: only what the template allows. */}
                  <div>
                    <span className="block text-xs font-bold text-[#0F172A] mb-2">Metode Pembuatan</span>
                    <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-[#F8FAFC] border border-[#CBD5E1]" role="radiogroup" aria-label="Metode pembuatan">
                      {modes.map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={mode === m}
                          disabled={generating}
                          onClick={() => {
                            setMode(m);
                            setFieldErrors((prev) => {
                              const { reference_ids: _r, mode: _m, ...rest } = prev;
                              return rest;
                            });
                          }}
                          className={`px-5 py-2 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                            mode === m ? 'bg-[#2563EB] text-white shadow-xs' : 'text-slate-600 hover:text-[#0F172A]'
                          }`}
                        >
                          {MODE_LABELS[m]}
                        </button>
                      ))}
                    </div>
                    {modes.length === 1 && (
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        Template ini hanya mendukung metode {modes[0] === 'i2i' ? 'Foto ke Gambar' : 'Teks ke Gambar'}.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-[#F8FAFC] border border-slate-200 px-4 py-2.5">
                    <span className="text-xs font-bold text-[#0F172A]">Ukuran &amp; Rasio Desain</span>
                    <span className="text-[11px] font-mono text-[#2563EB] font-bold">Rasio {ratio} (mengikuti template)</span>
                  </div>

                  {mode === 'i2i' ? (
                    <ReferencePicker
                      refs={refSet.refs}
                      maxRefs={maxRefs}
                      uploadRole={uploadRole}
                      onUploadRoleChange={setUploadRole}
                      onUpload={(files, role) => void refSet.upload(files, role, consent)}
                      onRemove={refSet.remove}
                      onPickExisting={refSet.addExisting}
                      onForget={refSet.forget}
                      problem={refSet.problem}
                      fieldError={fieldErrors.reference_ids}
                      disabled={generating}
                      templateSlug={template.slug}
                    />
                  ) : (
                    <div className="rounded-2xl bg-[#F8FAFC] border border-slate-200 px-4 py-3 text-[11px] text-slate-500 leading-relaxed">
                      Mode Teks ke Gambar: desain dibuat dari isian dan deskripsi di bawah, tanpa foto referensi.
                    </div>
                  )}

                  {consentNeeded && (
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5">
                      <label htmlFor="studio-consent" className="flex items-start gap-3 cursor-pointer">
                        <input
                          id="studio-consent"
                          type="checkbox"
                          checked={consent}
                          disabled={generating}
                          onChange={(e) => {
                            setConsent(e.target.checked);
                            setSubmitProblem((p) => (p?.code === 'CONSENT_REQUIRED' ? null : p));
                          }}
                          aria-describedby="studio-consent-help"
                          className="mt-0.5 w-4 h-4 rounded accent-[#2563EB] shrink-0"
                        />
                        <span id="studio-consent-help" className="text-xs text-amber-900 leading-relaxed font-medium">
                          <span className="font-black flex items-center gap-1.5 mb-0.5">
                            <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            Persetujuan foto orang
                          </span>
                          Saya menyatakan sudah mendapat persetujuan dari orang yang tampil pada foto atau gambar ini untuk diolah dengan AI. Foto model manusia dihapus otomatis
                          setelah 7 hari.{' '}
                          <Link to="/privasi" target="_blank" rel="noopener noreferrer" className="font-black text-[#1E40AF] underline">
                            Baca Kebijakan Privasi
                          </Link>
                          .
                        </span>
                      </label>
                      <FieldError message={fieldErrors.consent_confirmed} />
                    </div>
                  )}

                  <SlotSection title="Isian Gambar" slots={imageSlots(template)} values={values} errors={fieldErrors} onChange={setValue} disabled={generating} />
                  <SlotSection
                    title="Teks pada Gambar"
                    note="Teks ini ditempel otomatis oleh aplikasi pada area yang sudah disiapkan template, bukan digambar oleh AI."
                    slots={overlaySlots(template)}
                    values={values}
                    errors={fieldErrors}
                    onChange={setValue}
                    disabled={generating}
                  />

                  <RemarksField
                    value={remarks}
                    onChange={(v) => {
                      setRemarks(v);
                      setFieldErrors((prev) => {
                        const { remarks: _r, ...rest } = prev;
                        return rest;
                      });
                    }}
                    error={fieldErrors.remarks}
                    disabled={generating}
                  >
                    <CompactnessBar state={analysis} />
                  </RemarksField>
                </>
              )}

              {displayedProblem && !failed && <GenerationErrorNotice code={displayedProblem} />}
              {failed && (
                <GenerationErrorNotice code={failed.error_code ?? 'INTERNAL_ERROR'}>
                  <div className="font-semibold pt-1 text-[#9A3412]">Isian Anda tetap tersimpan di formulir. Tekan tombol di bawah untuk mencoba lagi.</div>
                </GenerationErrorNotice>
              )}
              {pollError && (
                <div role="alert" className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-[#EA580C] font-semibold flex items-center justify-between gap-3">
                  <span>Status desain tidak dapat dipantau: {getErrorMessage(pollError)} Cek halaman Riwayat.</span>
                  <button type="button" onClick={() => void polling.refetch()} className="underline font-black cursor-pointer">
                    Muat ulang
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {me && (
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500" aria-live="polite">
                    <span>
                      Sisa kuota hari ini:{' '}
                      <strong className={me.usage.remaining_today <= 0 ? 'text-[#EA580C]' : 'text-[#2563EB]'}>{me.usage.remaining_today}</strong> / {me.usage.daily_limit}
                    </span>
                    {me.usage.in_flight > 0 && <span>{me.usage.in_flight} desain sedang diproses</span>}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={!!block || !template}
                  aria-disabled={!!block || !template}
                  className="w-full py-4 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25 transition-all hover:shadow-2xl hover:shadow-blue-500/35 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : failed ? <RotateCcw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  <span>{generating ? 'Sedang Memproses Poster...' : failed ? 'Coba Lagi' : 'Buat Poster Instan'}</span>
                </button>
                {blockedHint && (
                  <p role="status" className="text-[11px] text-center font-semibold text-slate-500">
                    {blockedHint}
                  </p>
                )}
              </div>
            </form>
          )}
        </div>

        {/* ── RIGHT COLUMN: PREVIEW, STEPPER, DOWNLOAD ── */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-8 shadow-sm space-y-5 lg:sticky lg:top-24">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] block">PRATINJAU HASIL</span>
              <h3 className="text-base font-black text-[#0F172A]">
                {done ? 'Hasil Desain Anda' : `Draf ${template ? categoryLabel(template.category) : 'Desain'} Rasio ${ratio}`}
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#0F172A] text-white text-[10px] font-mono font-bold whitespace-nowrap">
              {done ? `${ratio} HD (${dimensionsLabel(done) ?? ratio})` : `Rasio ${ratio}`}
            </span>
          </div>

          <div
            className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-slate-900 mx-auto"
            style={{ aspectRatio: String(ratioValue), width: `min(100%, ${Math.round(520 * ratioValue)}px)` }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={done ? `Hasil desain ${generationTitle(done)}` : template ? `Contoh template ${template.name}` : 'Pratinjau'}
                className={`w-full h-full object-cover transition-all duration-700 ${generating ? 'scale-105 filter blur-xs' : 'scale-100'}`}
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500">
                <ImageIcon className="w-10 h-10" aria-hidden="true" />
                <span className="text-xs font-semibold">Pratinjau akan muncul di sini</span>
              </div>
            )}
            {!done && previewUrl && !generating && (
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider border border-white/20">
                Contoh template
              </span>
            )}
            {generating && (
              <div role="status" className="absolute inset-0 bg-black/50 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-3 p-6 text-center">
                <div className="w-10 h-10 border-4 border-white/20 border-t-[#2563EB] rounded-full animate-spin" />
                <span className="text-sm font-bold">Menyusun Komposisi AI...</span>
              </div>
            )}
          </div>

          {done && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  data-testid="reference-badge"
                  className={`px-3 py-1 rounded-full text-[11px] font-black border ${
                    done.used_reference_image ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {referenceBadge(done)}
                </span>
                {usedRefs.length > 0 && !done.used_reference_image && mode === 'i2i' && (
                  <span className="text-[11px] text-slate-400">Foto referensi tidak dipakai langsung pada desain ini.</span>
                )}
              </div>
              {done.degraded && <DegradedNotice />}
              {template?.disclaimer && <p className="text-[11px] text-slate-400 italic leading-relaxed">{template.disclaimer}</p>}
            </div>
          )}

          <GenerationStepper generation={generation ?? (generating ? { status: 'queued', progress_step: null } : null)} />

          <div className="pt-1">
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={!resultUrl || downloading}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/25 active:scale-98 cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{done ? `Unduh Gambar HD${dimensionsLabel(done) ? ` (${dimensionsLabel(done)})` : ''}` : 'Unduh Gambar HD'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---- slot section ----------------------------------------------------------------------------------------

const SlotSection: React.FC<{
  title: string;
  note?: string;
  slots: ReturnType<typeof imageSlots>;
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}> = ({ title, note, slots, values, errors, onChange, disabled }) => {
  if (slots.length === 0) return null;
  return (
    <fieldset className="space-y-3.5 rounded-2xl border border-slate-100 p-4">
      <legend className="px-2 text-[11px] font-black uppercase tracking-wider text-[#2563EB]">{title}</legend>
      {note && <p className="text-[11px] text-slate-500 leading-relaxed -mt-1">{note}</p>}
      {slots.map((slot) => (
        <SlotField
          key={slot.key}
          slot={slot}
          value={values[slot.key] ?? ''}
          onChange={(v) => onChange(slot.key, v)}
          error={errors[slotFieldName(slot.key)]}
          disabled={disabled}
        />
      ))}
    </fieldset>
  );
};
