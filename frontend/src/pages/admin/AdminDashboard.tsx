import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Lock,
  Layers,
  ShieldCheck,
  Cpu,
  CheckCircle2,
  XCircle,
  Activity,
  ArrowRight,
  AlertTriangle,
  Users,
  BookOpen,
} from 'lucide-react';
import { adminGetDashboard, adminListGenerations } from '../../api/admin';
import { queryKeys } from '../../api/queryKeys';
import type { AdminDashboard as DashboardData } from '../../api/types';
import {
  Badge,
  Banner,
  ErrorState,
  LoadingBlock,
  PageHeader,
  SectionCard,
  selectCls,
} from '../../components/admin/ui';
import {
  CAPABILITY_LABELS,
  failureLabel,
  formatDateTime,
  formatDayMonth,
  formatDuration,
  formatNumber,
  formatPercent,
  formatUsd,
  GENERATION_STATUS_LABELS,
} from '../../components/admin/format';

const PERIODS = [7, 30, 90] as const;

/** Stacked daily bars (done + failed) as plain SVG: no chart dependency. */
export const DailyChart: React.FC<{ daily: DashboardData['daily'] }> = ({ daily }) => {
  const max = Math.max(1, ...daily.map((d) => d.generations));
  const W = 600;
  const H = 150;
  const slot = W / Math.max(1, daily.length);
  const barW = Math.max(2, Math.min(24, slot * 0.7));
  const total = daily.reduce((s, d) => s + d.generations, 0);
  const labelAt = new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1]);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H + 22}`}
        role="img"
        aria-label={`Grafik jumlah generasi per hari, ${daily.length} hari, total ${total} generasi`}
        className="w-full h-auto"
      >
        <line x1="0" y1={H} x2={W} y2={H} stroke="#CBD5E1" strokeWidth="1" />
        {daily.map((d, i) => {
          const x = i * slot + (slot - barW) / 2;
          const doneH = (d.done / max) * (H - 8);
          const failedH = (d.failed / max) * (H - 8);
          const otherH = Math.max(0, ((d.generations - d.done - d.failed) / max) * (H - 8));
          return (
            <g key={d.date}>
              <title>{`${d.date}: ${d.generations} generasi (${d.done} selesai, ${d.failed} gagal)`}</title>
              <rect x={x} y={H - doneH} width={barW} height={doneH} rx="2" fill="#2563EB" />
              <rect x={x} y={H - doneH - failedH} width={barW} height={failedH} rx="2" fill="#F59E0B" />
              <rect x={x} y={H - doneH - failedH - otherH} width={barW} height={otherH} rx="2" fill="#94A3B8" />
              {d.generations === 0 && <rect x={x} y={H - 2} width={barW} height={2} fill="#E2E8F0" />}
              {labelAt.has(i) && (
                <text
                  x={i === daily.length - 1 && daily.length > 1 ? Math.min(W, x + barW) : i === 0 ? Math.max(0, x) : x + barW / 2}
                  y={H + 15}
                  textAnchor={i === daily.length - 1 && daily.length > 1 ? 'end' : i === 0 ? 'start' : 'middle'}
                  fontSize="11"
                  fill="#64748B"
                >
                  {formatDayMonth(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 mt-1">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2563EB]" aria-hidden="true" />Selesai</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B]" aria-hidden="true" />Gagal</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#94A3B8]" aria-hidden="true" />Antre / berjalan</span>
        <span className="ml-auto">Puncak harian: {formatNumber(max)} generasi</span>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200">
    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</div>
    <div className="text-lg font-black text-[#0F172A] mt-0.5">{value}</div>
    {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
  </div>
);

export const AdminDashboard: React.FC = () => {
  const [days, setDays] = useState<number>(30);

  const dashboard = useQuery({
    queryKey: queryKeys.admin.dashboard.summary({ days }),
    queryFn: ({ signal }) => adminGetDashboard({ days }, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const recent = useQuery({
    queryKey: queryKeys.admin.generations.list({ limit: 5 }),
    queryFn: ({ signal }) => adminListGenerations({ limit: 5 }, signal),
    staleTime: 60_000,
  });

  const data = dashboard.data;

  return (
    <div className="space-y-6">
      {/* 1. HEADER MENU DASHBOARD OPERATOR */}
      <PageHeader
        icon={<Activity className="w-5 h-5" />}
        title={
          <>
            Pusat Kontrol <span className="text-[#2563EB]">Sistem</span>
          </>
        }
        description="Pantau aktivitas pembuatan poster, performa mesin AI, dan status sistem secara langsung."
        actions={
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
            Periode
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className={`${selectCls} !w-auto !py-1.5`}
              aria-label="Periode statistik"
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p} hari terakhir
                </option>
              ))}
            </select>
          </label>
        }
      />

      {dashboard.isPending && <LoadingBlock label="Memuat statistik..." />}
      {dashboard.isError && !data && <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} title="Statistik tidak dapat dimuat" />}

      {data && (
        <>
          {data.counts.active_admins < 2 && (
            <Banner kind="warning">
              Peringatan: hanya {data.counts.active_admins} admin aktif. Sistem menolak penghapusan atau penonaktifan admin terakhir, tetapi sebaiknya
              ada minimal 2 admin aktif agar akses tidak terkunci.{' '}
              <Link to="/admin/users" className="underline">
                Kelola pengguna
              </Link>
            </Banner>
          )}

          {/* 2. DASHBOARD MONITORING: 3 METRIC CARDS */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-5" aria-label="Ringkasan utama">
            {/* Card 1: Aktivitas Pengguna */}
            <div className="bg-[#0F172A] text-white backdrop-blur-md rounded-3xl border border-slate-700/80 p-5 shadow-lg hover:shadow-xl transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="text-[10px] font-black uppercase tracking-wider text-[#38BDF8]">
                Aktivitas <span className="text-[#38BDF8]">Pengguna</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1.5 flex items-baseline gap-2">
                {formatNumber(data.totals.generations)} <span className="text-xs font-semibold text-slate-400 font-normal">Poster Dibuat</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{formatNumber(data.totals.active_users)} pengguna aktif dalam {data.window.days} hari</div>
              <div className="w-full h-2 rounded-full bg-slate-800 mt-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] rounded-full"
                  style={{ width: `${data.totals.generations ? (data.totals.done / data.totals.generations) * 100 : 0}%` }}
                />
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
                <span className="text-xl sm:text-2xl font-black text-[#38BDF8] tracking-tight">{formatPercent(data.totals.success_rate)}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {formatNumber(data.totals.done)} selesai &bull; {formatNumber(data.totals.failed)} gagal &bull; {formatNumber(data.totals.in_progress)} berjalan
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800/90 mt-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#0284C7] to-[#38BDF8] rounded-full"
                  style={{ width: `${(data.totals.success_rate ?? 0) * 100}%` }}
                />
              </div>
            </div>

            {/* Card 3: Pemakaian API */}
            <div className="bg-gradient-to-br from-[#0F172A] via-[#1C1917] to-[#451A03]/70 text-white backdrop-blur-md rounded-3xl border border-amber-500/40 p-5 shadow-lg hover:shadow-xl transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Pemakaian <span className="text-amber-400">API</span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <span className="text-xs sm:text-sm font-semibold text-slate-300">Total Biaya:</span>
                <span className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight">{formatUsd(data.totals.total_cost_usd, 2)}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Rata-rata {formatUsd(data.totals.avg_cost_usd, 4)} per generasi</div>
              <div className="w-full h-2 rounded-full bg-slate-800 mt-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full"
                  style={{ width: `${(data.totals.degraded_rate ?? 0) * 100}%` }}
                  title="Porsi generasi terdegradasi"
                />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" aria-label="Metrik tambahan">
            <Stat label="Rata-rata durasi" value={formatDuration(data.totals.avg_duration_ms)} />
            <Stat label="Pakai foto referensi" value={formatPercent(data.totals.used_reference_image_rate)} hint="dari generasi selesai" />
            <Stat label="Terdegradasi" value={formatPercent(data.totals.degraded_rate)} hint="dari semua generasi" />
            <Stat label="Pengguna aktif" value={formatNumber(data.totals.active_users)} />
            <Stat label="Template terbit" value={formatNumber(data.counts.published_templates)} />
            <Stat label="Tutorial terbit" value={formatNumber(data.counts.published_tutorials)} />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <SectionCard
              className="lg:col-span-8"
              title={
                <>
                  Generasi per Hari <span className="text-[#2563EB]">({data.window.days} hari)</span>
                </>
              }
              subtitle={`Zona waktu ${data.window.timezone}`}
            >
              <DailyChart daily={data.daily} />
            </SectionCard>

            <SectionCard className="lg:col-span-4" title="Penyebab Kegagalan" subtitle="Per kode galat pada periode ini">
              {data.failures_by_error_code.length === 0 ? (
                <p className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Tidak ada generasi gagal pada periode ini.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {data.failures_by_error_code.map((f) => {
                    const top = data.failures_by_error_code[0].count || 1;
                    return (
                      <li key={f.error_code}>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-[#0F172A]">{failureLabel(f.error_code)}</span>
                          <span className="font-mono font-bold text-amber-700">{f.count}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">{f.error_code}</div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(f.count / top) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          </div>

          <SectionCard title={<>Status Model <span className="text-[#2563EB]">per Kemampuan</span></>} subtitle="Model default yang dipakai generasi berikutnya dan hasil uji koneksi terakhir">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.models.map((m) => (
                <div key={m.capability} className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-[#0284C7]">{CAPABILITY_LABELS[m.capability]}</div>
                  {m.default ? (
                    <>
                      <div className="text-sm font-extrabold text-[#0F172A] leading-snug">{m.default.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 break-all">
                        {m.default.provider} &bull; {m.default.model_id}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="blue">{m.active_count} aktif</Badge>
                        {m.default.last_test_ok === true && (
                          <Badge tone="green">
                            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                            Uji OK
                          </Badge>
                        )}
                        {m.default.last_test_ok === false && (
                          <Badge tone="red">
                            <XCircle className="w-3 h-3" aria-hidden="true" />
                            Uji gagal
                          </Badge>
                        )}
                        {m.default.last_test_ok === null && <Badge tone="slate">Belum diuji</Badge>}
                      </div>
                      {m.default.last_test_at && <div className="text-[11px] text-slate-500">Uji terakhir: {formatDateTime(m.default.last_test_at)}</div>}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
                        <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                        Belum ada model default
                      </div>
                      <Link to="/admin/models" className="text-[11px] font-bold text-[#2563EB] underline">
                        Atur di Model LLM
                      </Link>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <Stat label="Admin aktif" value={formatNumber(data.counts.active_admins)} />
              <Stat label="Kreator aktif" value={formatNumber(data.counts.active_creators)} />
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-600 col-span-2">
                <Users className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                <BookOpen className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                Jumlah di atas dihitung dari akun dan konten yang berstatus aktif / terbit.
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {/* 3. AKSES CEPAT & STATUS MODUL UTAMA (Ringkas & Efisien) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
          <h2 className="text-base sm:text-lg font-black text-[#0F172A]">
            Akses Cepat &amp; <span className="text-[#2563EB]">Status Sistem</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">Pintasan konfigurasi modul admin</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Core Prompt Engine */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-[#BFDBFE] p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB]">
                  <Lock className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1E40AF] border border-blue-200">AES-256-GCM</span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  Core Prompt <span className="text-[#2563EB]">Manager</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Master prompt tersimpan aman di vault write-only dengan format placeholder sistem.</p>
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
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-50 text-[#0369A1] border border-sky-200">Multi-Rasio</span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  Template &amp; <span className="text-[#0284C7]">Slot Studio</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Konfigurasi preset rasio (4:5, 1:1, 9:16, 16:9), zona teks aman, dan unggah draf template.</p>
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
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1E40AF] border border-blue-200">Proteksi Aktif</span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  Library &amp; <span className="text-[#1E40AF]">Kebijakan Konten</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Sensor kata terlarang, verifikasi persetujuan UMKM, dan watermark Sukamenak Studio.</p>
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
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-[#0F172A] border border-slate-300">Vision &bull; Text &bull; T2I &bull; I2I</span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  Model AI &amp; <span className="text-[#2563EB]">Batas Kuota</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Pilih mesin default Vision, i2i, t2i serta batasan alokasi kuota harian per akun pengguna.</p>
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
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0284C7]">Audit Pipeline Tanpa Membocorkan Prompt</span>
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

        {recent.isPending && <LoadingBlock label="Memuat log terbaru..." className="!py-6" />}
        {recent.isError && <ErrorState error={recent.error} onRetry={() => void recent.refetch()} title="Log tidak dapat dimuat" />}
        {recent.data && recent.data.items.length === 0 && <p className="text-xs text-slate-500 py-4 text-center">Belum ada generasi tercatat.</p>}
        {recent.data && recent.data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#CBD5E1] text-[11px] font-extrabold uppercase text-[#0F172A]">
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Pengguna / Template</th>
                  <th className="py-2.5 px-3">Jalur Mode</th>
                  <th className="py-2.5 px-3">Durasi</th>
                  <th className="py-2.5 px-3">Status Pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-xs font-semibold text-[#0F172A]">
                {recent.data.items.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-3 font-mono text-[11px]">{formatDateTime(log.created_at)}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold">{log.user?.name ?? 'Akun dihapus'}</div>
                      <div className="text-[11px] text-[#0369A1]">{log.template?.name ?? '-'}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] uppercase">{log.mode}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">{formatDuration(log.duration_ms)}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold ${
                          log.status === 'failed'
                            ? 'bg-red-50 border-red-300 text-red-700'
                            : log.status === 'done'
                              ? 'bg-[#F0F9FF] border-[#0284C7] text-[#1E40AF]'
                              : 'bg-slate-50 border-slate-300 text-slate-600'
                        }`}
                      >
                        {log.status === 'failed' ? <XCircle className="w-3 h-3" aria-hidden="true" /> : <CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
                        {GENERATION_STATUS_LABELS[log.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
