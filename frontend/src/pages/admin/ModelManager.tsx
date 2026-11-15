import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, Cpu, KeyRound, Pencil, Plus, Power, RotateCw, Trash2, XCircle } from 'lucide-react';
import {
  adminActivateModel,
  adminDeactivateModel,
  adminDeleteModel,
  adminListModels,
  adminSetDefaultModel,
  adminTestModel,
} from '../../api/admin';
import { getErrorMessage } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import type { AdminModel, AdminModelTestResult, ModelCapability } from '../../api/types';
import { ModelFormModal } from '../../components/admin/ModelFormModal';
import { CAPABILITY_LABELS, formatDateTime, formatDuration, formatUsd } from '../../components/admin/format';
import {
  Badge,
  Banner,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  NoticeBanner,
  PageHeader,
  Spinner,
  btnPrimary,
  btnSecondary,
  selectCls,
  useNotice,
} from '../../components/admin/ui';

const CAPABILITY_ORDER: ModelCapability[] = ['vision', 'text', 't2i', 'i2i'];

type Dialog =
  | { type: 'create'; capability?: ModelCapability }
  | { type: 'edit'; model: AdminModel }
  | { type: 'delete'; model: AdminModel }
  | { type: 'deactivate-default'; model: AdminModel };

/** Choose which other active model of the capability takes over before the default can be switched off. */
const DeactivateDefaultModal: React.FC<{
  model: AdminModel;
  candidates: AdminModel[];
  onClose: () => void;
  onDone: (newDefault: AdminModel) => void;
}> = ({ model, candidates, onClose, onDone }) => {
  const [newDefault, setNewDefault] = useState(candidates[0]?.id ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = async () => {
    setPending(true);
    setError(null);
    try {
      await adminDeactivateModel(model.id, { new_default_id: newDefault });
      onDone(candidates.find((c) => c.id === newDefault) ?? candidates[0]);
    } catch (err) {
      setError(err);
      setPending(false);
    }
  };

  return (
    <Modal
      title="Nonaktifkan model default"
      size="sm"
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>
            Batal
          </button>
          <button type="button" onClick={run} disabled={pending || !newDefault} className={btnPrimary}>
            {pending && <Spinner />}
            Nonaktifkan &amp; Alihkan
          </button>
        </>
      }
    >
      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
        <strong>{model.name}</strong> adalah default untuk {CAPABILITY_LABELS[model.capability]}. Pilih model aktif lain yang menjadi default baru.
      </p>
      {candidates.length === 0 ? (
        <Banner kind="warning">Tidak ada model aktif lain pada kemampuan ini. Aktifkan model lain terlebih dahulu.</Banner>
      ) : (
        <Field label="Default baru" htmlFor="new-default">
          <select id="new-default" value={newDefault} onChange={(e) => setNewDefault(e.target.value)} disabled={pending} className={selectCls}>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.model_id})
              </option>
            ))}
          </select>
        </Field>
      )}
      {error != null && <Banner kind="error">{getErrorMessage(error)}</Banner>}
    </Modal>
  );
};

