import React, { useState } from 'react';
import { adminCreateModel, adminUpdateModel } from '../../api/admin';
import type { AdminCreateModelRequest, AdminModel, AdminUpdateModelRequest, ModelCapability, ModelProvider } from '../../api/types';
import { toFormError } from './adminErrors';
import { CAPABILITY_LABELS } from './format';
import {
  API_KEY_ENV_HELP,
  BASE_URL_HELP,
  KNOWN_PROVIDER_KEY_ENVS,
  PROVIDER_KEY_PREFIX,
  validateModelProviderFields,
} from './modelRules';
import { Banner, Field, Modal, Spinner, btnPrimary, btnSecondary, inputCls, selectCls, textareaCls } from './ui';

const PROVIDERS: ModelProvider[] = ['mock', 'openai_compat', 'gemini', 'fal'];
const CAPABILITIES: ModelCapability[] = ['vision', 'text', 't2i', 'i2i'];

function intIn(raw: string, min: number, max: number): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= min && n <= max ? n : null;
}

/**
 * Create / edit form of a model config. `provider` and `capability` are immutable on the server, so they are disabled when
 * editing. The API key field holds the NAME of a server environment variable, never a key; the rules are explained in place.
 */
export const ModelFormModal: React.FC<{
  model?: AdminModel;
  defaultCapability?: ModelCapability;
  onClose: () => void;
  onSaved: (saved: AdminModel, mode: 'create' | 'edit') => void;
}> = ({ model, defaultCapability, onClose, onSaved }) => {
  const editing = !!model;
  const [name, setName] = useState(model?.name ?? '');
  const [provider, setProvider] = useState<ModelProvider>(model?.provider ?? 'openai_compat');
  const [capability, setCapability] = useState<ModelCapability>(model?.capability ?? defaultCapability ?? 't2i');
  const [modelId, setModelId] = useState(model?.model_id ?? '');
  const [baseUrl, setBaseUrl] = useState(model?.base_url ?? '');
  const [apiKeyEnv, setApiKeyEnv] = useState(model?.api_key_env ?? '');
  const [priority, setPriority] = useState(String(model?.priority ?? 100));
  const [cost, setCost] = useState(String(model?.cost_per_call_usd ?? 0));
  const [timeoutMs, setTimeoutMs] = useState(String(model?.timeout_ms ?? 60000));
  const [notes, setNotes] = useState(model?.notes ?? '');
  const [isActive, setIsActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);
  const [touched, setTouched] = useState(false);

  const providerErrors = validateModelProviderFields({ provider, api_key_env: apiKeyEnv, base_url: baseUrl });
  const isMock = provider === 'mock';
  const fe = (f: string) => (touched ? providerErrors[f] : undefined) ?? error?.fields[f] ?? null;
  // The environment variable error is shown live (not only after submit): it is the rule people trip over most.
  const liveKeyError = apiKeyEnv.trim() ? providerErrors.api_key_env : undefined;
  const liveUrlError = baseUrl.trim() ? providerErrors.base_url : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const local: Record<string, string> = { ...providerErrors };
    if (name.trim().length < 2) local.name = 'Nama minimal 2 karakter.';
    if (!modelId.trim()) local.model_id = 'ID model wajib diisi.';
    const prio = intIn(priority, 0, 10000);
    const costNum = Number(cost);
    const timeout = intIn(timeoutMs, 1000, 600000);
    if (prio === null) local.priority = 'Bilangan bulat 0-10000.';
    if (!Number.isFinite(costNum) || costNum < 0 || costNum > 1000) local.cost_per_call_usd = 'Angka 0-1000 (USD).';
    if (timeout === null) local.timeout_ms = 'Milidetik, 1000-600000.';
    if (Object.keys(local).length > 0) {
      setError({ message: 'Periksa kembali isian yang ditandai merah.', fields: local });
      return;
    }

    setPending(true);
    setError(null);
    try {
      if (model) {
        const body: AdminUpdateModelRequest = {};
        if (name.trim() !== model.name) body.name = name.trim();
        if (modelId.trim() !== model.model_id) body.model_id = modelId.trim();
        if ((baseUrl.trim() || null) !== model.base_url) body.base_url = baseUrl.trim() || null;
        if (!isMock && (apiKeyEnv.trim() || null) !== model.api_key_env) body.api_key_env = apiKeyEnv.trim() || null;
        if (prio !== model.priority) body.priority = prio!;
        if (costNum !== model.cost_per_call_usd) body.cost_per_call_usd = costNum;
        if (timeout !== model.timeout_ms) body.timeout_ms = timeout!;
        if ((notes.trim() || null) !== model.notes) body.notes = notes.trim() || null;
        if (Object.keys(body).length === 0) {
          onClose();
          return;
        }
        onSaved(await adminUpdateModel(model.id, body), 'edit');
      } else {
        const body: AdminCreateModelRequest = {
          name: name.trim(),
          provider,
          capability,
          model_id: modelId.trim(),
          priority: prio!,
          cost_per_call_usd: costNum,
          timeout_ms: timeout!,
          is_active: isActive,
          ...(baseUrl.trim() ? { base_url: baseUrl.trim() } : {}),
          ...(!isMock && apiKeyEnv.trim() ? { api_key_env: apiKeyEnv.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        };
        onSaved(await adminCreateModel(body), 'create');
      }
    } catch (err) {
      setError(toFormError(err));
      setPending(false);
    }
  };

  return (
    <Modal
      title={editing ? `Edit Model: ${model.name}` : 'Tambah Model Baru'}
      size="lg"
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>
            Batal
          </button>
          <button type="submit" form="model-form" disabled={pending} className={btnPrimary}>
            {pending && <Spinner />}
            {editing ? 'Simpan Perubahan' : 'Simpan Model'}
          </button>
        </>
      }
    >
      <form id="model-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && <Banner kind="error">{error.message}</Banner>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nama tampilan" htmlFor="model-name" error={fe('name')} required>
            <input id="model-name" value={name} onChange={(e) => setName(e.target.value)} disabled={pending} className={inputCls} placeholder="Gemini Flash Vision" />
          </Field>
          <Field label="ID model di penyedia" htmlFor="model-model-id" error={fe('model_id')} required>
            <input id="model-model-id" value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={pending} className={`${inputCls} font-mono`} placeholder="gemini-2.5-flash" />
          </Field>
          <Field
            label="Provider"
            htmlFor="model-provider"
            error={fe('provider')}
            hint={editing ? 'Provider tidak dapat diubah setelah dibuat. Hapus dan buat ulang untuk menggantinya.' : undefined}
            required
          >
            <select id="model-provider" value={provider} onChange={(e) => {
                const next = e.target.value as ModelProvider;
                setProvider(next);
                if (next === 'mock') setApiKeyEnv(''); // the mock provider takes no key: do not keep a stale, disabled value
              }}
              disabled={editing || pending} className={selectCls}>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Kemampuan (capability)"
            htmlFor="model-capability"
            error={fe('capability')}
            hint={editing ? 'Kemampuan tidak dapat diubah setelah dibuat.' : undefined}
            required
          >
            <select id="model-capability" value={capability} onChange={(e) => setCapability(e.target.value as ModelCapability)} disabled={editing || pending} className={selectCls}>
              {CAPABILITIES.map((c) => (
                <option key={c} value={c}>
                  {CAPABILITY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label={`Base URL${provider === 'openai_compat' ? '' : ' (opsional)'}`}
          htmlFor="model-base-url"
          error={fe('base_url') ?? liveUrlError ?? null}
          hint={BASE_URL_HELP}
          required={provider === 'openai_compat'}
        >
          <input
            id="model-base-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            disabled={pending}
            className={`${inputCls} font-mono`}
            placeholder="https://api.penyedia.com/v1"
            autoComplete="off"
            aria-describedby="model-base-url-hint"
          />
        </Field>

        <Field
          label="Variabel lingkungan API key (api_key_env)"
          htmlFor="model-api-key-env"
          error={fe('api_key_env') ?? liveKeyError ?? null}
          hint={isMock ? 'Provider mock tidak memakai API key.' : API_KEY_ENV_HELP}
          required={!isMock}
        >
          <input
            id="model-api-key-env"
            value={apiKeyEnv}
            onChange={(e) => setApiKeyEnv(e.target.value.trim())}
            disabled={isMock || pending}
            className={`${inputCls} font-mono`}
            placeholder={isMock ? 'Tidak dipakai' : `GEMINI_API_KEY atau ${PROVIDER_KEY_PREFIX}AKUN_KEDUA`}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="model-api-key-env-hint"
          />
        </Field>
        {!isMock && (
          <div className="flex flex-wrap items-center gap-1.5 -mt-2" aria-label="Nama variabel baku">
            <span className="text-[11px] text-slate-500">Nama baku:</span>
            {KNOWN_PROVIDER_KEY_ENVS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setApiKeyEnv(n)}
                disabled={pending}
                className="px-2 py-0.5 rounded-md bg-[#F8FAFC] border border-slate-200 hover:border-[#2563EB] text-[10px] font-mono font-bold text-slate-600 cursor-pointer disabled:opacity-60"
              >
                {n}
              </button>
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-500 -mt-2">Nilai API key tidak pernah diketik atau ditampilkan di sini: key dipasang oleh operator di environment server.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Prioritas" htmlFor="model-priority" error={fe('priority')} hint="Angka kecil dipakai lebih dulu.">
            <input id="model-priority" inputMode="numeric" value={priority} onChange={(e) => setPriority(e.target.value)} disabled={pending} className={inputCls} />
          </Field>
          <Field label="Biaya per panggilan (USD)" htmlFor="model-cost" error={fe('cost_per_call_usd')}>
            <input id="model-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} disabled={pending} className={inputCls} />
          </Field>
          <Field label="Timeout (ms)" htmlFor="model-timeout" error={fe('timeout_ms')}>
            <input id="model-timeout" inputMode="numeric" value={timeoutMs} onChange={(e) => setTimeoutMs(e.target.value)} disabled={pending} className={inputCls} />
          </Field>
        </div>

        <Field label="Catatan (opsional)" htmlFor="model-notes" error={fe('notes')}>
          <textarea id="model-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={pending} className={textareaCls} maxLength={500} />
        </Field>

        {!editing && (
          <label className="flex items-start gap-2.5 text-xs font-bold text-[#0F172A] cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={pending} className="w-4 h-4 mt-0.5 accent-[#2563EB]" />
            <span>
              Langsung aktifkan
              <span className="block text-[11px] font-normal text-slate-500">Hanya berhasil jika variabel API key sudah terpasang di server. Model baru tidak otomatis menjadi default.</span>
            </span>
          </label>
        )}
      </form>
    </Modal>
  );
};
