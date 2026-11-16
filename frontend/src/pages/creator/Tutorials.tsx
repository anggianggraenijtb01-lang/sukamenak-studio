import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  Copy,
  Eye,
  Layers,
  Lightbulb,
  ListChecks,
  Palette,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { getTutorial, listTutorials } from '../../api/creator';
import { fileUrl } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import type { TutorialLevel, TutorialSection, TutorialSectionKind, VisualBreakdown, VisualBreakdownAspect } from '../../api/types';
import { useCopy } from '../../components/creator/clipboard';
import { LEVEL_LABELS } from '../../components/creator/labels';
import { MiniMarkdown } from '../../components/creator/MiniMarkdown';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/creator/StateViews';

type Tab = 'tutorial' | 'hacks';
const LEVELS: Array<'all' | TutorialLevel> = ['all', 'pemula', 'menengah', 'mahir'];

const ASPECT_LABELS: Record<VisualBreakdownAspect, string> = {
  style: 'Gaya Visual',
  color: 'Warna',
  gradient: 'Gradasi',
  angle: 'Sudut Kamera',
  lighting: 'Tata Cahaya',
  composition: 'Komposisi',
};
const ASPECT_ICONS: Record<VisualBreakdownAspect, React.ComponentType<{ className?: string }>> = {
  style: Sparkles,
  color: Palette,
  gradient: Layers,
  angle: Camera,
  lighting: Sun,
  composition: Eye,
};

// Editorial copy that has no equivalent in the API (the tutorials, do/don't and style breakdowns now come from it).
const SMARTPHONE_HACKS = [
  {
    number: '01',
    title: 'Bersihkan Lensa Kamera HP dengan Kain Halus',
    desc: 'Minyak dari sidik jari di lensa kamera adalah penyebab utama foto terlihat buram dan berkabut. Usap dengan kain mikrofiber sebelum memotret.',
    tag: 'Ketajaman Maksimal',
  },
  {
    number: '02',
    title: 'Kunci Titik Fokus & Kecerahan (AE/AF Lock)',
    desc: 'Sentuh dan tahan layar HP di bagian label produk hingga muncul tanda "AE/AF LOCK", lalu geser ikon matahari sedikit ke bawah agar label tidak silau.',
    tag: 'Fokus & Kontras',
  },
  {
    number: '03',
    title: 'Reflektor Murah Meriah Selembar Styrofoam',
    desc: 'Letakkan sepotong styrofoam putih atau kardus berlapis kertas HVS putih di sisi produk yang gelap untuk memantulkan cahaya dan menghilangkan bayangan pekat.',
    tag: 'Trik Cahaya Murah',
  },
  {
    number: '04',
    title: 'Manfaatkan Cahaya Jendela Pagi (Natural Softbox)',
    desc: 'Jendela rumah di pagi hari pukul 08.00–10.00 memberikan cahaya alami paling lembut setara softbox studio jutaan rupiah tanpa biaya listrik.',
    tag: 'Pencahayaan Alami',
  },
  {
    number: '05',
    title: 'Gunakan Sudut Ketinggian Mata (Eye-Level)',
    desc: 'Posisikan kamera HP sejajar dengan bagian tengah produk (bukan terlalu menunduk dari atas), agar proporsi botol atau kemasan tampak tinggi dan gagah.',
    tag: 'Proporsi Kemasan',
  },
  {
    number: '06',
    title: 'Gunakan Fitur Grid (Garis Kisi 3x3) di Kamera HP',
    desc: 'Aktifkan pengaturan "Grid" di kamera HP Anda agar garis meja tegak lurus dan posisi produk tidak miring ke kiri atau kanan.',
    tag: 'Simetri & Kerapian',
  },
];

const Banner: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
        Edukasi <span className="text-[#2563EB]">Visual</span>
      </h1>
      <p className="text-xs sm:text-sm text-[#475569] mt-1 font-normal">Panduan praktis pencahayaan studio dan fotografi produk UMKM.</p>
    </div>
    {children}
  </div>
);

export const Tutorials: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  return slug ? <TutorialDetailView slug={slug} /> : <TutorialListView />;
};

// ---- list ------------------------------------------------------------------------------------------------