const ModelCard: React.FC<{
  model: AdminModel;
  busy: string | null;
  testResult?: AdminModelTestResult;
  onSetDefault: () => void;
  onTest: () => void;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ model: m, busy, testResult, onSetDefault, onTest, onToggleActive, onEdit, onDelete }) => {
  const working = busy !== null && busy.startsWith(`${m.id}:`);
  return (
    <div
      data-testid={`model-card-${m.id}`}
      className={`rounded-3xl p-6 transition-all flex flex-col justify-between space-y-5 shadow-xs ${
        m.is_default ? 'bg-white/95 border-2 border-[#2563EB] shadow-md shadow-blue-500/10' : 'bg-white/85 backdrop-blur-md border border-slate-200/90 hover:border-[#2563EB]'
      }`}
    >
      <div className="space-y-4">
        {/* Provider & Badge */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-slate-500 font-bold uppercase tracking-wider">{m.provider}</span>
          {m.is_default ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#2563EB] text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> DEFAULT AKTIF
            </span>
          ) : (
            <Badge tone={m.is_active ? 'blue' : 'slate'}>{m.is_active ? 'Siaga' : 'Nonaktif'}</Badge>
          )}
        </div>

        {/* Title */}
        <div>
          <h3 className="text-base font-extrabold text-[#0F172A] leading-snug">{m.name}</h3>
          <p className="text-[11px] font-mono text-slate-500 mt-1 break-all">{m.model_id}</p>
          {m.base_url && <p className="text-[11px] font-mono text-slate-400 break-all">{m.base_url}</p>}
          {m.notes && <p className="text-xs text-[#475569] mt-2 leading-relaxed">{m.notes}</p>}
        </div>

        {/* Key + usability */}
        <div className="flex flex-wrap items-center gap-1.5">
          {m.requires_api_key ? (
            <Badge tone={m.api_key_configured ? 'green' : 'red'}>
              <KeyRound className="w-3 h-3" aria-hidden="true" />
              {m.api_key_configured ? 'Key terpasang' : 'Key belum diatur'}
            </Badge>
          ) : (
            <Badge tone="slate">Tanpa API key</Badge>
          )}
          <Badge tone={m.usable ? 'green' : 'amber'}>{m.usable ? 'Siap dipakai' : 'Belum siap dipakai'}</Badge>
        </div>
        {m.api_key_env && (
          <div className="text-[11px] text-slate-500">
            Variabel: <code className="font-mono font-bold text-slate-700">{m.api_key_env}</code>
          </div>
        )}

        {/* Metrics */}
        <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Biaya per panggilan:</span>
            <span className="font-mono font-bold text-[#2563EB]">{formatUsd(m.cost_per_call_usd)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Timeout / prioritas:</span>
            <span className="font-mono font-bold text-[#0F172A]">
              {formatDuration(m.timeout_ms)} / {m.priority}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Uji terakhir:</span>
            <span className="font-mono font-bold text-[#0F172A] text-right">
              {m.last_test_at ? (
                <>
                  {m.last_test_ok ? <span className="text-emerald-700">OK</span> : <span className="text-red-600">Gagal</span>} &bull; {formatDateTime(m.last_test_at)}
                </>
              ) : (
                'Belum diuji'
              )}
            </span>
          </div>
        </div>

        {testResult && (
          <div
            role="status"
            className={`p-3 rounded-2xl border text-xs font-bold space-y-0.5 ${testResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}
          >
            <div className="flex items-center gap-1.5">
              {testResult.ok ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <XCircle className="w-4 h-4" aria-hidden="true" />}
              {testResult.ok ? 'Koneksi berhasil' : 'Koneksi gagal'}
              {testResult.latency_ms != null && <span className="font-mono font-semibold"> ({formatDuration(testResult.latency_ms)})</span>}
            </div>
            {testResult.error && <div className="font-semibold">{testResult.error}</div>}
            {testResult.error_code && <div className="font-mono text-[10px] font-semibold opacity-80">{testResult.error_code}</div>}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pt-3 border-t border-slate-100 space-y-2">
        {!m.is_default ? (
          <button
            type="button"
            disabled={working || !m.is_active}
            onClick={onSetDefault}
            title={m.is_active ? undefined : 'Aktifkan model terlebih dahulu'}
            className="w-full py-2.5 px-4 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === `${m.id}:default` ? <Spinner className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" aria-hidden="true" />}
            <span>Jadikan Default</span>
          </button>
        ) : (
          <div className="w-full py-2.5 px-4 rounded-full bg-blue-50 text-[#2563EB] text-xs font-bold text-center border border-blue-200">Engine Utama Berjalan</div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onTest}
            disabled={working}
            className="py-2 px-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy === `${m.id}:test` ? <Spinner className="w-3 h-3" /> : <RotateCw className="w-3 h-3" aria-hidden="true" />}
            <span>Uji Koneksi</span>
          </button>
          <button
            type="button"
            disabled={working}
            onClick={onToggleActive}
            className={`py-2 px-3 rounded-full text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed ${
              !m.is_active ? 'bg-blue-50 text-[#2563EB] hover:bg-blue-100' : 'bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600'
            }`}
          >
            {busy === `${m.id}:toggle` ? <Spinner className="w-3 h-3" /> : <Power className="w-3 h-3" aria-hidden="true" />}
            <span>{m.is_active ? 'Nonaktifkan' : 'Aktifkan'}</span>
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={working}
            aria-label={`Edit ${m.name}`}
            className="py-2 px-3 rounded-full bg-white border border-slate-200 hover:border-[#2563EB] hover:text-[#2563EB] text-slate-600 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-60"
          >
            <Pencil className="w-3 h-3" aria-hidden="true" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={working || m.is_default}
            title={m.is_default ? 'Model default tidak dapat dihapus. Jadikan model lain default terlebih dahulu.' : undefined}
            aria-label={`Hapus ${m.name}`}
            className="py-2 px-3 rounded-full bg-white border border-slate-200 hover:border-red-400 hover:text-red-600 text-slate-600 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3 h-3" aria-hidden="true" />
            <span>Hapus</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const ModelManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { notice, show, showError, clear } = useNotice();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, AdminModelTestResult>>({});

  const models = useQuery({
    queryKey: queryKeys.admin.models.list({ limit: 100 }),
    queryFn: ({ signal }) => adminListModels({ limit: 100 }, signal),
    staleTime: 15_000,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.models.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard.all });
  };

  const run = async (m: AdminModel, action: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(`${m.id}:${action}`);
    try {
      await fn();
      show('success', success);
      refresh();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(null);
    }
  };

  const test = async (m: AdminModel) => {
    setBusy(`${m.id}:test`);
    try {
      const res = await adminTestModel(m.id);
      setTests((prev) => ({ ...prev, [m.id]: res }));
      refresh();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = (m: AdminModel) => {
    if (!m.is_active) {
      void run(m, 'toggle', () => adminActivateModel(m.id), `Model ${m.name} diaktifkan.`);
    } else if (m.is_default) {
      setDialog({ type: 'deactivate-default', model: m });
    } else {
      void run(m, 'toggle', () => adminDeactivateModel(m.id), `Model ${m.name} dinonaktifkan.`);
    }
  };

  const all = models.data?.items ?? [];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={<Cpu className="w-6 h-6" />}
        title={
          <>
            Manajemen Model <span className="text-[#2563EB]">LLM</span> &amp; Vision Engine
          </>
        }
        description="Atur model per kemampuan, uji koneksi, dan tetapkan default secara langsung tanpa redeploy. API key tidak pernah ditampilkan: hanya nama variabel dan statusnya."
        actions={
          <button type="button" onClick={() => setDialog({ type: 'create' })} className={btnPrimary}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            Tambah Model
          </button>
        }
      />

      <NoticeBanner notice={notice} onDismiss={clear} />

      {models.isPending && <LoadingBlock label="Memuat model..." />}
      {models.isError && !models.data && <ErrorState error={models.error} onRetry={() => void models.refetch()} title="Daftar model tidak dapat dimuat" />}
      {models.data && all.length === 0 && (
        <EmptyState icon={<Cpu className="w-6 h-6" />} title="Belum ada model terdaftar" hint="Tambahkan model pertama untuk setiap kemampuan agar generasi dapat berjalan." />
      )}

      {models.data &&
        CAPABILITY_ORDER.map((cap) => {
          const items = all.filter((m) => m.capability === cap);
          const hasDefault = items.some((m) => m.is_default);
          return (
            <section key={cap} className="space-y-3" aria-label={CAPABILITY_LABELS[cap]}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                <h2 className="text-sm sm:text-base font-black text-[#0F172A]">
                  {CAPABILITY_LABELS[cap]} <span className="text-xs font-semibold text-slate-400">({items.length} model)</span>
                </h2>
                <button type="button" onClick={() => setDialog({ type: 'create', capability: cap })} className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer">
                  + Tambah model {cap}
                </button>
              </div>
              {items.length > 0 && !hasDefault && <Banner kind="warning">Belum ada model default untuk kemampuan ini. Generasi yang memerlukannya akan gagal.</Banner>}
              {items.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">Belum ada model untuk kemampuan ini.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {items.map((m) => (
                    <ModelCard
                      key={m.id}
                      model={m}
                      busy={busy}
                      testResult={tests[m.id]}
                      onSetDefault={() => void run(m, 'default', () => adminSetDefaultModel(m.id), `${m.name} sekarang menjadi default ${m.capability}.`)}
                      onTest={() => void test(m)}
                      onToggleActive={() => toggleActive(m)}
                      onEdit={() => setDialog({ type: 'edit', model: m })}
                      onDelete={() => setDialog({ type: 'delete', model: m })}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}

      {dialog?.type === 'create' && (
        <ModelFormModal
          defaultCapability={dialog.capability}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            setDialog(null);
            show('success', `Model ${saved.name} ditambahkan${saved.is_active ? '' : ' (nonaktif)'}.`);
            refresh();
          }}
        />
      )}
      {dialog?.type === 'edit' && (
        <ModelFormModal
          model={dialog.model}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            setDialog(null);
            show('success', `Model ${saved.name} diperbarui.`);
            refresh();
          }}
        />
      )}
      {dialog?.type === 'delete' && (
        <ConfirmModal
          title="Hapus model?"
          confirmLabel="Hapus Model"
          danger
          message={
            <>
              Model <strong>{dialog.model.name}</strong> ({dialog.model.model_id}) akan dihapus dari daftar. Model default tidak dapat dihapus.
            </>
          }
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await adminDeleteModel(dialog.model.id);
            show('success', `Model ${dialog.model.name} dihapus.`);
            refresh();
          }}
        />
      )}
      {dialog?.type === 'deactivate-default' && (
        <DeactivateDefaultModal
          model={dialog.model}
          candidates={all.filter((c) => c.capability === dialog.model.capability && c.is_active && c.id !== dialog.model.id)}
          onClose={() => setDialog(null)}
          onDone={(nd) => {
            setDialog(null);
            show('success', `${dialog.model.name} dinonaktifkan; ${nd.name} menjadi default baru.`);
            refresh();
          }}
        />
      )}
    </div>
  );
};
export default ModelManager;
