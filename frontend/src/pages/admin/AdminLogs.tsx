import React, { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, Eye, Flag, Terminal, XCircle } from 'lucide-react';
import {
  adminDownloadGenerationsCsv,
  adminFlagGeneration,
  adminGetGeneration,
  adminListGenerations,
  adminListModels,
  adminListTemplates,
  adminListUsers,
} from '../../api/admin';
import { fileUrl } from '../../api/client';
import { getErrorMessage } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import type {
  AdminGeneration,
  AdminGenerationFilters,
  AdminGenerationsQuery,
  GenerationMode,
  GenerationStatus,
} from '../../api/types';
import {
  GENERATION_STATUS_LABELS,
  STAGE_LABELS,
  failureLabel,
  formatDateTime,
  formatDuration,
  formatUsd,
  shortId,
} from '../../components/admin/format';
import { triState } from '../../components/admin/hooks';
import {
  Badge,
  Banner,
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
  textareaCls,
  useNotice,
} from '../../components/admin/ui';

const PAGE_SIZE = 20;

const StatusBadge: React.FC<{ status: GenerationStatus }> = ({ status }) => {
  const tone = status === 'done' ? 'blue' : status === 'failed' ? 'red' : 'slate';
  return (
    <Badge tone={tone}>
      {status === 'done' && <CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
      {status === 'failed' && <XCircle className="w-3 h-3" aria-hidden="true" />}
      {GENERATION_STATUS_LABELS[status]}
    </Badge>
  );
};

const TIMELINE_TONE = { ok: 'green', degraded: 'amber', failed: 'red', started: 'slate' } as const;
const TIMELINE_LABEL = { ok: 'OK', degraded: 'Terdegradasi', failed: 'Gagal', started: 'Dimulai' } as const;

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between gap-4 py-1.5 border-b border-slate-50 text-xs">
    <span className="text-slate-400 shrink-0">{label}</span>
    <span className="font-bold text-[#0F172A] text-right break-words min-w-0">{children}</span>
  </div>
);

// ---------------------------------------------------------------------------------------------------
// Detail dialog
// ---------------------------------------------------------------------------------------------------

