import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Camera, PenTool, Download, ArrowRight, Clock, Loader2, Eye } from 'lucide-react';
import { useAuth, useMe } from '../../auth/AuthProvider';
import { listGenerations } from '../../api/creator';
import { queryKeys } from '../../api/queryKeys';
import type { Generation, MyGenerationsQuery } from '../../api/types';
import { downloadImage } from '../../components/creator/download';
import { dimensionsLabel, generationTitle, imageSrc, relativeTime, resultFileName } from '../../components/creator/format';
import { categoryLabel } from '../../components/creator/labels';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/creator/StateViews';

const RECENT_QUERY: MyGenerationsQuery = { status: 'done', limit: 4, page: 1 };

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const me = useMe();
  const recent = useQuery({
    queryKey: queryKeys.generations.list(RECENT_QUERY),
    queryFn: ({ signal }) => listGenerations(RECENT_QUERY, signal),
  });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const usage = me.data?.usage;
  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] ?? '';
  const total = recent.data?.meta.total;
  const posters = (recent.data?.items ?? []).filter((g) => g.result_url);

  const download = async (g: Generation) => {
    if (!g.result_url) return;
    setDownloadingId(g.id);
    try {
      await downloadImage(g.result_url, resultFileName(generationTitle(g)));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* 1. HERO BANNER */}
      <div className="bg-gradient-to-r from-[#2563EB] via-[#1D4ED8] to-[#3B82F6] rounded-3xl p-6 sm:p-8 text-white border border-blue-400/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute -bottom-20 left-1/3 w-80 h-80 bg-[#60A5FA]/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-white/5 rounded-3xl rotate-12 backdrop-blur-md pointer-events-none border border-white/20" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Halo{firstName ? `, ${firstName}` : ''}</span>
              <span className="text-3xl animate-bounce" aria-hidden="true">
                👋
              </span>
            </h1>
            <p className="text-sm sm:text-base text-blue-100 font-normal leading-relaxed">Siap membuat materi promosi produk usaha hari ini?</p>
          </div>

          <div className="flex-shrink-0 self-start sm:self-center flex flex-col gap-2 items-start sm:items-end">
            <div className="px-5 py-2.5 rounded-full bg-white/15 border border-white/30 backdrop-blur-md shadow-lg flex items-center gap-2.5" aria-live="polite">
              <span className={`w-2 h-2 rounded-full bg-white ${usage && usage.remaining_today > 0 ? 'animate-ping' : ''}`} aria-hidden="true" />
              <span className="text-xs sm:text-sm font-black text-white tracking-wide" data-testid="quota-pill">
                {me.isLoading ? 'Memuat kuota...' : usage ? `Sisa kuota hari ini: ${usage.remaining_today} / ${usage.daily_limit}` : 'Kuota tidak tersedia'}
              </span>
            </div>
            {typeof total === 'number' && (
              <span className="text-xs font-semibold text-blue-100">{total} Poster Telah Dibuat</span>
            )}
          </div>
        </div>
      </div>

      {usage && usage.remaining_today <= 0 && (
        <div role="status" className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-xs font-semibold text-[#EA580C]">
          Batas harian tercapai. Jatah Anda terisi kembali besok, atau hubungi admin bila perlu tambahan.
        </div>
      )}

      {/* 2. QUICK ACTIONS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-[#0F172A] tracking-tight">
            Akses Cepat <span className="text-[#2563EB]">Buat Desain</span>
          </h2>
          <span className="text-xs font-semibold text-[#64748B]">Pilih metode yang paling nyaman untuk Anda</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Link
            to="/creator/studio?mode=i2i"
            className="group p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-[#CBD5E1] hover:border-[#2563EB] shadow-xs hover:shadow-xl transition-all duration-300 flex items-start gap-5 hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <Camera className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="text-base sm:text-lg font-black text-[#1E40AF] group-hover:text-[#2563EB] transition-colors">Foto Produk Langsung</h3>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">Unggah foto HP, otomatis ditata pencahayaan &amp; studionya.</p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-50 group-hover:bg-[#2563EB] text-[#2563EB] group-hover:text-white text-xs font-bold transition-all shadow-xs">
                  <span>Buka Kamera / Unggah &rarr;</span>
                </span>
              </div>
            </div>
          </Link>

          <Link
            to="/creator/studio?mode=t2i"
            className="group p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-[#CBD5E1] hover:border-[#2563EB] shadow-xs hover:shadow-xl transition-all duration-300 flex items-start gap-5 hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E3A8A] text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/30 group-hover:scale-105 transition-transform">
              <PenTool className="w-7 h-7 text-[#38BDF8]" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="text-base sm:text-lg font-black text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                Buat dari <span className="text-[#2563EB]">Teks</span>
              </h3>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">Ketik ide promosi tanpa perlu foto produk terlebih dahulu.</p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-50 group-hover:bg-[#2563EB] text-[#2563EB] group-hover:text-white text-xs font-bold transition-all shadow-xs">
                  <span>Mulai Ketik Ide &rarr;</span>
                </span>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* 3. RECENT CREATIONS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#0F172A] tracking-tight">Poster Hasil Buatan Terakhir</h2>
            <p className="text-xs text-[#64748B]">Koleksi karya promosi produk UMKM yang telah siap diunduh &amp; dibagikan</p>
          </div>
          <Link to="/creator/history" className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-1">
            <span>Lihat Semua Riwayat</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recent.isLoading ? (
          <LoadingBlock label="Memuat karya terakhir..." />
        ) : recent.isError ? (
          <ErrorBlock error={recent.error} onRetry={() => void recent.refetch()} title="Karya terakhir tidak dapat dimuat" />
        ) : posters.length === 0 ? (
          <EmptyBlock
            title="Belum ada poster yang selesai"
            hint="Mulai dari template pilihan, unggah foto produk, lalu hasilnya akan muncul di sini."
            action={
              <Link to="/creator/gallery" className="inline-flex px-5 py-2 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-black transition-colors">
                Lihat Galeri Template
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {posters.map((poster) => {
              const title = generationTitle(poster);
              return (
                <div
                  key={poster.id}
                  data-testid="recent-card"
                  className="bg-white rounded-3xl border border-[#CBD5E1] p-3.5 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col justify-between hover:-translate-y-1"
                >
                  <div>
                    <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 mb-3 border border-slate-100">
                      <img
                        src={imageSrc(poster.thumbnail_url ?? poster.result_url)}
                        alt={title}
                        loading="lazy"
                        draggable={false}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md border border-white text-[10px] font-black text-[#2563EB] shadow-xs">
                          {categoryLabel(poster.publication)}
                        </span>
                      </div>
                      {dimensionsLabel(poster) && (
                        <div className="absolute bottom-2.5 right-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-bold text-white">{dimensionsLabel(poster)}</span>
                        </div>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-[#0F172A] line-clamp-1 leading-snug" title={title}>
                      {title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] mt-0.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{relativeTime(poster.created_at)}</span>
                    </div>
                  </div>

                  <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => void download(poster)}
                      disabled={downloadingId === poster.id}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-[#2563EB] transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {downloadingId === poster.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>Unduh HD</span>
                    </button>
                    <Link to="/creator/history" className="inline-flex items-center gap-1 text-xs font-bold text-[#0F172A] hover:text-[#2563EB] transition-colors">
                      <Eye className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Riwayat</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
export default Dashboard;
