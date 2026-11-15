import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Copy, Eye, Image as ImageIcon, Loader2, Search, ShieldCheck } from 'lucide-react';
import { getTemplate, listGallery, listTemplates } from '../../api/creator';
import { fileUrl } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import type { GalleryItem, TemplateCategory, TemplateListItem } from '../../api/types';
import { useCopy } from '../../components/creator/clipboard';
import { CATEGORY_LABELS, CATEGORY_ORDER, categoryLabel } from '../../components/creator/labels';
import { Modal } from '../../components/creator/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/creator/StateViews';
import { allowedModes, visibleSlots } from '../../components/creator/studioLogic';

type View = 'templates' | 'gallery';
type CategoryFilter = 'all' | TemplateCategory;

const GALLERY_PAGE_SIZE = 24;
const MODE_TEXT = { i2i: 'Foto ke Gambar', t2i: 'Teks ke Gambar' } as const;

/** Filter used by both tabs: category chip plus a free-text search. Pure, so it is easy to reason about. */
export function matchesFilter(
  fields: { category?: string | null; text: Array<string | null | undefined> },
  category: CategoryFilter,
  search: string,
): boolean {
  if (category !== 'all' && fields.category !== category) return false;
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return fields.text.some((t) => (t ?? '').toLowerCase().includes(q));
}

