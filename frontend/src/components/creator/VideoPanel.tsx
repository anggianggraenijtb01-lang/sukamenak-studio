import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clapperboard, Download, Loader2, Sparkles } from 'lucide-react';
import { createVideo, getVideoJob, getVideoQuota } from '../../api/creator';
import { ERROR_MESSAGES, getErrorMessage } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import type { Generation, VideoJob } from '../../api/types';
import { fileUrl, saveBlob } from '../../api/client';
import { generationTitle, resultFileName } from './format';

const POLL_MS = 2000;

const STATUS_TEXT: Record<VideoJob['status'], string> = {
  queued: 'Menunggu antrean',
  rendering: 'Sedang dirender',
  done: 'Selesai',
  failed: 'Gagal',
};

/** The stored poster already carries its text, so only a finished, text-bearing poster can be animated. */
export const canMakeVideo = (g: Generation): boolean => g.status === 'done' && g.composited_text && !!g.result_url;

async function downloadVideo(url: string, filename: string): Promise<boolean> {
  const href = fileUrl(url);
  try {
    const res = await fetch(href, { credentials: 'omit' });
    if (!res.ok) throw new Error(String(res.status));
    saveBlob(await res.blob(), filename);
    return true;
  } catch {
    window.open(href, '_blank', 'noopener,noreferrer');
    return false;
  }
}

const ProgressBar: React.FC<{ value: number }> = ({ value }) => (
  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <div
      className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#7C3AED] transition-[width] duration-500"
      style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
    />
  </div>
);

/**
 * "Buat video" panel for one finished poster: start a 9:16 render, watch its progress and play the result.
 * Rendering happens in the backend's video worker (~40-60 s), so the panel polls until the job settles.
 */
export const VideoPanel: React.FC<{ generation: Generation; onNotice?: (notice: { tone: 'ok' | 'error'; text: string }) => void }> = ({
  generation,
  onNotice,
}) => {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [duration, setDuration] = useState<8 | 15>(15);
  const [downloading, setDownloading] = useState(false);
  const startedRef = useRef(false);

  const quota = useQuery({
    queryKey: queryKeys.videos.quota(),
    queryFn: ({ signal }) => getVideoQuota(signal),
    staleTime: 30_000,
  });

  const job = useQuery({
    queryKey: queryKeys.videos.detail(jobId ?? 'none'),
    queryFn: ({ signal }) => getVideoJob(jobId as string, signal),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === 'queued' || status === 'rendering' ? POLL_MS : false;
    },
  });

  const start = useMutation({
    mutationFn: () => createVideo(generation.id, { duration_seconds: duration }),
    onSuccess: (res) => {
      setJobId(res.id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.quota() });
      onNotice?.({ tone: 'ok', text: 'Video mulai dibuat. Proses ini memakan waktu sekitar satu menit.' });
    },
    onError: (err) => {
      onNotice?.({ tone: 'error', text: getErrorMessage(err) });
      // Someone else's tab (or an earlier attempt) may already be rendering this poster: adopt that job.
      if ((err as { code?: string }).code === 'VIDEO_ALREADY_RUNNING') startedRef.current = false;
    },
  });

  useEffect(() => {
    if (job.data?.status === 'done' || job.data?.status === 'failed') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.quota() });
    }
  }, [job.data?.status, queryClient]);

  const data = job.data;
  const running = data ? data.status === 'queued' || data.status === 'rendering' : start.isPending;
  const remaining = quota.data ? Math.max(0, quota.data.limit - quota.data.used) : null;
  const outOfQuota = remaining !== null && remaining <= 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-8 h-8 rounded-xl bg-gradient-to-br from-[#1800ad] to-[#2563EB] text-white shadow-md shadow-blue-500/25">
            <Clapperboard className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-black text-[#0F172A] leading-tight">Jadikan video 9:16</h3>
            <p className="text-[11px] text-slate-500 font-medium">Siap untuk Status WhatsApp, Reels, dan TikTok.</p>
          </div>
        </div>
        {remaining !== null && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
            Sisa {remaining} video hari ini
          </span>
        )}
      </header>

      {!canMakeVideo(generation) ? (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium">
          Video hanya bisa dibuat dari desain yang sudah selesai dan memiliki teks.
        </p>
      ) : (
        <>
          {!data && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500">Durasi</span>
              {([8, 15] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                    duration === d ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {d} detik
                </button>
              ))}
              <button
                type="button"
                onClick={() => start.mutate()}
                disabled={running || outOfQuota}
                className="ml-auto px-4 py-2 rounded-xl bg-gradient-to-r from-[#1800ad] to-[#2563EB] hover:brightness-110 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {start.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Buat video</span>
              </button>
            </div>
          )}

          {outOfQuota && !data && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 font-semibold">
              Batas video harian sudah tercapai. Coba lagi besok.
            </p>
          )}

          {data && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className={data.status === 'failed' ? 'text-red-600' : data.status === 'done' ? 'text-emerald-600' : 'text-[#1D4ED8]'}>
                  {STATUS_TEXT[data.status]}
                  {data.status === 'rendering' ? ` · ${data.progress}%` : ''}
                </span>
                {data.status === 'done' && data.bytes && (
                  <span className="text-slate-500 font-mono">{(data.bytes / 1_048_576).toFixed(1)} MB</span>
                )}
              </div>

              {running && <ProgressBar value={data.status === 'queued' ? 3 : data.progress} />}

              {data.status === 'failed' && (
                <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{data.error_code ? (ERROR_MESSAGES[data.error_code as keyof typeof ERROR_MESSAGES] ?? ERROR_MESSAGES.INTERNAL_ERROR) : ERROR_MESSAGES.INTERNAL_ERROR}</span>
                </div>
              )}

              {data.status === 'done' && data.video_url && (
                <>
                  <video
                    src={fileUrl(data.video_url)}
                    poster={data.thumbnail_url ? fileUrl(data.thumbnail_url) : undefined}
                    controls
                    playsInline
                    className="w-full max-h-[52vh] rounded-2xl border border-slate-200 bg-slate-900"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setDownloading(true);
                        const ok = await downloadVideo(data.video_url as string, resultFileName(generationTitle(generation), 'video').replace(/\.png$/, '.mp4'));
                        setDownloading(false);
                        if (!ok) onNotice?.({ tone: 'ok', text: 'Video dibuka di tab baru; simpan dari sana.' });
                      }}
                      disabled={downloading}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/25 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>Unduh video</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setJobId(null);
                        start.reset();
                      }}
                      className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Buat lagi
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {start.isError && !data && (
            <p role="alert" className="text-[11px] text-red-600 font-semibold">{getErrorMessage(start.error)}</p>
          )}
        </>
      )}
    </section>
  );
};

export default VideoPanel;
