import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { adminCreateSlot, adminDeleteSlot, adminUpdateSlot } from '../../api/admin';
import type {
  AdminCreateSlotRequest,
  AdminTemplateDetail,
  AdminTemplateSlot,
  AdminUpdateSlotRequest,
  ReferenceRole,
  SlotOption,
  SlotType,
} from '../../api/types';
import { toFormError } from './adminErrors';
import { REFERENCE_ROLE_LABELS } from './format';
import { Badge, Banner, ConfirmModal, Field, Modal, Spinner, btnOutline, btnPrimary, btnSecondary, inputCls, selectCls } from './ui';

const SLOT_TYPES: SlotType[] = ['text', 'textarea', 'select', 'color'];
const SLOT_TYPE_LABELS: Record<SlotType, string> = { text: 'Teks pendek', textarea: 'Teks panjang', select: 'Pilihan', color: 'Warna' };
const VISION_ROLES = Object.keys(REFERENCE_ROLE_LABELS) as ReferenceRole[];
const KEY_RE = /^[a-z][a-z0-9_]*$/;

const intOrNull = (raw: string, min: number, max: number): { value: number | null; error?: string } => {
  const t = raw.trim();
  if (t === '') return { value: null };
  if (!/^-?\d+$/.test(t) || Number(t) < min || Number(t) > max) return { value: null, error: `Bilangan bulat ${min}-${max}, atau kosongkan.` };
  return { value: Number(t) };
};