export const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('templates');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [templatePreview, setTemplatePreview] = useState<TemplateListItem | null>(null);
  const [itemPreview, setItemPreview] = useState<GalleryItem | null>(null);
  const { copiedKey, failedKey, copy } = useCopy();

  // Signed image URLs live ~15 minutes, so the cache time stays well below that.
  const templatesQuery = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: ({ signal }) => listTemplates(undefined, signal),
    staleTime: 5 * 60_000,
  });
  const galleryQuery = useInfiniteQuery({
    queryKey: [...queryKeys.gallery.list({ limit: GALLERY_PAGE_SIZE }), 'pages'] as const,
    queryFn: ({ pageParam, signal }) => listGallery({ page: pageParam, limit: GALLERY_PAGE_SIZE }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.total_pages ? last.meta.page + 1 : undefined),
    enabled: view === 'gallery',
    staleTime: 5 * 60_000,
  });

  const templates = useMemo(
    () =>
      (templatesQuery.data ?? []).filter((t) =>
        matchesFilter({ category: t.category, text: [t.name, t.description, categoryLabel(t.category)] }, category, search),
      ),
    [templatesQuery.data, category, search],
  );
  const galleryItems = useMemo(
    () =>
      (galleryQuery.data?.pages.flatMap((p) => p.items) ?? []).filter((g) =>
        matchesFilter({ category: g.template?.category, text: [g.title, g.display_prompt, g.template?.name] }, category, search),
      ),
    [galleryQuery.data, category, search],
  );

  const openInStudio = (slug: string | undefined) => navigate(slug ? `/creator/studio?template=${encodeURIComponent(slug)}` : '/creator/studio');

  const copyButtonLabel = (key: string, idle: string) => (copiedKey === key ? 'Tersalin' : failedKey === key ? 'Salin manual' : idle);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="relative max-w-xl flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4 text-[#2563EB]" />
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari template atau inspirasi"
              placeholder="Cari inspirasi template promosi..."
              className="w-full pl-11 pr-5 py-3 rounded-full bg-white border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder:text-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all"
            />
          </div>

          <div className="inline-flex p-1.5 rounded-2xl bg-white border border-[#BFDBFE] shadow-xs self-start" role="tablist" aria-label="Tampilan galeri">
            {(
              [
                ['templates', 'Katalog Template'],
                ['gallery', 'Inspirasi Karya'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${view === id ? 'bg-[#2563EB] text-white shadow-xs' : 'text-slate-600 hover:text-[#0F172A]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1" role="group" aria-label="Filter kategori">
          {(['all', ...CATEGORY_ORDER] as CategoryFilter[]).map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={category === cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                category === cat
                  ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/25 border border-[#2563EB]'
                  : 'bg-white border border-[#CBD5E1] text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]'
              }`}
            >
              {cat === 'all' ? 'Semua' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {view === 'templates' ? (
        templatesQuery.isLoading ? (
          <LoadingBlock label="Memuat template..." />
        ) : templatesQuery.isError ? (
          <ErrorBlock error={templatesQuery.error} onRetry={() => void templatesQuery.refetch()} title="Template tidak dapat dimuat" />
        ) : templates.length === 0 ? (
          <EmptyBlock
            title={search || category !== 'all' ? 'Tidak ada template yang cocok' : 'Belum ada template'}
            hint={search || category !== 'all' ? 'Coba kata kunci lain atau pilih kategori "Semua".' : 'Template akan muncul di sini setelah admin mempublikasikannya.'}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((tpl) => (
              <div
                key={tpl.slug}
                data-testid="template-card"
                className="bg-white rounded-3xl p-3.5 sm:p-4 border border-[#CBD5E1] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1.5 select-none"
              >
                <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-100 mb-3 border border-slate-100">
                  {tpl.preview_url ? (
                    <img
                      src={fileUrl(tpl.preview_url)}
                      alt={tpl.name}
                      draggable={false}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-10 h-10" aria-hidden="true" />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md border border-white text-[10px] font-black text-[#2563EB] shadow-xs">
                      {categoryLabel(tpl.category)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTemplatePreview(tpl)}
                    title="Lihat detail template"
                    aria-label={`Lihat detail template ${tpl.name}`}
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="px-1 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-sans text-sm sm:text-base font-bold text-[#0F172A] truncate" title={tpl.name}>
                      {tpl.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1 font-normal leading-relaxed">{tpl.description}</p>
                    <p className="text-[10px] text-slate-400 mt-1.5 font-semibold">
                      {allowedModes(tpl).map((m) => MODE_TEXT[m]).join(' / ')} &bull; Rasio {tpl.aspect_ratio}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => openInStudio(tpl.slug)}
                      className="w-full py-2.5 px-3 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer hover:shadow-md"
                    >
                      <span>Pakai Template</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : galleryQuery.isLoading ? (
        <LoadingBlock label="Memuat inspirasi karya..." />
      ) : galleryQuery.isError ? (
        <ErrorBlock error={galleryQuery.error} onRetry={() => void galleryQuery.refetch()} title="Galeri tidak dapat dimuat" />
      ) : galleryItems.length === 0 ? (
        <EmptyBlock
          title={search || category !== 'all' ? 'Tidak ada karya yang cocok' : 'Galeri masih kosong'}
          hint={
            search || category !== 'all'
              ? 'Coba kata kunci lain, pilih kategori "Semua", atau muat lebih banyak karya.'
              : 'Karya pilihan admin akan tampil di sini. Sementara itu, mulai dari Katalog Template.'
          }
          action={
            galleryQuery.hasNextPage ? (
              <button type="button" onClick={() => void galleryQuery.fetchNextPage()} className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer">
                Muat lebih banyak
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleryItems.map((item) => (
              <div
                key={item.id}
                data-testid="gallery-card"
                className="bg-white rounded-3xl p-3.5 sm:p-4 border border-[#CBD5E1] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1.5 select-none"
              >
                <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-100 mb-3 border border-slate-100">
                  <img src={fileUrl(item.image_url)} alt={item.title} draggable={false} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  <div className="absolute top-2.5 left-2.5">
                    <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md border border-white text-[10px] font-black text-[#2563EB] shadow-xs">
                      {item.template ? categoryLabel(item.template.category) : 'Karya'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setItemPreview(item)}
                    title="Pratinjau prompt"
                    aria-label={`Pratinjau prompt ${item.title}`}
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="px-1 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-sans text-sm sm:text-base font-bold text-[#0F172A] truncate" title={item.title}>
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1 font-normal leading-relaxed">{item.display_prompt}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openInStudio(item.template?.slug)}
                      className="w-full py-2.5 px-3 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer hover:shadow-md"
                    >
                      <span>Pakai Template</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void copy(item.id, item.display_prompt)}
                      className="w-full py-2.5 px-3 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0F172A] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedKey === item.id ? <Check className="w-3 h-3 text-[#2563EB]" /> : <Copy className="w-3 h-3 text-slate-500" />}
                      <span className={copiedKey === item.id ? 'text-[#2563EB]' : ''}>{copyButtonLabel(item.id, 'Salin Teks')}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {galleryQuery.hasNextPage && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void galleryQuery.fetchNextPage()}
                disabled={galleryQuery.isFetchingNextPage}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white border border-[#CBD5E1] hover:border-[#2563EB] text-xs font-bold text-[#2563EB] transition-colors cursor-pointer disabled:opacity-60"
              >
                {galleryQuery.isFetchingNextPage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Muat lebih banyak</span>
              </button>
            </div>
          )}
        </>
      )}

      {itemPreview && (
        <Modal title={itemPreview.title} eyebrow={itemPreview.template ? categoryLabel(itemPreview.template.category) : 'Karya'} onClose={() => setItemPreview(null)}>
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] font-mono leading-relaxed select-all whitespace-pre-wrap">
            {itemPreview.display_prompt}
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => void copy(`modal-${itemPreview.id}`, itemPreview.display_prompt)}
              className="px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-bold text-slate-700 hover:border-[#2563EB] hover:text-[#2563EB] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedKey === `modal-${itemPreview.id}` ? <Check className="w-3.5 h-3.5 text-blue-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === `modal-${itemPreview.id}` ? 'Tersalin ke Clipboard!' : failedKey === `modal-${itemPreview.id}` ? 'Salin manual dari kotak di atas' : 'Salin Teks Prompt'}</span>
            </button>
            {itemPreview.template && (
              <button
                type="button"
                onClick={() => openInStudio(itemPreview.template?.slug)}
                className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition-all cursor-pointer"
              >
                <span>Gunakan di Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </Modal>
      )}

      {templatePreview && <TemplateDetailModal template={templatePreview} onClose={() => setTemplatePreview(null)} onUse={() => openInStudio(templatePreview.slug)} />}
    </div>
  );
};

const TemplateDetailModal: React.FC<{ template: TemplateListItem; onClose: () => void; onUse: () => void }> = ({ template, onClose, onUse }) => {
  const detail = useQuery({
    queryKey: queryKeys.templates.detail(template.slug),
    queryFn: ({ signal }) => getTemplate(template.slug, signal),
    staleTime: 5 * 60_000,
  });
  const slots = detail.data ? visibleSlots(detail.data) : [];
  return (
    <Modal title={template.name} eyebrow={categoryLabel(template.category)} onClose={onClose}>
      <p className="text-sm text-slate-600 leading-relaxed">{template.description}</p>
      <p className="text-[11px] text-slate-400 font-semibold">
        {allowedModes(template).map((m) => MODE_TEXT[m]).join(' / ')} &bull; Rasio {template.aspect_ratio}
      </p>
      {template.requires_consent && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold flex items-start gap-2">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Template ini menampilkan orang, sehingga Anda perlu menyatakan persetujuan sebelum membuat desain.</span>
        </div>
      )}
      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Isian yang tersedia</span>
        {detail.isLoading ? (
          <LoadingBlock label="Memuat isian..." className="py-4" />
        ) : detail.isError ? (
          <ErrorBlock error={detail.error} onRetry={() => void detail.refetch()} title="Isian tidak dapat dimuat" />
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {slots.map((s) => (
              <li key={s.key} className="px-2.5 py-1 rounded-full bg-[#F8FAFC] border border-slate-200 text-[11px] font-semibold text-[#0F172A]">
                {s.label}
                {s.target === 'overlay' ? ' (teks pada gambar)' : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-end pt-2">
        <button
          type="button"
          onClick={onUse}
          className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition-all cursor-pointer"
        >
          <span>Pakai Template</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </Modal>
  );
};

export default Gallery;
