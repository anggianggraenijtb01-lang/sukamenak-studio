import React, { useState } from 'react';
import { Download, Link2, Check, Clock, Zap } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const historyItems = [
    {
      id: 'h1',
      title: 'Keripik Tempe Gurih Bu Cantika',
      time: '10 menit lalu',
      executionTime: 'Rendered in 4.2s',
      badge: '4:5 HD',
      image: '/posters/poster-keripik.jpg',
    },
    {
      id: 'h2',
      title: 'Kopi Robusta Puntang Single Origin',
      time: '2 jam lalu',
      executionTime: 'Rendered in 3.8s',
      badge: '4:5 HD',
      image: '/posters/poster-kopi.jpg',
    },
    {
      id: 'h3',
      title: 'Jadwal Pengajian Rutin RT 03',
      time: 'Kemarin, 19:30',
      executionTime: 'Rendered in 4.5s',
      badge: '4:5 HD',
      image: '/posters/poster-pengajian.jpg',
    },
    {
      id: 'h4',
      title: 'Spanduk Bazar Sembako Murah',
      time: '3 hari lalu',
      executionTime: 'Rendered in 5.1s',
      badge: '4:5 HD',
      image: '/posters/poster-bazar.jpg',
    },
    {
      id: 'h5',
      title: 'Kue Basah & Jajanan Tradisional',
      time: '5 hari lalu',
      executionTime: 'Rendered in 4.0s',
      badge: '4:5 HD',
      image: '/posters/poster-kue.jpg',
    },
    {
      id: 'h6',
      title: 'Tas Rajut Anyaman Benang Katun',
      time: '1 minggu lalu',
      executionTime: 'Rendered in 4.6s',
      badge: '4:5 HD',
      image: '/posters/poster-kriya.jpg',
    },
  ];

  const handleDownload = (img: string, title: string) => {
    const link = document.createElement('a');
    link.href = img;
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-hd.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareLink = (id: string, image: string) => {
    const url = `${window.location.origin}${image}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header (No small pill badge) */}
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
            Riwayat &amp; Unduhan
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-1 font-normal">
            Daftar seluruh materi promosi yang telah berhasil Anda buat dan siap diunduh kembali kapan saja.
          </p>
        </div>
        <div className="text-xs font-bold text-slate-500">
          Total tersimpan: <strong className="text-[#2563EB] font-black">{historyItems.length} Desain HD</strong>
        </div>
      </div>

      {/* Multi-column grid of all previously generated posters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {historyItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-3xl border border-[#CBD5E1] p-4 space-y-3.5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
          >
            <div>
              {/* 4:5 Poster Container */}
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 border border-slate-100">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Timestamp badge */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono text-white border border-white/20 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-300" />
                    <span>{item.time}</span>
                  </span>
                </div>

                {/* Format badge */}
                <div className="absolute top-2.5 right-2.5">
                  <span className="px-2.5 py-1 rounded-full bg-[#2563EB]/90 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-white/20">
                    {item.badge}
                  </span>
                </div>

                {/* Pipeline Execution Time Badge */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-[10px] font-mono text-slate-200 border border-white/10 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sky-400">
                      <Zap className="w-3 h-3" />
                      <span>Pipeline</span>
                    </span>
                    <span>{item.executionTime}</span>
                  </span>
                </div>
              </div>

              <div className="pt-3">
                <h3 className="text-sm font-bold text-[#0F172A] line-clamp-1 leading-snug">
                  {item.title}
                </h3>
              </div>
            </div>

            {/* Persistent Direct Download and Share Link Buttons */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownload(item.image, item.title)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0F172A] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh HD</span>
              </button>

              <button
                type="button"
                onClick={() => handleShareLink(item.id, item.image)}
                className="py-2 px-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Salin tautan poster"
              >
                {copiedId === item.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5 text-white" />
                    <span>Share Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default HistoryPage;