const SlotFormModal: React.FC<{
  template: AdminTemplateDetail;
  slot?: AdminTemplateSlot;
  onClose: () => void;
  onSaved: (message: string) => void;
}> = ({ template, slot, onClose, onSaved }) => {
  const editing = !!slot;
  const [key, setKey] = useState(slot?.key ?? '');
  const [label, setLabel] = useState(slot?.label ?? '');
  const [type, setType] = useState<SlotType>(slot?.type ?? 'text');
  const [blank, setBlank] = useState(slot?.blank_index != null ? String(slot.blank_index) : '');
  const [required, setRequired] = useState(slot?.required ?? false);
  const [defaultValue, setDefaultValue] = useState(slot?.default_value ?? '');
  const [options, setOptions] = useState<SlotOption[]>(slot?.options ?? [{ value: '', label: '' }]);
  const [maxLength, setMaxLength] = useState(slot?.max_length != null ? String(slot.max_length) : '');
  const [visionRole, setVisionRole] = useState<ReferenceRole | ''>(slot?.vision_role ?? '');
  const [sourceHint, setSourceHint] = useState(slot?.source_hint ?? '');
  const [sortOrder, setSortOrder] = useState(String(slot?.sort_order ?? template.slots.length));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!KEY_RE.test(key.trim())) local.key = 'Huruf kecil, angka, dan garis bawah; diawali huruf (contoh: nama_produk).';
    if (!label.trim()) local.label = 'Label wajib diisi.';
    const blankParsed = intOrNull(blank, 1, 50);
    if (blankParsed.error) local.blank_index = blankParsed.error;
    const maxParsed = intOrNull(maxLength, 1, 2000);
    if (maxParsed.error) local.max_length = maxParsed.error;
    const sortParsed = intOrNull(sortOrder, 0, 10000);
    if (sortParsed.error || sortParsed.value === null) local.sort_order = 'Bilangan bulat 0-10000.';
    const cleanOptions = options.map((o) => ({ value: o.value.trim(), label: o.label.trim() })).filter((o) => o.value || o.label);
    if (type === 'select') {
      if (cleanOptions.length === 0) local.options = 'Slot bertipe pilihan membutuhkan minimal satu opsi.';
      else if (cleanOptions.some((o) => !o.value || !o.label)) local.options = 'Setiap opsi perlu nilai dan label.';
    }
    if (blankParsed.value != null) {
      const clash = template.slots.find((s) => s.blank_index === blankParsed.value && s.id !== slot?.id);
      if (clash) local.blank_index = `blank_index ${blankParsed.value} sudah dipakai slot "${clash.key}".`;
    }
    if (Object.keys(local).length > 0) {
      setError({ message: 'Periksa kembali isian yang ditandai.', fields: local });
      return;
    }

    const next: AdminCreateSlotRequest = {
      key: key.trim(),
      label: label.trim(),
      type,
      blank_index: blankParsed.value,
      required,
      default_value: defaultValue === '' ? null : defaultValue,
      options: type === 'select' ? cleanOptions : null,
      max_length: maxParsed.value,
      vision_role: visionRole || null,
      source_hint: sourceHint.trim() || null,
      sort_order: sortParsed.value ?? 0,
    };

    setPending(true);
    setError(null);
    try {
      if (slot) {
        const body: AdminUpdateSlotRequest = {};
        (Object.keys(next) as Array<keyof AdminCreateSlotRequest>).forEach((k) => {
          const before = (slot as unknown as Record<string, unknown>)[k];
          if (JSON.stringify(before ?? null) !== JSON.stringify(next[k] ?? null)) (body as Record<string, unknown>)[k] = next[k];
        });
        if (Object.keys(body).length === 0) {
          onClose();
          return;
        }
        await adminUpdateSlot(template.id, slot.id, body);
        onSaved(`Slot "${next.key}" diperbarui.`);
      } else {
        await adminCreateSlot(template.id, next);
        onSaved(`Slot "${next.key}" ditambahkan.`);
      }
    } catch (err) {
      setError(toFormError(err));
      setPending(false);
    }
  };

  const fe = (f: string) => error?.fields[f] ?? null;

  return (
    <Modal
      title={editing ? `Edit Slot: ${slot.key}` : 'Tambah Slot'}
      size="lg"
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>
            Batal
          </button>
          <button type="submit" form="slot-form" disabled={pending} className={btnPrimary}>
            {pending && <Spinner />}
            {editing ? 'Simpan Slot' : 'Tambah Slot'}
          </button>
        </>
      }
    >
      <form id="slot-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && <Banner kind="error">{error.message}</Banner>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Key slot" htmlFor="slot-key" error={fe('key')} hint="Dipakai sebagai nama isian, contoh: nama_produk." required>
            <input id="slot-key" value={key} onChange={(e) => setKey(e.target.value)} disabled={pending} className={`${inputCls} font-mono`} autoComplete="off" />
          </Field>
          <Field label="Label untuk pengguna" htmlFor="slot-label" error={fe('label')} required>
            <input id="slot-label" value={label} onChange={(e) => setLabel(e.target.value)} disabled={pending} className={inputCls} />
          </Field>
          <Field label="Tipe" htmlFor="slot-type" error={fe('type')}>
            <select id="slot-type" value={type} onChange={(e) => setType(e.target.value as SlotType)} disabled={pending} className={selectCls}>
              {SLOT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SLOT_TYPE_LABELS[t]} ({t})
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="blank_index"
            htmlFor="slot-blank"
            error={fe('blank_index')}
            hint="Nomor isian [___] pada core prompt yang diisi slot ini. Kosongkan untuk slot yang hanya menjadi teks overlay."
          >
            <input id="slot-blank" inputMode="numeric" value={blank} onChange={(e) => setBlank(e.target.value)} disabled={pending} className={inputCls} placeholder="mis. 1" />
          </Field>
          <Field label="Nilai bawaan" htmlFor="slot-default" error={fe('default_value')}>
            <input id="slot-default" value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} disabled={pending} className={inputCls} maxLength={500} />
          </Field>
          <Field label="Panjang maksimum" htmlFor="slot-max" error={fe('max_length')}>
            <input id="slot-max" inputMode="numeric" value={maxLength} onChange={(e) => setMaxLength(e.target.value)} disabled={pending} className={inputCls} placeholder="Tanpa batas khusus" />
          </Field>
          <Field label="Peran foto referensi (vision_role)" htmlFor="slot-role" error={fe('vision_role')} hint="Jenis foto referensi yang dianalisis untuk mengisi slot ini.">
            <select id="slot-role" value={visionRole} onChange={(e) => setVisionRole(e.target.value as ReferenceRole | '')} disabled={pending} className={selectCls}>
              <option value="">Tidak ada</option>
              {VISION_ROLES.map((r) => (
                <option key={r} value={r}>
                  {REFERENCE_ROLE_LABELS[r]} ({r})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Urutan tampil" htmlFor="slot-sort" error={fe('sort_order')}>
            <input id="slot-sort" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} disabled={pending} className={inputCls} />
          </Field>
        </div>
        <Field label="Petunjuk sumber (source_hint)" htmlFor="slot-hint" error={fe('source_hint')} hint="Catatan singkat, mis. dari mana nilai ini diambil. Jangan menulis isi core prompt.">
          <input id="slot-hint" value={sourceHint} onChange={(e) => setSourceHint(e.target.value)} disabled={pending} className={inputCls} maxLength={160} />
        </Field>
        <label className="flex items-center gap-2.5 text-xs font-bold text-[#0F172A] cursor-pointer">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} disabled={pending} className="w-4 h-4 accent-[#2563EB]" />
          Wajib diisi pengguna
        </label>

        {type === 'select' && (
          <fieldset className="space-y-2 p-3.5 rounded-2xl border border-slate-200 bg-[#F8FAFC]">
            <legend className="px-1 text-xs font-bold text-[#0F172A]">Opsi pilihan</legend>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  aria-label={`Nilai opsi ${i + 1}`}
                  value={o.value}
                  onChange={(e) => setOptions((p) => p.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                  placeholder="nilai"
                  disabled={pending}
                  className={`${inputCls} !py-1.5 font-mono`}
                />
                <input
                  aria-label={`Label opsi ${i + 1}`}
                  value={o.label}
                  onChange={(e) => setOptions((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  placeholder="label tampil"
                  disabled={pending}
                  className={`${inputCls} !py-1.5`}
                />
                <button
                  type="button"
                  onClick={() => setOptions((p) => p.filter((_, j) => j !== i))}
                  disabled={pending || options.length <= 1}
                  aria-label={`Hapus opsi ${i + 1}`}
                  className="p-1.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setOptions((p) => [...p, { value: '', label: '' }])} disabled={pending || options.length >= 50} className={btnOutline}>
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Tambah opsi
            </button>
            {fe('options') && <p className="text-[11px] font-bold text-red-600">{fe('options')}</p>}
          </fieldset>
        )}
      </form>
    </Modal>
  );
};

/** Slots table with create / edit / delete. Admin DTOs only expose blank_index and source_hint, never prompt text. */
export const SlotsEditor: React.FC<{
  template: AdminTemplateDetail;
  onChanged: (message: string) => void;
}> = ({ template, onChanged }) => {
  const [dialog, setDialog] = useState<{ type: 'create' } | { type: 'edit'; slot: AdminTemplateSlot } | { type: 'delete'; slot: AdminTemplateSlot } | null>(null);
  const slots = [...template.slots].sort((a, b) => a.sort_order - b.sort_order);
  const withBlank = slots.filter((s) => s.blank_index != null).length;

  return (
    <section className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4" aria-label="Slot template">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A]">
            Slot <span className="text-[#2563EB]">Isian</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {slots.length} slot, {withBlank} di antaranya mengisi blank pada core prompt. Menghapus slot juga menghapus zona teksnya.
          </p>
        </div>
        <button type="button" onClick={() => setDialog({ type: 'create' })} className={btnOutline}>
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          Tambah Slot
        </button>
      </div>

      {slots.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">Belum ada slot. Tambahkan slot untuk setiap isian yang diminta dari pengguna.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-2.5 px-3">Slot</th>
                <th className="py-2.5 px-3">Tipe</th>
                <th className="py-2.5 px-3">blank</th>
                <th className="py-2.5 px-3">Wajib</th>
                <th className="py-2.5 px-3">Peran referensi</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slots.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 px-3">
                    <div className="font-bold text-[#0F172A]">{s.label}</div>
                    <code className="text-[11px] text-slate-500">{s.key}</code>
                    {s.source_hint && <div className="text-[11px] text-slate-400">{s.source_hint}</div>}
                  </td>
                  <td className="py-2 px-3 font-mono">{s.type}</td>
                  <td className="py-2 px-3">{s.blank_index != null ? <Badge tone="blue">#{s.blank_index}</Badge> : <span className="text-slate-400">overlay</span>}</td>
                  <td className="py-2 px-3">{s.required ? 'Ya' : 'Tidak'}</td>
                  <td className="py-2 px-3 font-mono">{s.vision_role ?? '-'}</td>
                  <td className="py-2 px-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button type="button" onClick={() => setDialog({ type: 'edit', slot: s })} className={btnOutline} aria-label={`Edit slot ${s.key}`}>
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        Edit
                      </button>
                      <button type="button" onClick={() => setDialog({ type: 'delete', slot: s })} className={`${btnOutline} hover:!border-red-400 hover:!text-red-600`} aria-label={`Hapus slot ${s.key}`}>
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog && dialog.type !== 'delete' && (
        <SlotFormModal
          template={template}
          slot={dialog.type === 'edit' ? dialog.slot : undefined}
          onClose={() => setDialog(null)}
          onSaved={(msg) => {
            setDialog(null);
            onChanged(msg);
          }}
        />
      )}
      {dialog?.type === 'delete' && (
        <ConfirmModal
          title="Hapus slot?"
          confirmLabel="Hapus Slot"
          danger
          message={
            <>
              Slot <strong>{dialog.slot.key}</strong> akan dihapus
              {template.text_zones.some((z) => z.slot_key === dialog.slot.key) ? ' beserta zona teksnya' : ''}. Jika template sudah terbit, perubahan ini diperiksa ulang dan ditolak bila membuat template tidak valid.
            </>
          }
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await adminDeleteSlot(template.id, dialog.slot.id);
            onChanged(`Slot "${dialog.slot.key}" dihapus.`);
          }}
        />
      )}
    </section>
  );
};
