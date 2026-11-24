import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clapperboard, Clock3, Download, Film, Info, Loader2, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { createVideo, deleteVideoJob, getVideoJob, getVideoQuota, listGenerations, listVideoJobs, updateVideoJob } from '../../api/creator';
import { fileUrl } from '../../api/client';
import { ERROR_MESSAGES, getErrorMessage, isApiError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import type { Generation, MyGenerationsQuery, MyVideosQuery, VideoJob } from '../../api/types';
import { generationTitle, imageSrc, relativeTime, resultFileName } from './format';
import { ConfirmDialog } from './Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './StateViews';
import {
  DEFAULT_VIDEO_DURATION,
  MAX_VIDEO_DURATION,
  MIN_VIDEO_DURATION,
  clampVideoDuration,
  videoQuotaLeft,
} from './studioLogic';
import { ProgressBar, VIDEO_POLL_MS, VIDEO_STATUS_TEXT, canMakeVideo, downloadVideo } from './VideoPanel';

/** Recent finished posters offered as a source. The API filters on status; text + result are checked here. */
const POSTER_QUERY: MyGenerationsQuery = { status: 'done', limit: 12 };
const VIDEO_LIST_QUERY: MyVideosQuery = { limit: 6 };

const isRunning = (job: Pick<VideoJob, 'status'> | null | undefined) => job?.status === 'queued' || job?.status === 'rendering';

const failureText = (code: string | null) =>
  code ? (ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] ?? ERROR_MESSAGES.INTERNAL_ERROR) : ERROR_MESSAGES.INTERNAL_ERROR;

const videoFileName = (title: string) => resultFileName(title, 'video').replace(/\.png$/, '.mp4');

interface Notice {
  tone: 'ok' | 'error';
  text: string;
}

/**
 * The studio's "Video (Reel)" mode: pick one of the user's finished posters, choose a duration and render a 9:16
 * reel from it. It never calls `POST /generations`; every request goes through the `/videos` helpers.
 */
