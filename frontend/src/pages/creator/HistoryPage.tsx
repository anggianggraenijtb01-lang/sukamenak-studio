import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Archive, ChevronLeft, ChevronRight, Clock, Download, Eye, Loader2, Trash2, Zap } from 'lucide-react';
import { archiveGeneration, deleteGeneration, listGenerations } from '../../api/creator';
import { generationErrorMessage, getErrorMessage } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import type { Generation, GenerationStatus, MyGenerationsQuery } from '../../api/types';
import { downloadImage } from '../../components/creator/download';
import { dimensionsLabel, durationLabel, generationTitle, imageSrc, isStaleActive, relativeTime, resultFileName } from '../../components/creator/format';
import { DegradedNotice } from '../../components/creator/GenerationNotices';
import { STATUS_LABELS } from '../../components/creator/labels';
import { ConfirmDialog, Modal } from '../../components/creator/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/creator/StateViews';
import { referenceBadge } from '../../components/creator/studioLogic';
import { VideoPanel } from '../../components/creator/VideoPanel';

const PAGE_SIZE = 12;
const POLL_MS = 3000;

type StatusFilter = 'all' | GenerationStatus;
type ArchiveFilter = 'false' | 'true' | 'all';

const STATUS_FILTERS: Array<[StatusFilter, string]> = [
  ['all', 'Semua'],
  ['done', 'Selesai'],
  ['failed', 'Gagal'],
  ['running', 'Diproses'],
  ['queued', 'Antre'],
];

const ARCHIVE_FILTERS: Array<[ArchiveFilter, string]> = [
  ['false', 'Aktif'],
  ['true', 'Arsip'],
  ['all', 'Semua'],
];

