import React from 'react';
import { Link } from 'react-router-dom';
import { useStudio } from '../../components/common/StudioContext';
import {
  Lock,
  Layers,
  ShieldCheck,
  Cpu,
  CheckCircle2,
  Activity,
  ArrowRight,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { traceLogs } = useStudio();

  return (
    <div className="space-y-6">
      {/* 1. HEADER MENU DASHBOARD OPERATOR */}
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] px-6 py-5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/25">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Pusat Kontrol <span className="text-[#2563EB]">Sistem</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
              Pantau aktivitas pembuatan poster, performa mesin AI, dan status sistem secara langsung.
            </p>
          </div>
        </div>
      </div>

      {/* 2. DASHBOARD MONITORING: 3 METRIC CARDS (Frosted Glass Navy & Amber Accent) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Aktivitas Pengguna */}
        <div className="bg-[#0F172A] text-white backdrop-blur-md rounded-3xl border border-slate-700/80 p-5 shadow-lg hover:shadow-xl transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="text-[10px] font-black uppercase tracking-wider text-[#38BDF8]">
            Aktivitas <span className="text-[#38BDF8]">Pengguna</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1.5 flex items-baseline gap-2">
            540 <span className="text-xs font-semibold text-slate-400 font-normal">Poster Dibuat</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 mt-3 overflow-hidden">
            <div className="h-full w-4/5 bg-gradient-to-r from-[#2563EB] to-[#38BDF8] rounded-full" />
          </div>
        </div>

        {/* Card 2: Kelancaran Sistem */}
        <div className="bg-gradient-to-br from-[#0F172A] via-[#111C38] to-[#1E3A8A] text-white backdrop-blur-md rounded-3xl border border-blue-500/40 p-5 shadow-lg hover:shadow-xl transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400/10 rounded-full blur-2xl pointer-events-none" />
          <div className="text-[10px] font-black uppercase tracking-wider text-[#93C5FD]">
            Kelancaran <span className="text-[#93C5FD]">Sistem</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-xs sm:text-sm font-semibold text-slate-300">Tingkat Sukses</span>
            <span className="text-xl sm:text-2xl font-black text-[#38BDF8] tracking-tight">98.5%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800/90 mt-3 overflow-hidden">
            <div className="h-full w-[98.5%] bg-gradient-to-r from-[#0284C7] to-[#38BDF8] rounded-full" />
          </div>
        </div>

        {/* Card 3: Pemakaian API */}
        <div className="bg-gradient-to-br from-[#0F172A] via-[#1C1917] to-[#451A03]/70 text-white backdrop-blur-md rounded-3xl border border-amber-500/40 p-5 shadow-lg hover:shadow-xl transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
            Pemakaian <span className="text-amber-400">API</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-xs sm:text-sm font-semibold text-slate-300">Estimasi Biaya:</span>
            <span className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight">$14.20</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 mt-3 overflow-hidden">
            <div className="h-full w-2/3 bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full" />
          </div>
        </div>
      </section>

      {/* 3. AKSES CEPAT & STATUS MODUL UTAMA (Ringkas & Efisien) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
          <h2 className="text-base sm:text-lg font-black text-[#0F172A]">
            Akses Cepat &amp; <span className="text-[#2563EB]">Status Sistem</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Pintasan konfigurasi modul admin
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Core Prompt Engine */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-[#BFDBFE] p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB]">
                  <Lock className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1E40AF] border border-blue-200">
                  AES-256-GCM
                </span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  Core Prompt <span className="text-[#2563EB]">Manager</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Master prompt tersimpan aman di vault write-only dengan format placeholder sistem.
                </p>
              </div>
            </div>
            <Link
              to="/admin/core-prompt"
              className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-[#2563EB] text-[#0F172A] hover:text-white border border-slate-200 hover:border-[#2563EB] text-xs font-bold transition-all group"
            >
              <span>Atur Master Prompt</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Card 2: Template & Slot Studio */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-[#BFDBFE] p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0284C7]">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-50 text-[#0369A1] border border-sky-200">
                  Multi-Rasio
                </span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  Template &amp; <span className="text-[#0284C7]">Slot Studio</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Konfigurasi preset rasio (4:5, 1:1, 9:16, 16:9), zona teks aman, dan unggah draf template.
                </p>
              </div>
            </div>
            <Link
              to="/admin/templates"
              className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-[#0284C7] text-[#0F172A] hover:text-white border border-slate-200 hover:border-[#0284C7] text-xs font-bold transition-all group"
            >
              <span>Kelola Template</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Card 3: Library & Kebijakan Konten */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-[#BFDBFE] p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1E40AF]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1E40AF] border border-blue-200">
                  Proteksi Aktif
                </span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  Library &amp; <span className="text-[#1E40AF]">Kebijakan Konten</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Sensor kata terlarang, verifikasi persetujuan UMKM, dan watermark Sukamenak Studio.
                </p>
              </div>
            </div>
            <Link
              to="/admin/policy"
              className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-[#1E40AF] text-[#0F172A] hover:text-white border border-slate-200 hover:border-[#1E40AF] text-xs font-bold transition-all group"
            >
              <span>Atur Kebijakan</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Card 4: Model AI & Alokasi Kuota */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-[#BFDBFE] p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#0F172A]">
                  <Cpu className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-[#0F172A] border border-slate-300">
                  Gemini &amp; Imagen
                </span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  Model AI &amp; <span className="text-[#2563EB]">Batas Kuota</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Pilih mesin default Vision, i2i, t2i serta batasan alokasi kuota harian per akun pengguna.
                </p>
              </div>
            </div>
            <Link
              to="/admin/models"
              className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-[#0F172A] text-[#0F172A] hover:text-white border border-slate-200 hover:border-[#0F172A] text-xs font-bold transition-all group"
            >
              <span>Kelola Model AI</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. TABEL LOG TRACE GENERASI TERBARU */}
      <section className="bg-white rounded-3xl border border-[#BFDBFE] p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0284C7]">
              Audit Pipeline Tanpa Membocorkan Prompt
            </span>
            <h2 className="text-base font-extrabold text-[#0F172A]">
              Log Trace Generasi <span className="text-[#2563EB]">Terbaru</span>
            </h2>
          </div>

          <Link
            to="/admin/logs"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-extrabold shadow-xs transition-colors"
          >
            <span>Lihat Selengkapnya</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#CBD5E1] text-[11px] font-extrabold uppercase text-[#0F172A]">
                <th className="py-2.5 px-3">Jam</th>
                <th className="py-2.5 px-3">ID Pengguna / Unit Usaha</th>
                <th className="py-2.5 px-3">Jalur Mode</th>
                <th className="py-2.5 px-3">Durasi (ms)</th>
                <th className="py-2.5 px-3">Status Pipeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs font-semibold text-[#0F172A]">
              {traceLogs.slice(0, 4).map((log) => (
                <tr key={log.id} className="hover:bg-[#F8FAFC]">
                  <td className="py-2.5 px-3 font-mono text-[11px]">{log.timestamp}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold">{log.creatorName}</div>
                    <div className="text-[11px] text-[#0369A1]">{log.unit}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] uppercase">{log.mode}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px]">{log.latencyMs} ms</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F0F9FF] border border-[#0284C7] text-[#1E40AF] text-[10px] font-extrabold">
                      <CheckCircle2 className="w-3 h-3" />
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