const TutorialListView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('tutorial');
  const [level, setLevel] = useState<'all' | TutorialLevel>('all');

  const list = useQuery({
    queryKey: queryKeys.tutorials.list(),
    queryFn: ({ signal }) => listTutorials(undefined, signal),
    staleTime: 10 * 60_000,
  });
  const tutorials = (list.data ?? []).filter((t) => level === 'all' || t.level === level);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <Banner>
        <div className="inline-flex p-1.5 rounded-2xl bg-white/80 border border-[#BFDBFE] self-start sm:self-center shadow-xs" role="tablist">
          {(
            [
              ['tutorial', 'Tutorial'],
              ['hacks', 'Trik Kamera HP'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${tab === id ? 'bg-[#2563EB] text-white shadow-xs' : 'text-slate-600 hover:text-[#0F172A]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Banner>

      {tab === 'tutorial' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <h2 className="text-lg font-black text-[#0F172A]">
              Tutorial <span className="text-[#2563EB]">Langkah demi Langkah</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter tingkat">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={level === l}
                  onClick={() => setLevel(l)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    level === l ? 'bg-[#2563EB] text-white border border-[#2563EB]' : 'bg-white border border-[#CBD5E1] text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]'
                  }`}
                >
                  {l === 'all' ? 'Semua' : LEVEL_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          {list.isLoading ? (
            <LoadingBlock label="Memuat tutorial..." />
          ) : list.isError ? (
            <ErrorBlock error={list.error} onRetry={() => void list.refetch()} title="Tutorial tidak dapat dimuat" />
          ) : tutorials.length === 0 ? (
            <EmptyBlock title="Belum ada tutorial" hint={level === 'all' ? 'Tutorial akan muncul di sini setelah dipublikasikan.' : 'Tidak ada tutorial di tingkat ini. Coba tingkat lain.'} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {tutorials.map((t) => (
                <Link
                  key={t.id}
                  to={`/creator/tutorials/${encodeURIComponent(t.slug)}`}
                  data-testid="tutorial-card"
                  className="group bg-white rounded-3xl border border-[#CBD5E1] p-6 shadow-sm hover:shadow-md hover:border-[#2563EB] transition-all flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-black uppercase text-[#2563EB]">{LEVEL_LABELS[t.level]}</span>
                      <div className="w-8 h-8 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-center text-[#2563EB]">
                        <BookOpen className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-sm sm:text-base font-black text-[#1E40AF] group-hover:text-[#2563EB] transition-colors">{t.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">{t.summary}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB]">
                    <span>Baca Tutorial</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'hacks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-lg font-black text-[#0F172A]">
              Trik Fotografi Smartphone <span className="text-[#2563EB]">Tanpa Alat Mahal</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">{SMARTPHONE_HACKS.length} Tips Khusus Kamera HP</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SMARTPHONE_HACKS.map((hack) => (
              <div key={hack.number} className="bg-white rounded-3xl border border-blue-200/80 p-6 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-xl bg-[#2563EB] text-white text-xs font-black flex items-center justify-center shadow-xs">{hack.number}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[10px] font-bold text-[#2563EB] border border-blue-200">{hack.tag}</span>
                  </div>
                  <h3 className="text-sm font-black text-[#0F172A] leading-snug">{hack.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">{hack.desc}</p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-[#2563EB]">
                  <Lightbulb className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Trik Teruji untuk UMKM</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ---- detail ----------------------------------------------------------------------------------------------

const SECTION_STYLE: Record<TutorialSectionKind, { label: string; box: string; badge: string; icon: React.ComponentType<{ className?: string }>; iconBox: string }> = {
  what_to_do: { label: 'LANGKAH', box: 'bg-[#EFF6FF] border-[#BFDBFE]', badge: 'text-[#1D4ED8]', icon: ListChecks, iconBox: 'bg-[#2563EB] text-white' },
  do: { label: 'YANG DIANJURKAN', box: 'bg-blue-50/60 border-blue-200', badge: 'text-[#2563EB]', icon: Check, iconBox: 'bg-[#2563EB] text-white' },
  dont: { label: 'YANG PERLU DIHINDARI', box: 'bg-rose-50/60 border-rose-200', badge: 'text-rose-600', icon: X, iconBox: 'bg-rose-600 text-white' },
  tip: { label: 'TIPS', box: 'bg-amber-50/70 border-amber-200', badge: 'text-amber-700', icon: Lightbulb, iconBox: 'bg-amber-500 text-white' },
  example: { label: 'CONTOH', box: 'bg-slate-50 border-slate-200', badge: 'text-slate-600', icon: Sparkles, iconBox: 'bg-slate-600 text-white' },
};

const SectionCard: React.FC<{ section: TutorialSection }> = ({ section }) => {
  const style = SECTION_STYLE[section.kind] ?? SECTION_STYLE.tip;
  const Icon = style.icon;
  return (
    <div data-kind={section.kind} className={`p-4 sm:p-5 rounded-2xl border flex items-start gap-3.5 ${style.box}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${style.iconBox}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 space-y-1">
        <span className={`text-[10px] font-black uppercase tracking-wider block ${style.badge}`}>{style.label}</span>
        <h3 className="text-sm font-black text-[#0F172A]">{section.title}</h3>
        <MiniMarkdown source={section.body_md} className="text-xs text-slate-700 leading-relaxed" />
      </div>
    </div>
  );
};

const BreakdownCard: React.FC<{ item: VisualBreakdown; copied: boolean; failed: boolean; onCopy: () => void }> = ({ item, copied, failed, onCopy }) => {
  const Icon = ASPECT_ICONS[item.aspect] ?? Sparkles;
  return (
    <div data-testid="breakdown-card" className="bg-white rounded-3xl border border-[#CBD5E1] p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-black uppercase text-[#2563EB]">{ASPECT_LABELS[item.aspect] ?? item.aspect}</span>
          <div className="w-8 h-8 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-center text-[#2563EB]">
            <Icon className="w-4 h-4" />
          </div>
        </div>
        {item.example_url && (
          <img src={fileUrl(item.example_url)} alt={`Contoh ${item.title}`} loading="lazy" draggable={false} className="w-full max-h-48 object-cover rounded-2xl border border-slate-200" />
        )}
        <h3 className="text-sm sm:text-base font-black text-[#1E40AF]">{item.title}</h3>
        <p className="text-xs text-slate-600 leading-relaxed font-normal">{item.description}</p>
      </div>

      <div className="pt-3 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Teks Prompt Siap Pakai:</span>
          <button type="button" onClick={onCopy} aria-label={`Salin teks prompt ${item.title}`} className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer transition-colors">
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-blue-600" />
                <span>Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{failed ? 'Salin manual' : 'Salin Teks'}</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[11px] font-mono text-[#0F172A] whitespace-pre-wrap leading-relaxed select-all">{item.prompt_fragment}</pre>
      </div>
    </div>
  );
};

const TutorialDetailView: React.FC<{ slug: string }> = ({ slug }) => {
  const { copiedKey, failedKey, copy } = useCopy();
  const query = useQuery({
    queryKey: queryKeys.tutorials.detail(slug),
    queryFn: ({ signal }) => getTutorial(slug, signal),
    staleTime: 10 * 60_000,
  });
  const tutorial = query.data;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <Link to="/creator/tutorials" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] hover:underline">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Semua Tutorial</span>
      </Link>

      {query.isLoading ? (
        <LoadingBlock label="Memuat tutorial..." />
      ) : query.isError ? (
        <ErrorBlock error={query.error} onRetry={() => void query.refetch()} title="Tutorial tidak dapat dimuat" />
      ) : tutorial ? (
        <>
          <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 sm:p-7 shadow-xs space-y-2">
            <span className="px-3 py-1 rounded-full bg-white border border-[#BFDBFE] text-[10px] font-black uppercase text-[#2563EB]">{LEVEL_LABELS[tutorial.level]}</span>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">{tutorial.title}</h1>
            <p className="text-xs sm:text-sm text-[#475569] font-normal leading-relaxed">{tutorial.summary}</p>
          </div>

          {tutorial.sections.length === 0 && tutorial.visual_breakdowns.length === 0 ? (
            <EmptyBlock title="Isi tutorial belum tersedia" hint="Admin belum menambahkan langkah untuk tutorial ini." />
          ) : null}

          {tutorial.sections.length > 0 && (
            <div className="space-y-3.5">
              {tutorial.sections.map((section) => (
                <SectionCard key={section.id} section={section} />
              ))}
            </div>
          )}

          {tutorial.visual_breakdowns.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h2 className="text-lg font-black text-[#0F172A]">
                  Bedah Gaya Visual &amp; <span className="text-[#2563EB]">Snippet Prompt Siap Pakai</span>
                </h2>
                <span className="text-xs text-slate-400 font-medium">{tutorial.visual_breakdowns.length} Parameter</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {tutorial.visual_breakdowns.map((item) => (
                  <BreakdownCard key={item.id} item={item} copied={copiedKey === item.id} failed={failedKey === item.id} onCopy={() => void copy(item.id, item.prompt_fragment)} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
export default Tutorials;
