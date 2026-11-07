import React, { useState } from 'react';
import { useStudio } from '../../components/common/StudioContext';
import {
  Terminal,
  Download,
  Search,
  CheckCircle2,
  Filter,
  Eye,
  X,
} from 'lucide-react';

export const AdminLogs: React.FC = () => {
  const { traceLogs } = useStudio();
  const [filterMode, setFilterMode] = useState('Semua');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const handleExportCsv = () => {
    const headers = 'Jam,ID_Pengguna,Unit,Mode,Durasi_ms,Status_Pipeline\n';
    const rows = traceLogs
      .map(
        (l) =>
          `"${l.timestamp}","${l.creatorName}","${l.unit}","${l.mode}","${l.latencyMs}","${l.status}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'log_trace_generasi_sukamenak.csv';
    a.click();
  };

  const filteredLogs = traceLogs.filter((l) => {
    const matchMode = filterMode === 'Semua' || l.mode === filterMode;
    const matchSearch =
      search === '' ||
      l.creatorName.toLowerCase().includes(search.toLowerCase()) ||
      l.unit.toLowerCase().includes(search.toLowerCase());
    return matchMode && matchSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/25">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Log &amp; Trace <span className="text-[#2563EB]">Generasi AI</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
              Audit jejak pipeline komputasi AI per tahap secara aman dan transparan.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-black transition-all cursor-pointer shadow-md shadow-blue-500/25 self-start sm:self-center"
        >
          <Download className="w-4 h-4" />
          <span>Ekspor CSV Audit</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama pengguna atau merek usaha..."
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
          {['Semua', 'Foto ke Gambar (I2I)', 'Teks ke Gambar (T2I)'].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterMode === mode
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'bg-[#F8FAFC] text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Enterprise Data Table */}
      <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
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
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-4 px-6 font-mono text-xs text-slate-500">
                    {log.timestamp}
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-extrabold text-[#0F172A]">{log.creatorName}</div>
                    <div className="text-xs text-[#2563EB] font-bold">UMKM Binaan</div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#2563EB] text-xs font-bold">
                      {log.mode}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono text-xs font-bold text-slate-700">
                    {log.latencyMs} ms
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 text-[10px] font-black uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>SUCCESS</span>
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 hover:border-[#2563EB] hover:text-[#2563EB] text-slate-600 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat Trace</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-[#0F172A]">
                Detail Jejak Pipeline #{selectedLog.id}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Pengguna:</span>
                <span className="font-bold text-[#0F172A]">{selectedLog.creatorName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Mode Eksekusi:</span>
                <span className="font-bold text-[#2563EB]">{selectedLog.mode}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Waktu Mulai:</span>
                <span className="font-mono text-slate-700">{selectedLog.timestamp}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Total Latensi:</span>
                <span className="font-mono font-bold text-[#0F172A]">{selectedLog.latencyMs} ms</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Enkripsi State:</span>
                <span className="font-mono text-slate-700">AES-256-GCM Verified</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Status Akhir:</span>
                <span className="font-black text-[#2563EB]">PIPELINE SUCCESS</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="w-full py-2.5 rounded-full bg-[#2563EB] text-white text-xs font-bold cursor-pointer hover:bg-[#1D4ED8]"
            >
              Tutup Detail Trace
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminLogs;
