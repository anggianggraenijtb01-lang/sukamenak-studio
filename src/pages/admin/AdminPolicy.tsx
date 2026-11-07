import React, { useState } from 'react';
import {
  FileCheck,
  ShieldAlert,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export const AdminPolicy: React.FC = () => {
  const [blockedTerms, setBlockedTerms] = useState<string[]>([
    'politik_praktis',
    'partai_pemilu',
    'hoaks_warga',
    'judi_online',
    'slot_gacor',
    'SARA_ujaran_kebencian',
    'konten_dewasa',
    'minuman_keras',
    'penipuan_investasi',
  ]);
  const [newTerm, setNewTerm] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const [policyRules, setPolicyRules] = useState([
    {
      id: 'pr-1',
      title: 'Pencegahan Model Wajah di Bawah Umur',
      desc: 'Sistem Vision secara otomatis memblokir foto yang mengandung wajah anak-anak tanpa persetujuan wali.',
      enabled: true,
    },
    {
      id: 'pr-2',
      title: 'Validasi Logo Usaha Asli UMKM',
      desc: 'Mencegah pemakaian logo merek besar internasional yang melanggar hak cipta komersial.',
      enabled: true,
    },
    {
      id: 'pr-3',
      title: 'Watermark Resmi Sukamenak Studio',
      desc: 'Menyematkan stempel resmi pada footer poster untuk keaslian materi.',
      enabled: true,
    },
    {
      id: 'pr-4',
      title: 'Deteksi Penipuan Hadiah / Undian Palsu',
      desc: 'Menolak teks promosi yang mengandung klaim undian palsu yang merugikan sesama warga.',
      enabled: true,
    },
  ]);

  const handleAddTerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim()) return;
    setBlockedTerms((prev) => [...prev, newTerm.trim().toLowerCase()]);
    setNewTerm('');
    setNotification('Kata kunci terlarang berhasil ditambahkan ke filter.');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRemoveTerm = (term: string) => {
    setBlockedTerms((prev) => prev.filter((t) => t !== term));
    setNotification('Kata kunci dihapus dari filter.');
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleRule = (id: string) => {
    setPolicyRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50/90 via-white to-sky-50/50 rounded-3xl border border-[#BFDBFE] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/25">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Content <span className="text-[#2563EB]">Policy</span> &amp; Sensor Moderasi
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
              Aturan sensor otomatis untuk mencegah penyalahgunaan konten politik praktis, SARA, dan judi online.
            </p>
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs font-bold text-[#2563EB] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span>{notification}</span>
        </div>
      )}

      {/* 3 Kartu Berwarna Menarik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-blue-50/80 via-white to-blue-50/30 rounded-3xl border-2 border-[#BFDBFE] p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] block">
            Filter Kata Terlarang
          </span>
          <div className="text-3xl font-black text-[#0F172A] mt-2">
            {blockedTerms.length} <span className="text-xs font-semibold text-slate-500">Istilah</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Diblokir otomatis pada prompt &amp; judul poster
          </p>
        </div>

        <div className="bg-gradient-to-br from-sky-50/80 via-white to-sky-50/30 rounded-3xl border-2 border-[#BAE6FD] p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#0284C7] block">
            Pemeriksaan Otomatis
          </span>
          <div className="text-3xl font-black text-[#0F172A] mt-2">
            Real-Time <span className="text-xs font-semibold text-slate-500">Pipeline</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pencegahan terjadi sebelum instruksi dikirim ke AI
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-100/90 via-white to-slate-50/50 rounded-3xl border-2 border-slate-300 p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
            Kepatuhan Etika Lingkungan
          </span>
          <div className="text-3xl font-black text-[#0F172A] mt-2">
            100% <span className="text-xs font-semibold text-slate-500">100% Bersih</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Menjaga keharmonisan dan kerukunan warga desa
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Aturan Moderasi Otomatis */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-[#CBD5E1] p-6 shadow-xs space-y-4">
          <h2 className="text-base font-black text-[#0F172A]">
            Aturan Moderasi &amp; Kepatuhan Sistem
          </h2>
          <div className="space-y-3">
            {policyRules.map((rule) => (
              <div
                key={rule.id}
                className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[#0F172A] flex items-center gap-2">
                    <span>{rule.title}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {rule.desc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleRule(rule.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer flex-shrink-0 ${
                    rule.enabled
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {rule.enabled ? 'Aktif' : 'Mati'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Daftar Kata Terlarang */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-[#CBD5E1] p-6 shadow-xs space-y-4">
          <h2 className="text-base font-black text-[#0F172A]">
            Daftar Istilah Terlarang (Blocked Keywords)
          </h2>
          <p className="text-xs text-slate-500">
            Prompt yang mengandung istilah ini akan ditolak langsung pada tahap validasi awal.
          </p>

          <form onSubmit={handleAddTerm} className="flex gap-2">
            <input
              type="text"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              placeholder="Ketik istilah baru (contoh: judol)..."
              className="flex-1 px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah</span>
            </button>
          </form>

          <div className="flex flex-wrap gap-2 pt-2">
            {blockedTerms.map((term) => (
              <span
                key={term}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700"
              >
                <span>{term}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTerm(term)}
                  className="hover:text-red-600 transition-colors cursor-pointer"
                  title="Hapus kata ini"
                >
                  <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-600" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
export default AdminPolicy;

