import React, { useState } from 'react';
import {
  Cpu,
  CheckCircle2,
  Zap,
  Activity,
  Check,
  Radio,
  Power,
  RotateCw,
} from 'lucide-react';

interface ModelItem {
  id: string;
  name: string;
  provider: string;
  role: string;
  latency: string;
  cost: string;
  status: 'Aktif' | 'Siaga' | 'Nonaktif';
  isDefault: boolean;
}

export const ModelManager: React.FC = () => {
  const [models, setModels] = useState<ModelItem[]>([
    {
      id: 'm1',
      name: 'Gemini 2.5 Flash Vision + Imagen 3',
      provider: 'Google Vertex AI',
      role: 'Analisis vision foto produk & render poster resolusi tinggi (Rekomendasi Utama)',
      latency: '3.8s',
      cost: '$0.025 / render',
      status: 'Aktif',
      isDefault: true,
    },
    {
      id: 'm2',
      name: 'Flux.1 Dev ControlNet i2i',
      provider: 'Black Forest Labs',
      role: 'Preservasi kontur kemasan produk & penyesuaian lighting presisi studio',
      latency: '4.6s',
      cost: '$0.030 / render',
      status: 'Siaga',
      isDefault: false,
    },
    {
      id: 'm3',
      name: 'SDXL Lightning',
      provider: 'Stability AI',
      role: 'Generasi visual kilat 4-step untuk mode draf teks cepat',
      latency: '1.9s',
      cost: '$0.012 / render',
      status: 'Siaga',
      isDefault: false,
    },
  ]);

  const [testStatus, setTestStatus] = useState<string | null>(null);

  const handleSetDefault = (id: string) => {
    setModels((prev) =>
      prev.map((m) => ({
        ...m,
        isDefault: m.id === id,
        status: m.id === id ? 'Aktif' : m.status === 'Nonaktif' ? 'Nonaktif' : 'Siaga',
      }))
    );
  };

  const handleTestConnection = (name: string) => {
    setTestStatus(`Koneksi gateway ${name} berhasil! Respon 200 OK.`);
    setTimeout(() => setTestStatus(null), 3500);
  };

  const handleToggleActive = (id: string) => {
    setModels((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const nextStatus = m.status === 'Nonaktif' ? 'Siaga' : 'Nonaktif';
          return { ...m, status: nextStatus, isDefault: nextStatus === 'Nonaktif' ? false : m.isDefault };
        }
        return m;
      })
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/25">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Manajemen Model <span className="text-[#2563EB]">LLM</span> &amp; Vision Engine
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
              Monitoring performa model AI, latensi komputasi, dan penetapan default engine secara langsung tanpa redeploy.
            </p>
          </div>
        </div>
      </div>

      {testStatus && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs font-bold text-[#2563EB] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span>{testStatus}</span>
        </div>
      )}

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {models.map((mdl) => (
          <div
            key={mdl.id}
            className={`rounded-3xl p-6 transition-all flex flex-col justify-between space-y-6 shadow-xs ${
              mdl.isDefault
                ? 'bg-white/95 border-2 border-[#2563EB] shadow-md shadow-blue-500/10'
                : 'bg-white/85 backdrop-blur-md border border-slate-200/90 hover:border-[#2563EB]'
            }`}
          >
            <div className="space-y-4">
              {/* Provider & Badge */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-slate-500 font-bold uppercase tracking-wider">
                  {mdl.provider}
                </span>
                {mdl.isDefault ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#2563EB] text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
                    <CheckCircle2 className="w-3 h-3" /> DEFAULT AKTIF
                  </span>
                ) : (
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      mdl.status === 'Siaga'
                        ? 'bg-blue-50 text-[#2563EB] border border-blue-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-300'
                    }`}
                  >
                    {mdl.status}
                  </span>
                )}
              </div>

              {/* Title & Role */}
              <div>
                <h3 className="text-base font-extrabold text-[#0F172A] leading-snug">
                  {mdl.name}
                </h3>
                <p className="text-xs text-[#475569] mt-2 leading-relaxed">
                  {mdl.role}
                </p>
              </div>

              {/* Metrics */}
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Rata-rata Latensi:</span>
                  <span className="font-mono font-bold text-[#0F172A]">{mdl.latency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Estimasi Biaya:</span>
                  <span className="font-mono font-bold text-[#2563EB]">{mdl.cost}</span>
                </div>
              </div>
            </div>

            {/* Clean Action Buttons: "Jadikan Default", "Uji Koneksi", and "Nonaktifkan" */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              {!mdl.isDefault ? (
                <button
                  type="button"
                  onClick={() => handleSetDefault(mdl.id)}
                  className="w-full py-2.5 px-4 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Jadikan Default</span>
                </button>
              ) : (
                <div className="w-full py-2.5 px-4 rounded-full bg-blue-50 text-[#2563EB] text-xs font-bold text-center border border-blue-200">
                  Engine Utama Berjalan
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTestConnection(mdl.name)}
                  className="py-2 px-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Uji Koneksi</span>
                </button>

                <button
                  type="button"
                  disabled={mdl.isDefault}
                  onClick={() => handleToggleActive(mdl.id)}
                  className={`py-2 px-3 rounded-full text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                    mdl.isDefault
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400'
                      : mdl.status === 'Nonaktif'
                      ? 'bg-blue-50 text-[#2563EB] hover:bg-blue-100'
                      : 'bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600'
                  }`}
                >
                  <Power className="w-3 h-3" />
                  <span>{mdl.status === 'Nonaktif' ? 'Aktifkan' : 'Nonaktifkan'}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default ModelManager;
