import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogoIcon } from '../components/common/Logo';
import {
  Activity,
  Users,
  Camera,
  Wand2,
  Sparkles,
  Clock,
  BookOpen,
  Sun,
  Palette,
  Copy,
  Zap,
  Cpu,
  ShieldAlert,
  Layers,
  FolderArchive,
  Award,
  Terminal,
  FileCheck,
  Sliders,
  User,
  Search,
  CheckCircle2,
  Download,
  ArrowRight,
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  RotateCw,
  Power,
  Check,
  MoreVertical,
  Eye,
  KeyRound,
  Mail,
  Phone,
  Lock,
  MessageCircle,
  Instagram,
  Upload,
  RotateCcw,
  UserX,
} from 'lucide-react';

export const PresentationBoard: React.FC = () => {
  const [workspaceView, setWorkspaceView] = useState<'creator' | 'admin'>('creator');
  const [boardSection, setBoardSection] = useState<'all' | 'dashboard' | 'users' | 'models' | 'templates' | 'references' | 'logs' | 'settings' | 'profile'>('all');
  const [usersFilter, setUsersFilter] = useState<'Semua' | 'Aktif' | 'Mendekati Limit' | 'Nonaktif'>('Semua');
  const [selectedModel, setSelectedModel] = useState('m1');

  const adminMenus = [
    { id: 'dashboard', label: 'Dashboard Analitik', icon: Activity },
    { id: 'users', label: 'Manajemen Pengguna', icon: Users },
    { id: 'models', label: 'Model LLM', icon: Cpu },
    { id: 'core-prompt', label: 'Core Prompt Engine', icon: ShieldAlert },
    { id: 'templates', label: 'Template & Slot', icon: Layers },
    { id: 'references', label: 'Library Referensi', icon: FolderArchive },
    { id: 'curation', label: 'Kurasi Galeri', icon: Award },
    { id: 'logs', label: 'Log & Trace Generasi', icon: Terminal },
    { id: 'policy', label: 'Content Policy', icon: FileCheck },
    { id: 'settings', label: 'Pengaturan Global', icon: Sliders },
    { id: 'profile', label: 'Profil Admin', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#0F172A] p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#2563EB] selection:text-white">
      
      {/* ═══════════════════════════════════════════════════════════════════
          SHOWCASE BOARD HEADER BAR (Figma & Dribbble 16:9 Standard)
      ═══════════════════════════════════════════════════════════════════ */}
      <header className="max-w-[1800px] mx-auto mb-6 bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <LogoIcon className="w-11 h-11" color="#2563EB" />
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight">
                Sukamenak Studio — Revised Admin Workspace Showcase
              </h1>
              <span className="px-3 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-[11px] font-black uppercase tracking-wider">
                16:9 Ultra-HD • 8K Standard
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5 font-normal">
              Enterprise Frosted Glassmorphism Design System &bull; Strict Palette: Royal Blue (#2563EB), Slate Navy (#0F172A), Light Slate (#F8FAFC)
            </p>
          </div>
        </div>

        {/* Section Navigation Tabs & Live Web Links */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <div className="bg-[#F8FAFC] border border-slate-200 rounded-full p-1 flex items-center gap-1">
            {[
              { id: 'all', label: 'Semua Section' },
              { id: 'dashboard', label: 'A: Dashboard' },
              { id: 'users', label: 'B: Pengguna' },
              { id: 'models', label: 'C: Model LLM' },
              { id: 'templates', label: 'D: Template' },
              { id: 'references', label: 'E: Referensi' },
              { id: 'logs', label: 'F: Log Trace' },
              { id: 'profile', label: 'G: Profil Admin' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setBoardSection(tab.id as any)}
                className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  boardSection === tab.id
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#2563EB]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Link
            to="/admin/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-extrabold shadow-sm transition-colors"
          >
            <span>Buka Admin Live</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN WORKSPACE DESKTOP SHELL (Realistic 16:9 Frame)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="max-w-[1800px] mx-auto bg-white rounded-[2.5rem] border border-slate-300 shadow-2xl overflow-hidden flex flex-col min-h-[92vh]">
        
        {/* Desktop Browser OS Titlebar */}
        <div className="bg-[#0F172A] px-6 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
            <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
            <span className="w-3 h-3 rounded-full bg-[#3B82F6]" />
            <span className="ml-3 text-xs font-semibold text-slate-400">
              Sukamenak Studio Admin Workspace &bull; 8K Figma Board Mockup
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-6 py-1 rounded-full bg-slate-900 border border-slate-700 text-[11px] text-slate-300 font-mono">
            <span className="text-[#38BDF8]">https://</span>sukamenak.studio/admin/dashboard
          </div>
          <div className="text-xs font-bold text-slate-400">
            Frosted Glassmorphism System
          </div>
        </div>

        {/* 1. UNIFIED MINIMALIST TOP NAVBAR */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#CBD5E1] px-8 h-18 flex items-center justify-between shadow-2xs">
          {/* Left: Sleek 'Sukamenak Studio' wordmark with crisp Royal Blue emblem glyph */}
          <div className="flex items-center gap-3 select-none">
            <LogoIcon className="w-9 h-9" color="#2563EB" />
            <div className="leading-tight">
              <span className="font-black text-xl tracking-tight text-[#0F172A]">
                Sukamenak <span className="text-[#2563EB]">Studio</span>
              </span>
            </div>
          </div>

          {/* Middle: Spacious and completely clean (Strictly NO search bar, NO quota badges) */}
          <div className="flex-1" />

          {/* Right: Admin profile capsule showing avatar circle 'A' and label "Admin Operasional" */}
          <div className="flex items-center gap-2.5 pl-2 pr-4 py-1.5 rounded-full bg-white border border-[#CBD5E1] shadow-xs">
            <div className="w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-xs font-black">
              A
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#0F172A]">
              Admin Operasional
            </span>
          </div>
        </header>

        {/* Workspace Body: Dock & Content */}
        <div className="flex-1 flex bg-[#F8FAFC]">
          
          {/* 2. EXPANDED ADMIN SIDEBAR NAVIGATION (LEFT DOCK - 11 DEDICATED MENUS) */}
          <aside className="w-64 shrink-0 bg-white border-r border-[#CBD5E1] py-6 px-3.5 hidden lg:flex flex-col justify-between">
            <div className="space-y-1">
              {adminMenus.slice(0, 10).map((menu, idx) => {
                const Icon = menu.icon;
                const isActive = boardSection === 'all' ? idx === 0 : boardSection === menu.id;
                return (
                  <button
                    key={menu.id}
                    type="button"
                    onClick={() => setBoardSection(menu.id as any)}
                    className={`w-full h-11 px-3.5 rounded-xl flex items-center gap-3 text-xs sm:text-sm font-bold transition-all select-none cursor-pointer text-left ${
                      isActive
                        ? 'bg-[#2563EB] text-white shadow-md shadow-blue-600/25'
                        : 'text-slate-600 hover:bg-[#EFF6FF] hover:text-[#2563EB]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{menu.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Item 11: Profil Admin (Distinct profile setting at lower dock above logout) */}
            <div className="pt-3 border-t border-slate-100 space-y-1">
              <button
                type="button"
                onClick={() => setBoardSection('profile')}
                className={`w-full h-11 px-3.5 rounded-xl flex items-center gap-3 text-xs sm:text-sm font-bold transition-all select-none cursor-pointer text-left ${
                  boardSection === 'profile'
                    ? 'bg-[#2563EB] text-white shadow-md shadow-blue-600/25'
                    : 'text-slate-600 hover:bg-[#EFF6FF] hover:text-[#2563EB]'
                }`}
              >
                <User className={`w-4 h-4 flex-shrink-0 ${boardSection === 'profile' ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">Profil Admin</span>
              </button>

              <div className="px-3.5 py-2 text-[10px] text-slate-400 font-mono">
                Sistem v2.6.4 &bull; AES-256
              </div>
            </div>
          </aside>

          {/* Main Showcase Canvas */}
          <main className="flex-1 min-w-0 p-6 lg:p-8 space-y-10">
            
            {/* ─────────────────────────────────────────────────────────────
                SECTION A: DASHBOARD ANALITIK (/admin/dashboard)
            ───────────────────────────────────────────────────────────── */}
            {(boardSection === 'all' || boardSection === 'dashboard') && (
              <section className="space-y-6">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#2563EB] text-white text-[10px] font-black uppercase">
                      SECTION A
                    </span>
                    <h2 className="text-lg font-black text-[#0F172A]">
                      Dashboard Analitik &bull; /admin/dashboard
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Live Monitoring</span>
                </div>

                {/* Hero Banner: Frosted glass container */}
                <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
                  <h3 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
                    Pusat Kontrol Sistem
                  </h3>
                  <p className="text-xs sm:text-sm text-[#475569] mt-1 font-normal max-w-2xl leading-relaxed">
                    Pantau aktivitas pembuatan poster, performa mesin AI, dan status sistem secara langsung.
                  </p>
                </div>

                {/* 3 Summary Metrics (Frosted Glass Navy & Amber Accent) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-[#0F172A] text-white backdrop-blur-md rounded-3xl border border-slate-700/80 p-5 shadow-lg relative overflow-hidden">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#38BDF8] block">
                      Aktivitas Pengguna
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-white mt-1.5 flex items-baseline gap-2">
                      540 <span className="text-xs font-semibold text-slate-400 font-normal">Poster Dibuat</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 mt-3 overflow-hidden">
                      <div className="h-full w-4/5 bg-gradient-to-r from-[#2563EB] to-[#38BDF8] rounded-full" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-[#0F172A] via-[#111C38] to-[#1E3A8A] text-white backdrop-blur-md rounded-3xl border border-blue-500/40 p-5 shadow-lg relative overflow-hidden">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#93C5FD] block">
                      Kelancaran Sistem
                    </span>
                    <div className="mt-1.5 flex items-baseline justify-between gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-slate-300">Tingkat Sukses</span>
                      <span className="text-xl sm:text-2xl font-black text-[#38BDF8] tracking-tight">98.5%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800/90 mt-3 overflow-hidden">
                      <div className="h-full w-[98.5%] bg-gradient-to-r from-[#0284C7] to-[#38BDF8] rounded-full" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-[#0F172A] via-[#1C1917] to-[#451A03]/70 text-white backdrop-blur-md rounded-3xl border border-amber-500/40 p-5 shadow-lg relative overflow-hidden">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                      Pemakaian API
                    </span>
                    <div className="mt-1.5 flex items-baseline justify-between gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-slate-300">Estimasi Biaya:</span>
                      <span className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight">$14.20</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 mt-3 overflow-hidden">
                      <div className="h-full w-2/3 bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Quick Status Panels */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                        <Lock className="w-4 h-4 text-[#2563EB]" />
                        <span>Status Core Engine</span>
                      </h4>
                      <span className="px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 text-[10px] font-black">
                        ENCRYPTED AES-256
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Master Prompt diamankan dalam mode Write-Only. Injeksi variabel judul dan vision dilakukan aman di layer komputasi.
                    </p>
                  </div>

                  <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                        <Activity className="w-4 h-4 text-[#2563EB]" />
                        <span>Aktivitas Pipeline Terbaru</span>
                      </h4>
                      <span className="px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 text-[10px] font-black uppercase">
                        SUCCESS
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Render terakhir: Keripik Tempe Bu Cantika (3.8s) &bull; Vision Analysis &rarr; Compose &rarr; Output 4:5 HD selesai tanpa eror.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* ─────────────────────────────────────────────────────────────
                SECTION B: MANAJEMEN PENGGUNA (/admin/users - TABLE VIEW)
            ───────────────────────────────────────────────────────────── */}
            {(boardSection === 'all' || boardSection === 'users') && (
              <section className="space-y-6">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#2563EB] text-white text-[10px] font-black uppercase">
                      SECTION B
                    </span>
                    <h2 className="text-lg font-black text-[#0F172A]">
                      Manajemen Pengguna &bull; /admin/users (Revised Table Standard)
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">High-Density Table</span>
                </div>

                {/* Top Control Bar */}
                <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      readOnly
                      value="Cantika Anggi"
                      placeholder="Cari nama pengguna, merek usaha, atau email..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A]"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {(['Semua', 'Aktif', 'Mendekati Limit', 'Nonaktif'] as const).map((pill) => (
                      <button
                        key={pill}
                        type="button"
                        onClick={() => setUsersFilter(pill)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                          usersFilter === pill
                            ? 'bg-[#2563EB] text-white shadow-xs'
                            : 'bg-[#F8FAFC] text-slate-600 border border-slate-200'
                        }`}
                      >
                        {pill}
                      </button>
                    ))}
                  </div>
                </div>

                {/* High-Density Compact Data Table (Tabel Dikecilin Dikit) */}
                <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-bold">
                          <th className="py-3 px-4.5">Pengguna &amp; Usaha</th>
                          <th className="py-3 px-4.5">Kontak</th>
                          <th className="py-3 px-4.5">Kuota Harian</th>
                          <th className="py-3 px-4.5">Status Akun</th>
                          <th className="py-3 px-4.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr className="hover:bg-blue-50/20 transition-colors">
                          <td className="py-2.5 px-4.5">
                            <div className="font-extrabold text-[#0F172A] text-xs sm:text-sm">Cantika Anggi</div>
                            <div className="text-[11px] font-bold text-[#2563EB]">Keripik Tempe Bu Cantika</div>
                          </td>
                          <td className="py-2.5 px-4.5">
                            <div className="text-slate-700 font-medium">cantika.anggi@gmail.com</div>
                            <div className="text-[11px] text-slate-500 font-mono">+62 812-3456-7890</div>
                          </td>
                          <td className="py-2.5 px-4.5 min-w-[150px]">
                            <div className="flex justify-between text-xs mb-1 font-bold">
                              <span>12 / 15</span>
                              <span className="text-[10px] text-slate-400">80%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full w-4/5 bg-[#2563EB] rounded-full" />
                            </div>
                          </td>
                          <td className="py-2.5 px-4.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-blue-50 text-[#2563EB] border border-[#BFDBFE]">
                              AKTIF
                            </span>
                          </td>
                          <td className="py-2.5 px-4.5 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-[#EFF6FF] text-slate-700 hover:text-[#2563EB] border border-slate-200 text-xs font-bold transition-all shadow-2xs"
                                title="Reset Kuota Harian"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-[#2563EB]" />
                                <span>Reset</span>
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 text-xs font-bold transition-all shadow-2xs"
                                title="Nonaktifkan Akun"
                              >
                                <UserX className="w-3.5 h-3.5 text-red-500" />
                                <span>Nonaktifkan</span>
                              </button>
                            </div>
                          </td>
                        </tr>

                        <tr className="hover:bg-blue-50/20 transition-colors">
                          <td className="py-2.5 px-4.5">
                            <div className="font-extrabold text-[#0F172A] text-xs sm:text-sm">Hendra Gunawan</div>
                            <div className="text-[11px] font-bold text-[#2563EB]">Kopi Robusta Puntang Single Origin</div>
                          </td>
                          <td className="py-2.5 px-4.5">
                            <div className="text-slate-700 font-medium">hendra.kopi@sukamenak.org</div>
                            <div className="text-[11px] text-slate-500 font-mono">+62 813-9876-5432</div>
                          </td>
                          <td className="py-2.5 px-4.5 min-w-[150px]">
                            <div className="flex justify-between text-xs mb-1 font-bold">
                              <span>8 / 15</span>
                              <span className="text-[10px] text-slate-400">53%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full w-[53%] bg-[#2563EB] rounded-full" />
                            </div>
                          </td>
                          <td className="py-2.5 px-4.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-blue-50 text-[#2563EB] border border-[#BFDBFE]">
                              AKTIF
                            </span>
                          </td>
                          <td className="py-2.5 px-4.5 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-[#EFF6FF] text-slate-700 hover:text-[#2563EB] border border-slate-200 text-xs font-bold transition-all shadow-2xs"
                                title="Reset Kuota Harian"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-[#2563EB]" />
                                <span>Reset</span>
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 text-xs font-bold transition-all shadow-2xs"
                                title="Nonaktifkan Akun"
                              >
                                <UserX className="w-3.5 h-3.5 text-red-500" />
                                <span>Nonaktifkan</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* ─────────────────────────────────────────────────────────────
                SECTION C: MODEL LLM MANAGEMENT (/admin/models)
            ───────────────────────────────────────────────────────────── */}
            {(boardSection === 'all' || boardSection === 'models') && (
              <section className="space-y-6">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#2563EB] text-white text-[10px] font-black uppercase">
                      SECTION C
                    </span>
                    <h2 className="text-lg font-black text-[#0F172A]">
                      Model LLM Management &bull; /admin/models (Pure Monitoring View)
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">No forms or coordinate grids</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Card 1: Gemini 2.5 Flash Vision + Imagen 3 */}
                  <div className="bg-white/95 rounded-3xl border-2 border-[#2563EB] p-6 shadow-md shadow-blue-500/10 space-y-5 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-500 font-bold uppercase">Google Vertex AI</span>
                        <span className="px-3 py-1 rounded-full bg-[#2563EB] text-white text-[10px] font-black uppercase tracking-wider">
                          DEFAULT AKTIF
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-[#0F172A]">Gemini 2.5 Flash Vision + Imagen 3</h3>
                      <p className="text-xs text-[#475569] leading-relaxed">
                        Analisis vision foto produk &amp; render poster resolusi tinggi rasio 4:5.
                      </p>
                      <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between"><span>Latensi:</span><strong className="text-[#0F172A]">3.8s</strong></div>
                        <div className="flex justify-between"><span>Cost:</span><strong className="text-[#2563EB]">$0.025 / render</strong></div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex gap-2">
                      <button type="button" className="flex-1 py-2 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">Uji Koneksi</button>
                      <button type="button" className="px-4 py-2 rounded-full bg-slate-100 text-slate-400 text-xs font-bold" disabled>Nonaktifkan</button>
                    </div>
                  </div>

                  {/* Card 2: Flux.1 Dev ControlNet i2i */}
                  <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-6 space-y-5 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-500 font-bold uppercase">Black Forest Labs</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 text-[10px] font-black uppercase">
                          SIAGA
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-[#0F172A]">Flux.1 Dev ControlNet i2i</h3>
                      <p className="text-xs text-[#475569] leading-relaxed">
                        Preservasi kontur kemasan produk &amp; penyesuaian lighting presisi studio.
                      </p>
                      <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between"><span>Latensi:</span><strong className="text-[#0F172A]">4.6s</strong></div>
                        <div className="flex justify-between"><span>Cost:</span><strong className="text-[#2563EB]">$0.030 / render</strong></div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <button type="button" className="w-full py-2 rounded-full bg-[#2563EB] text-white text-xs font-bold">Jadikan Default</button>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" className="py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">Uji Koneksi</button>
                        <button type="button" className="py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">Nonaktifkan</button>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: SDXL Lightning */}
                  <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-6 space-y-5 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-500 font-bold uppercase">Stability AI</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 text-[10px] font-black uppercase">
                          SIAGA
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-[#0F172A]">SDXL Lightning</h3>
                      <p className="text-xs text-[#475569] leading-relaxed">
                        Generasi visual kilat 4-step untuk mode draf teks cepat.
                      </p>
                      <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between"><span>Latensi:</span><strong className="text-[#0F172A]">1.9s</strong></div>
                        <div className="flex justify-between"><span>Cost:</span><strong className="text-[#2563EB]">$0.012 / render</strong></div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <button type="button" className="w-full py-2 rounded-full bg-[#2563EB] text-white text-xs font-bold">Jadikan Default</button>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" className="py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">Uji Koneksi</button>
                        <button type="button" className="py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">Nonaktifkan</button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ─────────────────────────────────────────────────────────────
                SECTION D: TEMPLATE & SLOT MANAGEMENT (/admin/templates)
            ───────────────────────────────────────────────────────────── */}
            {(boardSection === 'all' || boardSection === 'templates') && (
              <section className="space-y-6">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#2563EB] text-white text-[10px] font-black uppercase">
                      SECTION D
                    </span>
                    <h2 className="text-lg font-black text-[#0F172A]">
                      Template &amp; Slot Management &bull; /admin/templates (Zero-Cropping 4:5 Cards)
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Creation Drawer Support</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { id: 't1', title: 'Keripik Tempe Gurih Daun Jeruk', cat: 'Kuliner UMKM', img: '/posters/poster-keripik.jpg', zone: 'Top Header + Bottom CTA' },
                    { id: 't2', title: 'Kopi Robusta Puntang Single Origin', cat: 'Katalog Produk', img: '/posters/poster-kopi.jpg', zone: 'Bottom Card Overlay' },
                    { id: 't3', title: 'Bazar Sembako Murah UMKM', cat: 'Promo Komersial', img: '/posters/poster-bazar.jpg', zone: 'Split Editorial Frame' },
                    { id: 't4', title: 'Kue Basah & Jajanan Tradisional', cat: 'Kuliner UMKM', img: '/posters/poster-kue.jpg', zone: 'Top Header + Bottom CTA' },
                  ].map((tpl) => (
                    <div key={tpl.id} className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-4 shadow-xs space-y-3.5 flex flex-col justify-between">
                      <div>
                        {/* Perfect 4:5 Zero-Cropping Canvas */}
                        <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 border border-slate-100 mb-3">
                          <img src={tpl.img} alt={tpl.title} className="w-full h-full object-cover" />
                          <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-white/95 text-[10px] font-black text-[#2563EB] shadow-xs">
                            {tpl.cat}
                          </span>
                          <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/60 text-[9px] font-bold text-white">
                            {tpl.zone}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-[#0F172A] line-clamp-1">{tpl.title}</h4>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2563EB] text-[11px] font-bold">Status: Aktif</span>
                        <div className="flex items-center gap-1">
                          <button type="button" className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button type="button" className="p-1.5 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ─────────────────────────────────────────────────────────────
                SECTION E: BANK REFERENSI VISUAL (/admin/references)
            ───────────────────────────────────────────────────────────── */}
            {(boardSection === 'all' || boardSection === 'references') && (
              <section className="space-y-6">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#2563EB] text-white text-[10px] font-black uppercase">
                      SECTION E
                    </span>
                    <h2 className="text-lg font-black text-[#0F172A]">
                      Bank Referensi Visual &bull; /admin/references
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Uncropped 4:5 Asset Library</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { id: 'r1', title: 'Keripik Tempe Iris Renyah', owner: 'Cantika Anggi', img: '/posters/poster-keripik.jpg', cat: 'Kuliner' },
                    { id: 'r2', title: 'Biji Kopi Panggang Puntang', owner: 'Hendra Gunawan', img: '/posters/poster-kopi.jpg', cat: 'Komoditas' },
                    { id: 'r3', title: 'Bazar Sembako Balai Warga', owner: 'Komunitas Warga', img: '/posters/poster-bazar.jpg', cat: 'Kegiatan' },
                    { id: 'r4', title: 'Jajanan Pasar Tradisional', owner: 'Warsinah', img: '/posters/poster-kue.jpg', cat: 'Kuliner' },
                  ].map((ref) => (
                    <div key={ref.id} className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-4 shadow-xs space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 border border-slate-100 mb-3">
                          <img src={ref.img} alt={ref.title} className="w-full h-full object-cover" />
                          <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-white/95 text-[10px] font-black text-[#2563EB]">
                            {ref.cat}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-[#0F172A] line-clamp-1">{ref.title}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Kontributor: <strong>{ref.owner}</strong></p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 text-[11px] text-[#2563EB] font-bold">
                        Resolusi HD Terverifikasi
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ─────────────────────────────────────────────────────────────
                SECTION F: LOG & TRACE GENERASI (/admin/logs)
            ───────────────────────────────────────────────────────────── */}
            {(boardSection === 'all' || boardSection === 'logs') && (
              <section className="space-y-6">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#2563EB] text-white text-[10px] font-black uppercase">
                      SECTION F
                    </span>
                    <h2 className="text-lg font-black text-[#0F172A]">
                      Log &amp; Trace Generasi &bull; /admin/logs (Enterprise Audit Table)
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Real-time Telemetry</span>
                </div>

                <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-bold">
                        <th className="py-4 px-6">Waktu Eksekusi</th>
                        <th className="py-4 px-6">Pengguna / Merek Usaha</th>
                        <th className="py-4 px-6">Mode Pipeline</th>
                        <th className="py-4 px-6">Durasi (ms)</th>
                        <th className="py-4 px-6">Status Engine</th>
                        <th className="py-4 px-6 text-right">Detail Trace</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal">
                      <tr className="hover:bg-blue-50/30">
                        <td className="py-4 px-6 font-mono text-slate-500 text-xs">14:20:18</td>
                        <td className="py-4 px-6 font-extrabold text-[#0F172A]">Cantika Anggi &bull; Keripik Tempe</td>
                        <td className="py-4 px-6"><span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2563EB] font-bold text-xs">I2I</span></td>
                        <td className="py-4 px-6 font-mono font-bold">4210 ms</td>
                        <td className="py-4 px-6"><span className="px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 text-[10px] font-black">SUCCESS</span></td>
                        <td className="py-4 px-6 text-right"><span className="text-xs font-bold text-[#2563EB] cursor-pointer">Lihat Trace &rarr;</span></td>
                      </tr>
                      <tr className="hover:bg-blue-50/30">
                        <td className="py-4 px-6 font-mono text-slate-500 text-xs">12:05:40</td>
                        <td className="py-4 px-6 font-extrabold text-[#0F172A]">Hendra Gunawan &bull; Kopi Puntang</td>
                        <td className="py-4 px-6"><span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-[#0284C7] font-bold text-xs">T2I</span></td>
                        <td className="py-4 px-6 font-mono font-bold">3820 ms</td>
                        <td className="py-4 px-6"><span className="px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 text-[10px] font-black">SUCCESS</span></td>
                        <td className="py-4 px-6 text-right"><span className="text-xs font-bold text-[#2563EB] cursor-pointer">Lihat Trace &rarr;</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

                        {/* ─────────────────────────────────────────────────────────────
                SECTION I: PENGATURAN GLOBAL (/admin/settings)
            ───────────────────────────────────────────────────────────── */}
            {(boardSection === 'all' || boardSection === 'settings') && (
              <section className="space-y-6">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#2563EB] text-white text-[10px] font-black uppercase">
                      SECTION I
                    </span>
                    <h2 className="text-lg font-black text-[#0F172A]">
                      Pengaturan Global &amp; Konten Studio &bull; /admin/settings
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Two-Column CMS Workbench</span>
                </div>

                {/* Banner & Tab Bar */}
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/25">
                        <Sliders className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-[#0F172A]">
                          Pengaturan Global &amp; <span className="text-[#2563EB]">Konten Studio</span>
                        </h3>
                        <p className="text-xs text-[#475569] mt-0.5">
                          Sesuaikan teks landing page, kebijakan penggunaan sistem, dan identitas resmi studio secara langsung.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Segmented Frosted Glass Tab Bar */}
                  <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-[#BFDBFE] p-1.5 shadow-xs flex items-center gap-1.5 max-w-xl">
                    <button className="flex-1 py-2 px-3.5 rounded-xl text-xs font-black bg-[#2563EB] text-white shadow-xs flex items-center justify-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Konten Landing Page</span>
                    </button>
                    <button className="flex-1 py-2 px-3.5 rounded-xl text-xs font-bold text-slate-600 hover:text-[#0F172A] flex items-center justify-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                      <span>Kebijakan &amp; Kuota</span>
                    </button>
                    <button className="flex-1 py-2 px-3.5 rounded-xl text-xs font-bold text-slate-600 hover:text-[#0F172A] flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                      <span>Identitas Studio</span>
                    </button>
                  </div>
                </div>

                {/* CMS Editor Form (Full Width) */}
                <div className="space-y-5 max-w-4xl">
                    {/* Card A: Hero Section */}
                    <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center text-xs font-black">A</span>
                          <h4 className="text-xs font-black text-[#0F172A]">Seksi Utama (Hero Section)</h4>
                        </div>
                        <span className="text-[10px] text-slate-400">Header Landing Page</span>
                      </div>
                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="font-bold text-[#0F172A] block mb-1">Judul Utama (Headline)</label>
                          <input type="text" readOnly value="Generator Konten AI Instan Sukamenak Studio" className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 font-bold text-[#0F172A]" />
                        </div>
                        <div>
                          <label className="font-bold text-[#0F172A] block mb-1">Sub-judul Ajakan</label>
                          <textarea rows={2} readOnly value="Solusi cepat dan praktis untuk seluruh pelaku UMKM Sukamenak dalam menciptakan materi promosi digital profesional." className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#0F172A] leading-relaxed" />
                        </div>
                        <div>
                          <label className="font-bold text-[#0F172A] block mb-1">Teks Tombol Aksi (CTA)</label>
                          <div className="flex gap-2">
                            <input type="text" readOnly value="Mulai Buat Poster" className="flex-1 px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 font-bold text-[#0F172A]" />
                            <div className="px-3 py-2 rounded-xl bg-[#2563EB] text-white text-[11px] font-bold flex items-center gap-1">
                              <span>Mulai Buat Poster &rarr;</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card B: Seksi Fitur & Layanan */}
                    <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center text-xs font-black">B</span>
                          <h4 className="text-xs font-black text-[#0F172A]">Seksi Fitur &amp; Layanan</h4>
                        </div>
                        <span className="text-[10px] text-slate-400">3 Poin Keunggulan</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1.5">
                          <div className="flex items-center justify-between font-bold text-[#0F172A]">
                            <span className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded bg-blue-50 text-[#2563EB] flex items-center justify-center text-[10px]">1</span>
                              Pilihan Template Siap Pakai
                            </span>
                            <span className="text-[10px] text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-full font-bold">Aktif</span>
                          </div>
                          <p className="text-[11px] text-slate-500">Tersedia beragam susunan poster untuk jualan makanan, produk kerajinan, hingga pengumuman. Tinggal tunjuk yang disukai tanpa harus menata dari awal.</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-between text-slate-700">
                          <span className="flex items-center gap-1.5 font-bold">
                            <span className="w-5 h-5 rounded bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">2</span>
                            Penyesuaian Foto Praktis
                          </span>
                          <span className="text-[10px] text-slate-400">Cukup ambil foto produk lewat kamera HP biasa. Komposisi dan pencahayaannya otomatis diselaraskan.</span>
                        </div>
                        <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-between text-slate-700">
                          <span className="flex items-center gap-1.5 font-bold">
                            <span className="w-5 h-5 rounded bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">3</span>
                            Akses Mudah &amp; Cepat
                          </span>
                          <span className="text-[10px] text-slate-400">Langsung dibuka melalui peramban di HP maupun laptop tanpa perlu pasang aplikasi tambahan.</span>
                        </div>
                      </div>
                    </div>

                    {/* Card C: Kelola Tanya Jawab (FAQ) */}
                    <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center text-xs font-black">C</span>
                          <h4 className="text-xs font-black text-[#0F172A]">Kelola Tanya Jawab (FAQ)</h4>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2563EB] text-[10px] font-bold">+ Tambah Pertanyaan</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1">
                          <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                            <span className="text-slate-300">⋮⋮</span>
                            Q: Apakah Sukamenak Studio dapat digunakan secara gratis?
                          </div>
                          <p className="text-[11px] text-slate-500 pl-4">Ya, seluruh fitur dasar dapat diakses tanpa biaya untuk mendukung kemajuan usaha.</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-slate-700 font-bold flex items-center gap-1.5">
                          <span className="text-slate-300">⋮⋮</span>
                          Q: Berapa lama proses pembuatan satu desain poster?
                        </div>
                      </div>
                    </div>

                    {/* Card D: Kontak & Saluran Bantuan */}
                    <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center text-xs font-black">D</span>
                          <h4 className="text-xs font-black text-[#0F172A]">Kontak &amp; Saluran Bantuan</h4>
                        </div>
                        <span className="text-[10px] text-slate-400">Footer Sinkron</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="text-[11px] text-slate-500 font-bold block mb-1">WhatsApp Pengelola</label>
                          <input type="text" readOnly value="+62 812-3456-7890" className="w-full px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 font-bold text-[#0F172A]" />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500 font-bold block mb-1">Email Resmi</label>
                          <input type="text" readOnly value="kontak@sukamenak.org" className="w-full px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 font-bold text-[#0F172A]" />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500 font-bold block mb-1">Instagram Resmi</label>
                          <input type="text" readOnly value="@sukamenak.studio" className="w-full px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 font-bold text-[#0F172A]" />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="flex items-center justify-between pt-1">
                      <button className="px-5 py-2.5 rounded-2xl bg-[#2563EB] text-white text-xs font-extrabold shadow-md shadow-blue-500/25 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>Simpan Perubahan Landing Page</span>
                      </button>
                      <button className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold">
                        Batal
                      </button>
                    </div>
                  </div>

                {/* Previews of Tab 2 & Tab 3 Side Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                  <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-black text-[#0F172A] flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>Pratinjau Tab 2: Kebijakan &amp; Kuota</span>
                      </h4>
                      <span className="text-[10px] text-slate-400">Tersimpan</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Batas Kuota Pembuatan Harian:</span>
                        <strong className="text-[#0F172A] font-bold">15 Desain/Hari</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Wajib Watermark Logo:</span>
                        <span className="text-[#2563EB] font-bold">Aktif (Cap Studio)</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Sensitivitas Filter Konten:</span>
                        <span className="text-[#2563EB] font-bold">85% (Ketat)</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-black text-[#0F172A] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>Pratinjau Tab 3: Identitas Studio</span>
                      </h4>
                      <span className="text-[10px] text-slate-400">Tersimpan</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Nama Brand Studio:</span>
                        <strong className="text-[#0F172A] font-bold">Sukamenak Studio</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Logo Glyph:</span>
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-[#2563EB] font-bold">✦ Glyph Vektor Aktif</span>
                      </div>
                      <p className="text-[10px] text-slate-500 italic truncate">&copy; 2026 Sukamenak Studio &bull; Inisiatif Digital RW 15 Desa Sukamenak.</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

{/* ─────────────────────────────────────────────────────────────
                SECTION G: PROFIL ADMIN (/admin/profile)
            ───────────────────────────────────────────────────────────── */}
            {(boardSection === 'all' || boardSection === 'profile') && (
              <section className="space-y-6">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#2563EB] text-white text-[10px] font-black uppercase">
                      SECTION G
                    </span>
                    <h2 className="text-lg font-black text-[#0F172A]">
                      Profil Admin &bull; /admin/profile
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Elevated Frosted Card</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-4 bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-7 text-center space-y-4 shadow-xs">
                    <div className="w-24 h-24 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-black text-3xl mx-auto shadow-lg shadow-blue-500/20">
                      A
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-[#0F172A]">Admin Operasional</h4>
                      <p className="text-xs text-[#2563EB] font-bold mt-0.5">Super Administrator</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-xs text-left space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Email Administrator</span>
                      <strong className="text-[#0F172A] block">Admin Operasional</strong>
                    </div>
                  </div>

                  <div className="lg:col-span-8 bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-7 space-y-5 shadow-xs">
                    <h4 className="text-base font-black text-[#0F172A] border-b border-slate-100 pb-3">
                      Kredensial Keamanan Operator
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1.5">
                        <label className="font-bold text-[#0F172A]">Kata Sandi Saat Ini</label>
                        <input type="password" readOnly value="admin123" className="w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1]" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-[#0F172A]">Kata Sandi Baru</label>
                        <input type="password" readOnly placeholder="Kosongkan jika tidak diubah" className="w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1]" />
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs font-bold text-[#2563EB] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      <span>Sesi aktif terotentikasi &bull; TLS 1.3 Terenkripsi</span>
                    </div>
                  </div>
                </div>
              </section>
            )}

          </main>
        </div>

        {/* 10. EXACT LANDING PAGE TOP-CURVED FOOTER */}
        <footer className="mt-auto bg-[#0F172A] text-white rounded-t-[2.25rem] border-t border-slate-800 pt-12 pb-8 px-6 lg:px-12 shadow-2xl">
          <div className="max-w-7xl mx-auto space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-slate-800">
              {/* Column 1: Brand Identifier */}
              <div className="md:col-span-6 space-y-3">
                <div className="flex items-center gap-2.5">
                  <LogoIcon className="w-8 h-8" color="#2563EB" />
                  <span className="text-xl font-black text-white tracking-tight">
                    Sukamenak <span className="text-[#2563EB]">Studio</span>
                  </span>
                  <span className="ml-1 px-2.5 py-0.5 rounded-full bg-blue-900/50 border border-blue-500/30 text-blue-300 text-[10px] font-mono font-bold">
                    ADMIN CONSOLE
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md font-normal">
                  Platform studio visual berbasis AI untuk membantu promosi produk UMKM secara mandiri, praktis, dan profesional.
                </p>
                <div className="text-xs text-slate-400 font-medium">
                  Sukamenak, Kec. Margahayu, Kab. Bandung
                </div>
              </div>

              {/* Column 2: Quick Links Row */}
              <div className="md:col-span-3 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#2563EB]">
                  NAVIGASI ADMIN
                </h4>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                  <li><Link to="/admin/dashboard" className="hover:text-white transition-colors">Dashboard Analitik</Link></li>
                  <li><Link to="/admin/users" className="hover:text-white transition-colors">Manajemen Pengguna</Link></li>
                  <li><Link to="/admin/models" className="hover:text-white transition-colors">Model LLM</Link></li>
                  <li><Link to="/creator/dashboard" className="hover:text-white transition-colors text-[#38BDF8] font-bold">Mode Kreator Studio &rarr;</Link></li>
                </ul>
              </div>

              {/* Column 3: Direct Contact Buttons */}
              <div className="md:col-span-3 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#2563EB]">
                  BANTUAN TEKNIS
                </h4>
                <div className="flex flex-col gap-2 text-xs text-slate-300">
                  <a href="https://wa.me/6281234567890" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-slate-700 transition-colors">
                    <MessageCircle className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>WhatsApp (+62 812-3456-7890)</span>
                  </a>
                  <a href="mailto:kontak@sukamenak.org" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-slate-700 transition-colors">
                    <Mail className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Email (kontak@sukamenak.org)</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Bottom Copyright Line */}
            <div className="text-center text-xs text-slate-400 font-normal">
              &copy; 2026 Sukamenak Studio. Platform Desain Visual Promosi Mandiri UMKM.
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
};
export default PresentationBoard;