const TraceModal: React.FC<{ id: string; onClose: () => void; onChanged: (message: string) => void }> = ({ id, onClose, onChanged }) => {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: queryKeys.admin.generations.detail(id),
    queryFn: ({ signal }) => adminGetGeneration(id, signal),
    staleTime: 10_000,
  });
  const [note, setNote] = useState('');
  const [noteLoadedFor, setNoteLoadedFor] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const g = detail.data;
  if (g && noteLoadedFor !== g.id) {
    setNoteLoadedFor(g.id);
    setNote(g.flag_note ?? '');
  }

  const toggleFlag = async () => {
    if (!g) return;
    setPending(true);
    setError(null);
    try {
      const flagged = !g.flagged;
      const next = await adminFlagGeneration(g.id, flagged ? { flagged: true, ...(note.trim() ? { note: note.trim() } : {}) } : { flagged: false });
      queryClient.setQueryData(queryKeys.admin.generations.detail(g.id), next);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.generations.lists() });
      if (!flagged) setNote('');
      onChanged(flagged ? 'Generasi ditandai untuk ditinjau.' : 'Tanda dilepas.');
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal title={`Detail Jejak Pipeline #${shortId(id)}`} size="xl" onClose={onClose} footer={<button type="button" onClick={onClose} className={btnPrimary}>Tutup Detail Trace</button>}>
      {detail.isPending && <LoadingBlock label="Memuat jejak pipeline..." />}
      {detail.isError && <ErrorState error={detail.error} onRetry={() => void detail.refetch()} title="Detail tidak dapat dimuat" />}
      {g && (
        <div className="space-y-5">
          <Banner kind="info">Jejak ini tidak memuat prompt, isian slot, atau catatan pengguna: hanya tahap, status, durasi, biaya, model, dan galat yang sudah disaring.</Banner>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 space-y-0.5">
              <Row label="Status">
                <StatusBadge status={g.status} />
              </Row>
              <Row label="Pengguna">{g.user ? `${g.user.name} (${g.user.email})` : 'Akun dihapus'}</Row>
              <Row label="Template">{g.template?.name ?? '-'}</Row>
              <Row label="Mode / subjek / publikasi">
                {g.mode} / {g.subject} / {g.publication}
              </Row>
              <Row label="Waktu mulai">{formatDateTime(g.created_at)}</Row>
              <Row label="Total durasi">{formatDuration(g.duration_ms)}</Row>
              <Row label="Total biaya">{formatUsd(g.total_cost_usd)}</Row>
              <Row label="Model vision">{g.models.vision?.name ?? '-'}</Row>
              <Row label="Model gambar">{g.models.image?.name ?? '-'}</Row>
              <Row label="Foto referensi dipakai">
                {g.used_reference_image ? `Ya (${g.reference_count_used})` : 'Tidak'}
                {g.reference_roles.length > 0 && <span className="font-mono font-normal text-slate-500"> [{g.reference_roles.join(', ')}]</span>}
              </Row>
              <Row label="Teks komposit / terdegradasi / persetujuan">
                {g.composited_text ? 'Ya' : 'Tidak'} / {g.degraded ? 'Ya' : 'Tidak'} / {g.consent_confirmed ? 'Ya' : 'Tidak'}
              </Row>
              {g.error_code && <Row label="Kode galat">{g.error_code} &mdash; {failureLabel(g.error_code)}</Row>}
              <Row label="Arsip / dibersihkan / dihapus pengguna">
                {g.archived ? 'Ya' : 'Tidak'} / {g.purged ? 'Ya' : 'Tidak'} / {g.deleted_by_user ? 'Ya' : 'Tidak'}
              </Row>
            </div>
            <div>
              {g.thumbnail_url || g.result_url ? (
                <img src={fileUrl(g.thumbnail_url ?? g.result_url)!} alt="Hasil generasi" className="w-full rounded-2xl border border-slate-200 object-cover" />
              ) : (
                <div className="aspect-[4/5] rounded-2xl border border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400 text-center p-4">Tidak ada gambar hasil</div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-[#0F172A] mb-2">Timeline Tahap</h3>
            {g.timeline.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada tahap tercatat.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-bold">
                      <th className="py-2 px-3">Tahap</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Durasi</th>
                      <th className="py-2 px-3">Biaya</th>
                      <th className="py-2 px-3">Model</th>
                      <th className="py-2 px-3">Galat (disaring)</th>
                      <th className="py-2 px-3">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {g.timeline.map((s, i) => (
                      <tr key={`${s.stage}-${s.at}-${i}`}>
                        <td className="py-2 px-3 font-bold">{STAGE_LABELS[s.stage]}</td>
                        <td className="py-2 px-3">
                          <Badge tone={TIMELINE_TONE[s.status]}>{TIMELINE_LABEL[s.status]}</Badge>
                        </td>
                        <td className="py-2 px-3 font-mono">{formatDuration(s.duration_ms)}</td>
                        <td className="py-2 px-3 font-mono">{s.cost_usd != null ? formatUsd(s.cost_usd) : '-'}</td>
                        <td className="py-2 px-3">{s.model?.name ?? '-'}</td>
                        <td className="py-2 px-3">
                          {s.error_code ? (
                            <>
                              <span className="font-mono text-red-600">{s.error_code}</span>
                              {s.error_message && <span className="block text-slate-500">{s.error_message}</span>}
                            </>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{formatDateTime(s.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 bg-[#F8FAFC] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-1.5">
                <Flag className="w-4 h-4 text-amber-600" aria-hidden="true" />
                Tanda Tinjauan
              </h3>
              {g.flagged ? <Badge tone="amber">Ditandai {g.flagged_at ? formatDateTime(g.flagged_at) : ''}</Badge> : <Badge tone="slate">Tidak ditandai</Badge>}
            </div>
            <Field label="Catatan (maks. 500 karakter)" htmlFor="flag-note">
              <textarea id="flag-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending || g.flagged} maxLength={500} className={textareaCls} placeholder="Alasan ditandai, mis. perlu ditinjau konten fotonya" />
            </Field>
            {g.flagged && <p className="text-[11px] text-slate-500">Melepas tanda juga menghapus catatan.</p>}
            {error != null && <Banner kind="error">{getErrorMessage(error)}</Banner>}
            <button type="button" onClick={() => void toggleFlag()} disabled={pending} className={g.flagged ? btnSecondary : btnPrimary}>
              {pending && <Spinner />}
              {g.flagged ? 'Lepas Tanda' : 'Tandai Generasi'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ---------------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------------

export const AdminLogs: React.FC = () => {
  const { notice, show, showError, clear } = useNotice();
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const [userId, setUserId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [modelId, setModelId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [degraded, setDegraded] = useState('');
  const [flagged, setFlagged] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const rangeInvalid = !!from && !!to && from > to;
  const filters: AdminGenerationFilters = {
    status: (status || undefined) as GenerationStatus | undefined,
    mode: (mode || undefined) as GenerationMode | undefined,
    user: userId || undefined,
    template: templateId || undefined,
    model: modelId || undefined,
    from: from || undefined,
    to: to || undefined,
    degraded: triState(degraded),
    flagged: triState(flagged),
  };
  const query: AdminGenerationsQuery = { ...filters, page, limit: PAGE_SIZE };

  const logs = useQuery({
    queryKey: queryKeys.admin.generations.list(query),
    queryFn: ({ signal }) => adminListGenerations(query, signal),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    enabled: !rangeInvalid,
  });

  // Pickers for the id based filters (small installation: the first 100 entries are enough).
  const users = useQuery({ queryKey: queryKeys.admin.users.list({ limit: 100 }), queryFn: ({ signal }) => adminListUsers({ limit: 100 }, signal), staleTime: 60_000 });
  const templates = useQuery({ queryKey: queryKeys.admin.templates.list({ limit: 100 }), queryFn: ({ signal }) => adminListTemplates({ limit: 100 }, signal), staleTime: 60_000 });
  const models = useQuery({ queryKey: queryKeys.admin.models.list({ limit: 100 }), queryFn: ({ signal }) => adminListModels({ limit: 100 }, signal), staleTime: 60_000 });

  const setFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };
  const resetFilters = () => {
    setStatus('');
    setMode('');
    setUserId('');
    setTemplateId('');
    setModelId('');
    setFrom('');
    setTo('');
    setDegraded('');
    setFlagged('');
    setPage(1);
  };
  const anyFilter = Object.values(filters).some((v) => v !== undefined);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await adminDownloadGenerationsCsv(filters);
      show('success', 'Ekspor CSV selesai diunduh (maksimal 100.000 baris; persempit filter untuk ekspor lebih spesifik).');
    } catch (err) {
      showError(err);
    } finally {
      setExporting(false);
    }
  };

  const items: AdminGeneration[] = logs.data?.items ?? [];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={<Terminal className="w-6 h-6" />}
        title={
          <>
            Log &amp; Trace <span className="text-[#2563EB]">Generasi AI</span>
          </>
        }
        description="Audit jejak pipeline komputasi AI per tahap secara aman dan transparan. Prompt dan catatan pengguna tidak pernah ditampilkan."
        actions={
          <button type="button" onClick={() => void handleExportCsv()} disabled={exporting || rangeInvalid} className={btnPrimary}>
            {exporting ? <Spinner /> : <Download className="w-4 h-4" aria-hidden="true" />}
            <span>Ekspor CSV Audit</span>
          </button>
        }
      />

      <NoticeBanner notice={notice} onDismiss={clear} />

      {/* Filters */}
      <section aria-label="Filter log" className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Field label="Status" htmlFor="f-status">
            <select id="f-status" value={status} onChange={(e) => setFilter(() => setStatus(e.target.value))} className={selectCls}>
              <option value="">Semua</option>
              <option value="queued">Antre</option>
              <option value="running">Berjalan</option>
              <option value="done">Selesai</option>
              <option value="failed">Gagal</option>
            </select>
          </Field>
          <Field label="Mode" htmlFor="f-mode">
            <select id="f-mode" value={mode} onChange={(e) => setFilter(() => setMode(e.target.value))} className={selectCls}>
              <option value="">Semua</option>
              <option value="i2i">Foto ke Gambar (I2I)</option>
              <option value="t2i">Teks ke Gambar (T2I)</option>
            </select>
          </Field>
          <Field label="Pengguna" htmlFor="f-user">
            <select id="f-user" value={userId} onChange={(e) => setFilter(() => setUserId(e.target.value))} className={selectCls}>
              <option value="">Semua pengguna</option>
              {users.data?.items.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Template" htmlFor="f-template">
            <select id="f-template" value={templateId} onChange={(e) => setFilter(() => setTemplateId(e.target.value))} className={selectCls}>
              <option value="">Semua template</option>
              {templates.data?.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Model (vision atau gambar)" htmlFor="f-model">
            <select id="f-model" value={modelId} onChange={(e) => setFilter(() => setModelId(e.target.value))} className={selectCls}>
              <option value="">Semua model</option>
              {models.data?.items.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.capability})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dari tanggal" htmlFor="f-from" error={rangeInvalid ? 'Tanggal awal harus sebelum tanggal akhir.' : null}>
            <input id="f-from" type="date" value={from} onChange={(e) => setFilter(() => setFrom(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Sampai tanggal" htmlFor="f-to">
            <input id="f-to" type="date" value={to} onChange={(e) => setFilter(() => setTo(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Terdegradasi" htmlFor="f-degraded">
            <select id="f-degraded" value={degraded} onChange={(e) => setFilter(() => setDegraded(e.target.value))} className={selectCls}>
              <option value="">Semua</option>
              <option value="true">Ya</option>
              <option value="false">Tidak</option>
            </select>
          </Field>
          <Field label="Ditandai" htmlFor="f-flagged">
            <select id="f-flagged" value={flagged} onChange={(e) => setFilter(() => setFlagged(e.target.value))} className={selectCls}>
              <option value="">Semua</option>
              <option value="true">Ditandai</option>
              <option value="false">Tidak ditandai</option>
            </select>
          </Field>
          <div className="flex items-end">
            <button type="button" onClick={resetFilters} disabled={!anyFilter} className={btnSecondary}>
              Atur ulang filter
            </button>
          </div>
        </div>
      </section>

      {/* Table */}
      <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {logs.isPending && !rangeInvalid && <LoadingBlock label="Memuat log..." />}
        {logs.isError && !logs.data && <ErrorState error={logs.error} onRetry={() => void logs.refetch()} title="Log tidak dapat dimuat" />}
        {logs.data && items.length === 0 && <EmptyState icon={<Terminal className="w-6 h-6" />} title="Tidak ada generasi yang cocok" hint="Ubah atau atur ulang filter." />}
        {items.length > 0 && (
          <div className={`overflow-x-auto ${logs.isFetching ? 'opacity-70' : ''}`}>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3.5 px-5">Waktu Eksekusi</th>
                  <th className="py-3.5 px-5">Pengguna / Template</th>
                  <th className="py-3.5 px-5">Mode</th>
                  <th className="py-3.5 px-5">Durasi</th>
                  <th className="py-3.5 px-5">Biaya</th>
                  <th className="py-3.5 px-5">Status Engine</th>
                  <th className="py-3.5 px-5 text-right">Detail Trace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((log) => (
                  <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-[11px] text-slate-500">
                      {formatDateTime(log.created_at)}
                      <span className="block text-slate-400">#{shortId(log.id)}</span>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-extrabold text-[#0F172A]">{log.user?.name ?? 'Akun dihapus'}</div>
                      <div className="text-[11px] text-[#2563EB] font-bold">{log.template?.name ?? '-'}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#2563EB] text-[11px] font-bold uppercase">{log.mode}</span>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] font-bold text-slate-700">{formatDuration(log.duration_ms)}</td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-slate-700">{formatUsd(log.total_cost_usd)}</td>
                    <td className="py-3.5 px-5">
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge status={log.status} />
                        {log.degraded && (
                          <Badge tone="amber">
                            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                            Degradasi
                          </Badge>
                        )}
                        {log.flagged && (
                          <Badge tone="red">
                            <Flag className="w-3 h-3" aria-hidden="true" />
                            Ditandai
                          </Badge>
                        )}
                      </div>
                      {log.error_code && <div className="text-[10px] font-mono text-red-600 mt-0.5">{log.error_code}</div>}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button type="button" onClick={() => setSelected(log.id)} className={btnOutline} aria-label={`Lihat trace generasi ${shortId(log.id)}`}>
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Lihat Trace</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination meta={logs.data?.meta} onPage={setPage} busy={logs.isFetching} noun="generasi" />

      {selected && <TraceModal id={selected} onClose={() => setSelected(null)} onChanged={(msg) => show('success', msg)} />}
    </div>
  );
};
export default AdminLogs;
