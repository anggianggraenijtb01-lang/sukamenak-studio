import React, { useState, useRef } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Save,
  ArrowLeft,
  Check,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';

interface TemplateItem {
  id: string;
  title: string;
  category: string;
  image: string;
  aspectRatio?: string;
  promptSnippet: string;
  active: boolean;
  downloads: number;
}

const PRESET_IMAGES = [
  { label: 'Keripik Tempe', url: '/posters/poster-keripik.jpg' },
  { label: 'Kopi Robusta', url: '/posters/poster-kopi.jpg' },
  { label: 'Bazar Promo', url: '/posters/poster-bazar.jpg' },
  { label: 'Kue Basah', url: '/posters/poster-kue.jpg' },
  { label: 'Kriya Tas Rajut', url: '/posters/poster-kriya.jpg' },
];

export const AdminTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateItem[]>([
    {
      id: 't-1',
      title: 'Keripik Tempe Gurih Daun Jeruk',
      category: 'Kuliner UMKM',
      image: '/posters/poster-keripik.jpg',
      promptSnippet: 'Foto kemasan produk standing pouch keripik tempe renyah dengan pencahayaan hangat komersial 4:5.',
      active: true,
      downloads: 142,
    },
    {
      id: 't-2',
      title: 'Kopi Robusta Puntang Single Origin',
      category: 'Katalog Produk',
      image: '/posters/poster-kopi.jpg',
      promptSnippet: 'Foto studio kraft pouch kopi robusta dengan taburan biji kopi di atas kain goni estetik.',
      active: true,
      downloads: 98,
    },
    {
      id: 't-3',
      title: 'Bazar Murah Sembako UMKM',
      category: 'Promo Komersial',
      image: '/posters/poster-bazar.jpg',
      promptSnippet: 'Poster editorial promosi sembako beras dan minyak dengan layout tipografi terstruktur.',
      active: true,
      downloads: 87,
    },
    {
      id: 't-4',
      title: 'Kue Basah & Jajanan Tradisional',
      category: 'Kuliner UMKM',
      image: '/posters/poster-kue.jpg',
      promptSnippet: 'Susunan aneka kue basah tradisional di atas tampah bambu dengan pencahayaan alami jendela.',
      active: true,
      downloads: 65,
    },
    {
      id: 't-5',
      title: 'Tas Anyaman Rajut Etnik Nusantara',
      category: 'Kriya & Kerajinan',
      image: '/posters/poster-kriya.jpg',
      promptSnippet: 'Foto produk tas anyaman rajut premium dengan latar kayu bersih dan pencahayaan studio tiga titik.',
      active: false,
      downloads: 43,
    },
    {
      id: 't-6',
      title: 'Madu Hutan Alami Murni',
      category: 'Katalog Produk',
      image: '/posters/poster-kopi.jpg',
      promptSnippet: 'Botol kaca madu murni dengan lelehan madu keemasan di atas meja marmer putih.',
      active: true,
      downloads: 112,
    },
    {
      id: 't-7',
      title: 'Sambal Roa Khas Nusantara',
      category: 'Kuliner UMKM',
      image: '/posters/poster-keripik.jpg',
      promptSnippet: 'Toples jar sambal roa gurih pedas dengan garnish cabai merah segar dan daun kemangi.',
      active: true,
      downloads: 79,
    },
    {
      id: 't-8',
      title: 'Koleksi Hijab Katun Voal Segi Empat',
      category: 'Fashion',
      image: '/posters/poster-kriya.jpg',
      promptSnippet: 'Lipatan hijab segi empat warna pastel elegan dengan pencahayaan lembut studio fashion.',
      active: true,
      downloads: 94,
    },
  ]);

  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('Kuliner UMKM');
  const [formAspectRatio, setFormAspectRatio] = useState('4:5');
  const [formPromptSnippet, setFormPromptSnippet] = useState('');
  const [formImage, setFormImage] = useState('/posters/poster-keripik.jpg');
  const [customImages, setCustomImages] = useState<{ label: string; url: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setFormImage(result);
        setCustomImages((prev) => [{ label: file.name.slice(0, 14), url: result }, ...prev]);
        showNotice('Gambar kustom berhasil diunggah!');
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleStatus = (id: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, active: !t.active } : t))
    );
    showNotice('Status template berhasil diperbarui.');
  };

  const handleDelete = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    showNotice('Template berhasil dihapus.');
  };

  const startCreate = () => {
    setFormTitle('');
    setFormCategory('Kuliner UMKM');
    setFormAspectRatio('4:5');
    setFormPromptSnippet('');
    setFormImage('/posters/poster-keripik.jpg');
    setEditingId(null);
    setViewMode('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEdit = (tpl: TemplateItem) => {
    setFormTitle(tpl.title);
    setFormCategory(tpl.category);
    setFormAspectRatio(tpl.aspectRatio || '4:5');
    setFormPromptSnippet(tpl.promptSnippet);
    setFormImage(tpl.image);
    setEditingId(tpl.id);
    setViewMode('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelForm = () => {
    setViewMode('list');
    setEditingId(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (viewMode === 'create') {
      const newTpl: TemplateItem = {
        id: `t-${Date.now()}`,
        title: formTitle,
        category: formCategory,
        aspectRatio: formAspectRatio,
        image: formImage,
        promptSnippet: formPromptSnippet || 'Visual komersial bersih rasio 4:5 dengan pencahayaan studio terstandarisasi.',
        active: true,
        downloads: 0,
      };
      setTemplates((prev) => [newTpl, ...prev]);
      showNotice('Template baru berhasil ditambahkan ke studio!');
    } else if (viewMode === 'edit' && editingId) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? {
                ...t,
                title: formTitle,
                category: formCategory,
                aspectRatio: formAspectRatio,
                image: formImage,
                promptSnippet: formPromptSnippet,
              }
            : t
        )
      );
      showNotice('Perubahan template berhasil disimpan!');
    }

    setViewMode('list');
    setEditingId(null);
  };

  return (
    <div className="space-y-6 pb-12 relative">
      {/* ── NOTIFICATION TOAST ── */}
      {notification && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs font-bold text-[#2563EB] flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span>{notification}</span>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          VIEW 1: LIST TEMPLATE & SLOT STUDIO
      ═════════════════════════════════════════════════════════════════ */}
      {viewMode === 'list' && (
        <>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/25">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
                  Manajemen Template <span className="text-[#2563EB]">&amp; Slot Studio</span>
                </h1>
                <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
                  Kelola template poster 4:5 dan preset pencahayaan komersial siap pakai.
                </p>
              </div>
            </div>

            {/* Tombol Tambah Template Baru — Tanda + Cuma Satu */}
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-black transition-all cursor-pointer shadow-md shadow-blue-500/25 self-start sm:self-center"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Template Baru</span>
            </button>
          </div>

          {/* Grid Template Cards (Zero-Cropping Cards: 4:5 HD) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-4 shadow-xs hover:shadow-xl transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Zero-cropping vertical 4:5 container */}
                  <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 mb-3 shadow-inner">
                    <img
                      src={tpl.image}
                      alt={tpl.title}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-white/95 text-[10px] font-black text-[#2563EB] shadow-xs">
                      {tpl.category}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[#0F172A] line-clamp-1">
                    {tpl.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Diunduh {tpl.downloads} kali oleh kreator
                  </p>
                </div>

                {/* Action Bar: Status Toggle, Edit, Delete */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleStatus(tpl.id)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                      tpl.active
                        ? 'bg-blue-50 text-[#2563EB] border border-blue-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-300'
                    }`}
                  >
                    {tpl.active ? 'Aktif' : 'Nonaktif'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(tpl)}
                      className="p-2 rounded-full hover:bg-blue-50 text-slate-600 hover:text-[#2563EB] transition-colors cursor-pointer"
                      title="Edit Template"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tpl.id)}
                      className="p-2 rounded-full hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors cursor-pointer"
                      title="Hapus Template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          VIEW 2 & 3: FORM DEDICATED HALAMAN PENUH (CREATE & EDIT)
      ═════════════════════════════════════════════════════════════════ */}
      {(viewMode === 'create' || viewMode === 'edit') && (
        <div className="space-y-6">
          {/* Back Navigation Bar */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={cancelForm}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 hover:border-[#2563EB] text-xs font-bold text-[#0F172A] hover:text-[#2563EB] transition-colors shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Daftar Template</span>
            </button>
            <span className="text-xs font-bold text-slate-400">
              {viewMode === 'create' ? 'Mode Tambah Baru' : 'Mode Edit Template'}
            </span>
          </div>

          {/* Form Header Card */}
          <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/25">
                {viewMode === 'create' ? <Plus className="w-6 h-6" /> : <Edit2 className="w-5 h-5" />}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
                  {viewMode === 'create' ? 'Tambah Template Baru' : `Edit Template: ${formTitle || 'Tanpa Judul'}`}
                </h1>
                <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
                  Konfigurasi preset template poster rasio 4:5 dan parameter visual studio.
                </p>
              </div>
            </div>
          </div>

          {/* Main Form & Live Preview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT: FORM INPUTS (7 Cols) */}
            <form
              onSubmit={handleSave}
              className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6"
            >
              {/* Field 1: Nama Template */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Nama Template
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Contoh: Keripik Tempe Gurih Renyah"
                  className="w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all"
                />
              </div>

              {/* Field 2: Kategori UMKM */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Kategori UMKM
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all cursor-pointer"
                >
                  <option value="Kuliner UMKM">Kuliner UMKM</option>
                  <option value="Kriya & Kerajinan">Kriya &amp; Kerajinan</option>
                  <option value="Fashion">Fashion &amp; Busana</option>
                  <option value="Katalog Produk">Katalog Produk</option>
                  <option value="Poster Promo">Poster Promo</option>
                  <option value="Promo Komersial">Promo Komersial</option>
                </select>
              </div>

              {/* Field 3: Pilihan Rasio Kanvas */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Ukuran &amp; Rasio Template
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: '4:5', label: '4:5 Vertikal', sub: 'Feed Medsos' },
                    { id: '1:1', label: '1:1 Persegi', sub: 'Katalog & WA' },
                    { id: '9:16', label: '9:16 Story', sub: 'Story & Reels' },
                    { id: '16:9', label: '16:9 Banner', sub: 'Lanskap Web' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setFormAspectRatio(r.id)}
                      className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                        formAspectRatio === r.id
                          ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB] shadow-xs ring-1 ring-blue-500/20'
                          : 'bg-[#F8FAFC] border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-black">{r.label}</div>
                      <div className="text-[9px] text-slate-400">{r.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 3: Pilihan & Unggah Gambar Template (Upload Gambar Sendiri) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Gambar Preview Template (Rasio 4:5 HD)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] border border-[#BFDBFE] text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Unggah Gambar</span>
                  </button>
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCustomImageUpload}
                  className="hidden"
                />

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {/* Upload Tile */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[4/5] rounded-xl border-2 border-dashed border-blue-300 hover:border-[#2563EB] bg-blue-50/40 hover:bg-blue-50 flex flex-col items-center justify-center p-2 text-center transition-all cursor-pointer group"
                    title="Pilih file foto dari komputer"
                  >
                    <div className="w-8 h-8 rounded-full bg-white shadow-xs flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                      <Upload className="w-4 h-4 text-[#2563EB]" />
                    </div>
                    <span className="text-[10px] font-bold text-[#2563EB] leading-tight">
                      + Unggah
                    </span>
                  </button>

                  {/* Uploaded custom images & Presets */}
                  {[...customImages, ...PRESET_IMAGES].map((img, idx) => (
                    <button
                      key={`${img.url}-${idx}`}
                      type="button"
                      onClick={() => setFormImage(img.url)}
                      className={`relative rounded-xl overflow-hidden aspect-[4/5] border-2 transition-all cursor-pointer group ${
                        formImage === img.url
                          ? 'border-[#2563EB] ring-2 ring-blue-500/30'
                          : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/70 text-[9px] text-white py-0.5 px-1 text-center font-bold truncate">
                        {img.label}
                      </div>
                      {formImage === img.url && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-[10px]">
                          ✓
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 4: Display Prompt Snippet */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Display Prompt Snippet
                </label>
                <textarea
                  rows={4}
                  value={formPromptSnippet}
                  onChange={(e) => setFormPromptSnippet(e.target.value)}
                  placeholder="Instruksi pencahayaan, material alas meja, dan komposisi sudut kamera 45°..."
                  className="w-full p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all font-mono leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-6 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-black shadow-md shadow-blue-500/25 cursor-pointer transition-all hover:shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>{viewMode === 'create' ? 'Simpan Template' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>

            {/* RIGHT: LIVE CARD PREVIEW (5 Cols) */}
            <div className="lg:col-span-5 space-y-3 sticky top-24">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                Live Preview <span className="text-[#2563EB]">Tampilan Template</span>
              </span>

              <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-md flex flex-col justify-between space-y-4">
                <div>
                  <div className={`relative ${formAspectRatio === "1:1" ? "aspect-square" : formAspectRatio === "9:16" ? "aspect-[9/16] max-h-[460px] mx-auto" : formAspectRatio === "16:9" ? "aspect-video" : "aspect-[4/5]"} rounded-2xl overflow-hidden bg-slate-900 border border-slate-100 mb-3 shadow-inner`}>
                    <img
                      src={formImage}
                      alt="Preview Template"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-white/95 text-[10px] font-black text-[#2563EB] shadow-xs">
                      {formCategory}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-[#0F172A] line-clamp-1">
                    {formTitle || 'Judul Template Baru'}
                  </h3>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-100 text-xs text-slate-600 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Snippet Prompt AI:
                  </span>
                  <p className="text-xs text-slate-700 italic line-clamp-3 leading-relaxed">
                    {formPromptSnippet || 'Belum ada snippet prompt. Prompt standar studio akan digunakan.'}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
export default AdminTemplates;