export const VideoStudioSection: React.FC<{
  /** A poster finished in this session; preselected when it can become a video. */
  preferredPosterId?: string | null;
}> = ({ preferredPosterId }) => {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [duration, setDuration] = useState(DEFAULT_VIDEO_DURATION);
  const [jobId, setJobId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<VideoJob | null>(null);
  const [editing, setEditing] = useState<VideoJob | null>(null);
  const [editDuration, setEditDuration] = useState(DEFAULT_VIDEO_DURATION);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // ---- data ------------------------------------------------------------------------------------------------
  const postersQuery = useQuery({
    queryKey: queryKeys.generations.list(POSTER_QUERY),
    queryFn: ({ signal }) => listGenerations(POSTER_QUERY, signal),
  });
  const posters = useMemo(() => (postersQuery.data?.items ?? []).filter(canMakeVideo), [postersQuery.data]);
  const posterById = useMemo(() => new Map(posters.map((p) => [p.id, p])), [posters]);

  const quotaQuery = useQuery({
    queryKey: queryKeys.videos.quota(),
    queryFn: ({ signal }) => getVideoQuota(signal),
    staleTime: 30_000,
  });
  const remaining = videoQuotaLeft(quotaQuery.data);
  const outOfQuota = remaining !== null && remaining <= 0;

  const videosQuery = useQuery({
    queryKey: queryKeys.videos.list(VIDEO_LIST_QUERY),
    queryFn: ({ signal }) => listVideoJobs(VIDEO_LIST_QUERY, signal),
    // Renders started elsewhere (another tab, the History page) keep the list moving too.
    refetchInterval: (q) => (q.state.data?.items.some(isRunning) ? VIDEO_POLL_MS : false),
  });
  const videos = videosQuery.data?.items ?? [];

  const jobQuery = useQuery({
    queryKey: queryKeys.videos.detail(jobId ?? 'none'),
    queryFn: ({ signal }) => getVideoJob(jobId as string, signal),
    enabled: !!jobId,
    refetchInterval: (q) => (isRunning(q.state.data) ? VIDEO_POLL_MS : false),
  });
  const job = jobId ? jobQuery.data : undefined;

  // Preselect: the poster made in this session, else the newest eligible one. A vanished choice is replaced.
  useEffect(() => {
    if (posters.length === 0) return;
    setSelectedId((current) => {
      if (current && posterById.has(current)) return current;
      if (preferredPosterId && posterById.has(preferredPosterId)) return preferredPosterId;
      return posters[0].id;
    });
  }, [posters, posterById, preferredPosterId]);

  // A settled render changes the quota and the list.
  const settledStatus = job && !isRunning(job) ? job.status : null;
  useEffect(() => {
    if (!settledStatus) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.videos.quota() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });
  }, [settledStatus, queryClient]);

  // ---- actions ---------------------------------------------------------------------------------------------
  const start = useMutation({
    mutationFn: (posterId: string) => createVideo(posterId, { duration_seconds: clampVideoDuration(duration) }),
    onSuccess: (res) => {
      setJobId(res.id);
      setNotice({ tone: 'ok', text: 'Video mulai dibuat. Proses ini memakan waktu sekitar satu menit.' });
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.quota() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });
    },
    onError: async (err, posterId) => {
      setNotice({ tone: 'error', text: getErrorMessage(err) });
      if (isApiError(err) && err.code === 'VIDEO_DAILY_LIMIT_REACHED') void queryClient.invalidateQueries({ queryKey: queryKeys.videos.quota() });
      // This poster is already rendering (another tab or an earlier click): follow that job instead.
      if (isApiError(err) && err.code === 'VIDEO_ALREADY_RUNNING') {
        try {
          const fresh = await queryClient.fetchQuery({
            queryKey: queryKeys.videos.list(VIDEO_LIST_QUERY),
            queryFn: ({ signal }) => listVideoJobs(VIDEO_LIST_QUERY, signal),
            staleTime: 0,
          });
          const running = fresh.items.find((v) => v.generation_id === posterId && isRunning(v));
          if (running) setJobId(running.id);
        } catch {
          // The notice above already explains the refusal; the list shows its own load error.
        }
      }
    },
  });

  // Editing a video = same job, new cut length. The backend re-queues it and frees the old file.
  const rerender = useMutation({
    mutationFn: ({ id, seconds }: { id: string; seconds: number }) =>
      updateVideoJob(id, { duration_seconds: clampVideoDuration(seconds) }),
    onSuccess: (res) => {
      setEditing(null);
      setJobId(res.id);
      setNotice({ tone: 'ok', text: 'Video sedang dibuat ulang dengan durasi baru.' });
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.detail(res.id) });
    },
    onError: (err) => setNotice({ tone: 'error', text: getErrorMessage(err) }),
  });

  const remove = useMutation({
    mutationFn: (video: VideoJob) => deleteVideoJob(video.id),
    onSuccess: (_res, video) => {
      if (video.id === jobId) setJobId(null);
      setDeleting(null);
      setNotice({ tone: 'ok', text: 'Video dihapus.' });
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });
      queryClient.removeQueries({ queryKey: queryKeys.videos.detail(video.id) });
    },
  });

  const download = async (video: VideoJob) => {
    if (!video.video_url) return;
    setDownloadingId(video.id);
    try {
      const poster = posterById.get(video.generation_id);
      const saved = await downloadVideo(video.video_url, videoFileName(poster ? generationTitle(poster) : 'video-reel'));
      if (!saved) setNotice({ tone: 'ok', text: 'Video dibuka di tab baru; simpan dari sana.' });
    } finally {
      setDownloadingId(null);
    }
  };

  const selected = selectedId ? posterById.get(selectedId) ?? null : null;
  const busy = start.isPending || isRunning(job);
  const canStart = !!selected && !busy && !outOfQuota;
  const selectedImage = selected ? imageSrc(selected.result_url ?? selected.thumbnail_url) : undefined;

  return (
    <section aria-labelledby="studio-video-title" className="space-y-6">
      {/* ── header ── */}
      <div className="rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] via-white to-violet-50/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between shadow-xs">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-[#1800ad] to-[#2563EB] text-white shadow-md shadow-blue-500/25">
            <Clapperboard className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <h3 id="studio-video-title" className="text-sm font-black text-[#0F172A]">
              Buat Video Reel 9:16
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
              Reel dirender dari poster yang sudah selesai dibuat dan sudah memiliki teks, jadi pilih salah satu poster Anda di bawah ini.
            </p>
          </div>
        </div>
        <span
          data-testid="video-quota"
          aria-live="polite"
          className={`self-start sm:self-auto px-3 py-1.5 rounded-full text-[11px] font-black border whitespace-nowrap ${
            outOfQuota ? 'bg-orange-50 text-[#EA580C] border-orange-200' : 'bg-white text-[#1D4ED8] border-[#BFDBFE]'
          }`}
        >
          {quotaQuery.data
            ? `Kuota video: ${remaining} / ${quotaQuery.data.limit} hari ini`
            : quotaQuery.isError
              ? 'Kuota video tidak dapat dimuat'
              : 'Memuat kuota video...'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── settings ── */}
        <div className="space-y-5">
          <fieldset className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <legend className="px-2 text-[11px] font-black uppercase tracking-wider text-[#2563EB]">1. Pilih Poster</legend>
            {postersQuery.isLoading ? (
              <LoadingBlock label="Memuat poster Anda..." className="py-6" />
            ) : postersQuery.isError ? (
              <ErrorBlock error={postersQuery.error} onRetry={() => void postersQuery.refetch()} title="Poster tidak dapat dimuat" />
            ) : posters.length === 0 ? (
              <EmptyBlock
                title="Belum ada poster yang bisa dijadikan video"
                hint="Buat poster dulu lewat Teks ke Gambar atau Foto ke Gambar. Poster yang selesai dan memiliki teks akan muncul di sini."
              />
            ) : (
              <div role="radiogroup" aria-label="Poster sumber video" className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {posters.map((p) => (
                  <PosterOption key={p.id} poster={p} checked={p.id === selectedId} disabled={busy} onSelect={() => setSelectedId(p.id)} />
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <legend className="px-2 text-[11px] font-black uppercase tracking-wider text-[#2563EB]">2. Durasi</legend>
            <div className="flex items-center justify-between">
              <label htmlFor="studio-video-duration" className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                <Clock3 className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />
                Durasi video
              </label>
              <span className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[11px] font-mono font-black text-[#1D4ED8]">{duration} detik</span>
            </div>
            <input
              id="studio-video-duration"
              type="range"
              min={MIN_VIDEO_DURATION}
              max={MAX_VIDEO_DURATION}
              step={1}
              value={duration}
              disabled={busy}
              aria-describedby="studio-video-duration-help"
              aria-valuetext={`${duration} detik`}
              onChange={(e) => setDuration(clampVideoDuration(e.target.value))}
              className="w-full accent-[#2563EB] cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            />
            <p id="studio-video-duration-help" className="text-[11px] text-slate-500">
              Antara {MIN_VIDEO_DURATION} dan {MAX_VIDEO_DURATION} detik. Video yang lebih pendek lebih cepat selesai.
            </p>
          </fieldset>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                if (selected) start.mutate(selected.id);
              }}
              disabled={!canStart}
              aria-disabled={!canStart}
              className="w-full py-4 rounded-full bg-gradient-to-r from-[#1800ad] to-[#2563EB] hover:brightness-110 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 disabled:opacity-60 disabled:pointer-events-none"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
              <span>{busy ? 'Video Sedang Dibuat...' : 'Buat Video Reel'}</span>
            </button>
            {outOfQuota && (
              <p role="status" className="text-[11px] text-center font-semibold text-[#EA580C]">
                Batas video harian sudah tercapai. Coba lagi besok.
              </p>
            )}
            {notice && (
              <p
                role={notice.tone === 'error' ? 'alert' : 'status'}
                className={`text-[11px] text-center font-semibold ${notice.tone === 'error' ? 'text-red-600' : 'text-emerald-700'}`}
              >
                {notice.text}
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-[#F8FAFC] border border-slate-200 p-3.5 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Teks pada reel mengikuti teks poster yang dipilih. Untuk mengubahnya, perbaiki posternya lalu buat video lagi. Durasi tiap video bisa
              diubah lewat tombol pensil pada daftar video di bawah; video dirender ulang dengan potongan baru.
            </p>
          </div>
        </div>

        {/* ── current render + recent videos ── */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] block">Pratinjau Reel</span>
            {job ? (
              <div className="space-y-2.5" data-testid="video-current-job">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className={job.status === 'failed' ? 'text-red-600' : job.status === 'done' ? 'text-emerald-600' : 'text-[#1D4ED8]'}>
                    {VIDEO_STATUS_TEXT[job.status]}
                    {job.status === 'rendering' ? ` · ${job.progress}%` : ''}
                  </span>
                  <span className="text-slate-500 font-mono">{job.duration_seconds} detik</span>
                </div>
                {isRunning(job) && <ProgressBar value={job.status === 'queued' ? 3 : job.progress} />}
                {job.status === 'failed' && (
                  <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{failureText(job.error_code)}</span>
                  </div>
                )}
                {job.status === 'done' && job.video_url && (
                  <video
                    src={fileUrl(job.video_url)}
                    poster={job.thumbnail_url ? fileUrl(job.thumbnail_url) : undefined}
                    controls
                    playsInline
                    className="w-full max-h-[52vh] rounded-2xl border border-slate-200 bg-slate-900"
                  />
                )}
              </div>
            ) : selected ? (
              <div
                className="relative mx-auto rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-md"
                style={{ aspectRatio: '9 / 16', width: 'min(100%, 220px)' }}
              >
                {selectedImage && <img src={selectedImage} alt={`Poster ${generationTitle(selected)}`} className="w-full h-full object-contain" draggable={false} />}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-black uppercase tracking-wider border border-white/20">
                  Poster sumber
                </span>
              </div>
            ) : (
              <div className="py-10 flex flex-col items-center gap-2 text-slate-400">
                <Film className="w-8 h-8" aria-hidden="true" />
                <span className="text-xs font-semibold">Pilih poster untuk melihat pratinjau</span>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
            <h4 className="text-xs font-black text-[#0F172A] flex items-center gap-1.5">
              <Film className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
              Video Terbaru Anda
            </h4>
            {videosQuery.isLoading ? (
              <LoadingBlock label="Memuat video..." className="py-4" />
            ) : videosQuery.isError ? (
              <ErrorBlock error={videosQuery.error} onRetry={() => void videosQuery.refetch()} title="Daftar video tidak dapat dimuat" />
            ) : videos.length === 0 ? (
              <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">Belum ada video. Video yang Anda buat akan muncul di sini.</p>
            ) : (
              <ul className="space-y-2" aria-label="Video terbaru">
                {videos.map((v) => {
                  const poster = posterById.get(v.generation_id);
                  const title = poster ? generationTitle(poster) : 'Video reel';
                  return (
                    <li key={v.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5 hover:border-[#BFDBFE] hover:bg-[#F8FAFC] transition-colors">
                      <span className="w-9 h-14 shrink-0 rounded-lg overflow-hidden bg-slate-900 grid place-items-center">
                        {v.thumbnail_url ? (
                          <img src={imageSrc(v.thumbnail_url)} alt="" className="w-full h-full object-cover" draggable={false} />
                        ) : (
                          <Film className="w-4 h-4 text-slate-500" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#0F172A] truncate">{title}</p>
                        <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          {v.status === 'done' && <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" />}
                          <span>
                            {VIDEO_STATUS_TEXT[v.status]}
                            {v.status === 'rendering' ? ` ${v.progress}%` : ''} · {v.duration_seconds} detik · {relativeTime(v.created_at)}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void download(v)}
                        disabled={v.status !== 'done' || !v.video_url || downloadingId === v.id}
                        aria-label={`Unduh video ${title}`}
                        className="p-2 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] hover:bg-[#DBEAFE] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {downloadingId === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Download className="w-3.5 h-3.5" aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          rerender.reset();
                          setEditDuration(clampVideoDuration(v.duration_seconds));
                          setEditing(v);
                        }}
                        disabled={isRunning(v)}
                        aria-label={`Ubah video ${title}`}
                        title={isRunning(v) ? 'Tunggu sampai video selesai dibuat sebelum mengubahnya.' : 'Ubah durasi video'}
                        className="p-2 rounded-lg bg-white text-[#1D4ED8] border border-[#BFDBFE] hover:bg-[#EFF6FF] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          remove.reset();
                          setDeleting(v);
                        }}
                        disabled={isRunning(v)}
                        aria-label={`Hapus video ${title}`}
                        title={isRunning(v) ? 'Tunggu sampai video selesai dibuat sebelum menghapusnya.' : undefined}
                        className="p-2 rounded-lg bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <ConfirmDialog
          title="Ubah Durasi Video"
          message={
            <div className="space-y-3">
              <p>
                Video akan dirender ulang dengan potongan baru. Teks dan poster tidak berubah, dan video ini tetap
                memakai satu jatah kuota hari ini.
              </p>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="studio-video-edit-duration" className="text-xs font-bold text-[#0F172A]">
                  Durasi
                </label>
                <span className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[11px] font-mono font-black text-[#1D4ED8]">
                  {editDuration} detik
                </span>
              </div>
              <input
                id="studio-video-edit-duration"
                type="range"
                min={MIN_VIDEO_DURATION}
                max={MAX_VIDEO_DURATION}
                step={1}
                value={editDuration}
                aria-valuetext={`${editDuration} detik`}
                onChange={(e) => setEditDuration(clampVideoDuration(e.target.value))}
                className="w-full accent-[#2563EB] cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
              />
              <p className="text-[11px] text-slate-500">
                Antara {MIN_VIDEO_DURATION} dan {MAX_VIDEO_DURATION} detik.
              </p>
            </div>
          }
          confirmLabel="Render Ulang"
          busy={rerender.isPending}
          error={rerender.isError ? getErrorMessage(rerender.error) : null}
          onConfirm={() => rerender.mutate({ id: editing.id, seconds: editDuration })}
          onCancel={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Hapus video ini?"
          message="File video akan dihapus permanen. Poster sumbernya tetap tersimpan dan bisa dijadikan video lagi."
          confirmLabel="Ya, Hapus"
          danger
          busy={remove.isPending}
          error={remove.isError ? getErrorMessage(remove.error) : null}
          onConfirm={() => remove.mutate(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
};

// ---- poster option ---------------------------------------------------------------------------------------

/** One poster as a native radio (arrow keys move between posters), styled as a thumbnail card. */
const PosterOption: React.FC<{ poster: Generation; checked: boolean; disabled: boolean; onSelect: () => void }> = ({ poster, checked, disabled, onSelect }) => {
  const title = generationTitle(poster);
  const thumb = imageSrc(poster.thumbnail_url ?? poster.result_url);
  return (
    <label className={`group relative block ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="radio"
        name="studio-video-poster"
        value={poster.id}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        aria-label={title}
        className="peer sr-only"
      />
      <span
        className={`block rounded-xl overflow-hidden border-2 bg-slate-100 aspect-[4/5] transition-all peer-focus-visible:ring-4 peer-focus-visible:ring-blue-200 ${
          checked ? 'border-[#2563EB] shadow-md shadow-blue-500/25' : 'border-transparent group-hover:border-[#BFDBFE]'
        }`}
      >
        {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" draggable={false} />}
      </span>
      {checked && <CheckCircle2 className="absolute top-1.5 right-1.5 w-5 h-5 text-white fill-[#2563EB] drop-shadow" aria-hidden="true" />}
      <span className="mt-1 block text-[10px] font-bold text-slate-600 truncate">{title}</span>
    </label>
  );
};

export default VideoStudioSection;