export const HistoryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [archived, setArchived] = useState<ArchiveFilter>('false');
  const [viewing, setViewing] = useState<Generation | null>(null);
  const [deleting, setDeleting] = useState<Generation | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query: MyGenerationsQuery = {
    page,
    limit: PAGE_SIZE,
    ...(status !== 'all' ? { status } : {}),
    archived: archived === 'all' ? 'all' : archived === 'true',
  };

  const list = useQuery({
    queryKey: queryKeys.generations.list(query),
    queryFn: ({ signal }) => listGenerations(query, signal),
    placeholderData: keepPreviousData,
    // Only while something is still being made: poll the list so queued/running cards turn into results.
    refetchInterval: (q) =>
      q.state.data?.items.some((g) => (g.status === 'queued' || g.status === 'running') && !isStaleActive(g)) ? POLL_MS : false,
  });

  const items = list.data?.items ?? [];
  const meta = list.data?.meta;

  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.generations.all });

  const archive = useMutation({
    mutationFn: (g: Generation) => archiveGeneration(g.id),
    onMutate: (g) => setBusyId(g.id),
    onSuccess: () => {
      setNotice({ tone: 'ok', text: 'Desain dipindahkan ke arsip.' });
      refresh();
    },
    onError: (err) => setNotice({ tone: 'error', text: getErrorMessage(err) }),
    onSettled: () => setBusyId(null),
  });

  const remove = useMutation({
    mutationFn: (g: Generation) => deleteGeneration(g.id),
    onSuccess: (_d, g) => {
      setDeleting(null);
      setViewing((v) => (v?.id === g.id ? null : v));
      setNotice({ tone: 'ok', text: 'Desain dihapus.' });
      // The last card of a page is gone: step back so the user does not land on an empty page.
      if (items.length === 1 && page > 1) setPage(page - 1);
      refresh();
    },
  });

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const download = async (g: Generation) => {
    if (!g.result_url) return;
    setDownloadingId(g.id);
    try {
      await downloadImage(g.result_url, resultFileName(generationTitle(g)));
    } finally {
      setDownloadingId(null);
    }
  };

  const changeStatus = (s: StatusFilter) => {
    setStatus(s);
    setPage(1);
  };
  const changeArchived = (a: ArchiveFilter) => {
    setArchived(a);
    setPage(1);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">Riwayat &amp; Unduhan</h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-1 font-normal">
            Daftar seluruh materi promosi yang telah Anda buat dan siap diunduh kembali. Tautan gambar bersifat sementara; unduh hasil yang ingin disimpan.
          </p>
        </div>
        <div className="text-xs font-bold text-slate-500">
          Total tersimpan: <strong className="text-[#2563EB] font-black">{meta ? `${meta.total} Desain` : '-'}</strong>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter status">
          {STATUS_FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={status === id}
              onClick={() => changeStatus(id)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                status === id ? 'bg-[#2563EB] text-white border border-[#2563EB] shadow-md shadow-blue-500/25' : 'bg-white border border-[#CBD5E1] text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="inline-flex p-1 rounded-2xl bg-white border border-[#BFDBFE] self-start shadow-xs" role="group" aria-label="Filter arsip">
          {ARCHIVE_FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={archived === id}
              onClick={() => changeArchived(id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${archived === id ? 'bg-[#2563EB] text-white shadow-xs' : 'text-slate-600 hover:text-[#0F172A]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-xl text-xs font-semibold border ${notice.tone === 'error' ? 'bg-orange-50 border-orange-200 text-[#EA580C]' : 'bg-blue-50 border-blue-200 text-[#2563EB]'}`}
        >
          {notice.text}
        </div>
      )}

      {list.isLoading ? (
        <LoadingBlock label="Memuat riwayat..." />
      ) : list.isError && !list.data ? (
        <ErrorBlock error={list.error} onRetry={() => void list.refetch()} title="Riwayat tidak dapat dimuat" />
      ) : items.length === 0 ? (
        <EmptyBlock
          title={status !== 'all' || archived !== 'false' ? 'Tidak ada desain dengan filter ini' : 'Belum ada desain'}
          hint={status !== 'all' || archived !== 'false' ? 'Ubah filter untuk melihat desain lain.' : 'Desain yang Anda buat di Studio akan tersimpan di sini.'}
          action={
            status === 'all' && archived === 'false' ? (
              <Link to="/creator/studio" className="inline-flex px-5 py-2 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-black transition-colors">
                Buat Desain Pertama
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
          {items.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              busy={busyId === item.id}
              downloading={downloadingId === item.id}
              onView={() => setViewing(item)}
              onDownload={() => void download(item)}
              onArchive={() => archive.mutate(item)}
              onDelete={() => {
                remove.reset();
                setDeleting(item);
              }}
            />
          ))}
        </div>
      )}

      {meta && meta.total_pages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Halaman riwayat">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Sebelumnya</span>
          </button>
          <span className="text-xs font-bold text-slate-500">
            Halaman {meta.page} dari {meta.total_pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
            disabled={page >= meta.total_pages}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <span>Berikutnya</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </nav>
      )}

      {viewing && <ViewModal item={viewing} onClose={() => setViewing(null)} onDownload={() => void download(viewing)} downloading={downloadingId === viewing.id} />}

      {deleting && (
        <ConfirmDialog
          title="Hapus desain ini?"
          message={
            <>
              Desain <strong>{generationTitle(deleting)}</strong> akan dihapus beserta file gambarnya, dan entri galeri yang dibuat darinya ikut disembunyikan. Tindakan ini tidak bisa dibatalkan.
            </>
          }
          confirmLabel="Ya, Hapus"
          danger
          busy={remove.isPending}
          error={remove.isError ? getErrorMessage(remove.error) : null}
          onConfirm={() => remove.mutate(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
};

// ---- card ------------------------------------------------------------------------------------------------

const HistoryCard: React.FC<{
  item: Generation;
  busy: boolean;
  downloading: boolean;
  onView: () => void;
  onDownload: () => void;
  onArchive: () => void;
  onDelete: () => void;
}> = ({ item, busy, downloading, onView, onDownload, onArchive, onDelete }) => {
  const title = generationTitle(item);
  const done = item.status === 'done' && !!item.result_url;
  const stale = isStaleActive(item);
  const active = (item.status === 'queued' || item.status === 'running') && !stale;
  const duration = durationLabel(item.duration_ms);
  return (
    <div
      data-testid="history-card"
      data-status={item.status}
      className="bg-white rounded-3xl border border-[#CBD5E1] p-4 space-y-3.5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
    >
      <div>
        <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 border border-slate-100">
          {done ? (
            <img
              src={imageSrc(item.thumbnail_url ?? item.result_url)}
              alt={title}
              loading="lazy"
              draggable={false}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : item.status === 'failed' ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center text-red-200 bg-red-950/60">
              <AlertTriangle className="w-8 h-8" aria-hidden="true" />
              <span className="text-[11px] font-bold leading-snug">{generationErrorMessage(item.error_code)}</span>
            </div>
          ) : (
            <div role="status" className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300">
              <Loader2 className="w-7 h-7 animate-spin" aria-hidden="true" />
              <span className="text-xs font-bold px-3 text-center">{stale ? 'Proses tampak macet. Anda dapat menghapusnya.' : `${STATUS_LABELS[item.status]}...`}</span>
            </div>
          )}

          <div className="absolute top-2.5 left-2.5">
            <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono text-white border border-white/20 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-300" />
              <span>{relativeTime(item.created_at)}</span>
            </span>
          </div>
          <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1">
            <span
              className={`px-2.5 py-1 rounded-full backdrop-blur-md text-[10px] font-mono font-bold text-white border border-white/20 ${
                item.status === 'failed' ? 'bg-red-600/90' : 'bg-[#2563EB]/90'
              }`}
            >
              {done ? (dimensionsLabel(item) ?? 'HD') : STATUS_LABELS[item.status]}
            </span>
            {item.archived && <span className="px-2 py-0.5 rounded-full bg-slate-700/90 text-[10px] font-bold text-white">Arsip</span>}
          </div>
          {done && duration && (
            <div className="absolute bottom-2.5 left-2.5 right-2.5">
              <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-[10px] font-mono text-slate-200 border border-white/10 flex items-center justify-between">
                <span className="flex items-center gap-1 text-sky-400">
                  <Zap className="w-3 h-3" />
                  <span>Pipeline</span>
                </span>
                <span>{duration}</span>
              </span>
            </div>
          )}
        </div>

        <div className="pt-3 space-y-1">
          <h3 className="text-sm font-bold text-[#0F172A] line-clamp-1 leading-snug" title={title}>
            {title}
          </h3>
          <div className="text-[11px] text-slate-500 font-medium line-clamp-1">
            {item.template?.name ?? 'Template tidak tersedia'}
            {done ? ` • ${referenceBadge(item)}` : ''}
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDownload}
          disabled={!done || downloading}
          className="flex-1 py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0F172A] text-xs font-bold whitespace-nowrap flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        >
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          <span>Unduh HD</span>
        </button>
        <button
          type="button"
          onClick={onView}
          disabled={item.status !== 'failed' && !done}
          aria-label={`Lihat ${title}`}
          title="Lihat hasil"
          className="py-2 px-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:pointer-events-none"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        {done && !item.archived && (
          <button
            type="button"
            onClick={onArchive}
            disabled={busy}
            aria-label={`Arsipkan ${title}`}
            title="Arsipkan"
            className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={active}
          aria-label={`Hapus ${title}`}
          title="Hapus"
          className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ---- reopen a result -------------------------------------------------------------------------------------

const ViewModal: React.FC<{ item: Generation; onClose: () => void; onDownload: () => void; downloading: boolean }> = ({ item, onClose, onDownload, downloading }) => {
  const done = item.status === 'done' && !!item.result_url;
  return (
    <Modal title={generationTitle(item)} eyebrow={item.template?.name ?? 'Hasil Desain'} onClose={onClose} widthClass="max-w-xl">
      {done ? (
        <img src={imageSrc(item.result_url)} alt={`Hasil desain ${generationTitle(item)}`} className="w-full max-h-[60vh] object-contain rounded-2xl border border-slate-200 bg-slate-900" draggable={false} />
      ) : (
        <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700 font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{generationErrorMessage(item.error_code)}</span>
        </div>
      )}
      {done && (
        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black border bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]">{referenceBadge(item)}</span>
          {item.degraded && <DegradedNotice />}
        </div>
      )}
      <div className="flex items-center justify-end gap-3 pt-1">
        {done && (
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-60"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Unduh Gambar HD</span>
          </button>
        )}
      </div>
      {done && <VideoPanel generation={item} />}
    </Modal>
  );
};

export default HistoryPage;
