import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { adminCreateTextZone, adminDeleteTextZone, adminUpdateTextZone } from '../../api/admin';
import { fileUrl } from '../../api/client';
import type { AdminCreateTextZoneRequest, AdminTemplateDetail, AdminTemplateTextZone, AdminUpdateTextZoneRequest, TextAlign } from '../../api/types';
import { TextZoneVisualizer, type ZoneRect } from './TextZoneVisualizer';
import { toFormError } from './adminErrors';
import { Banner, ConfirmModal, Field, Modal, Spinner, btnOutline, btnPrimary, btnSecondary, inputCls, selectCls } from './ui';

const ALIGNS: TextAlign[] = ['left', 'center', 'right'];
const FONT_RE = /^[A-Za-z0-9 _-]{1,60}$/;
const COLOR_RE = /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|brand(:\d{1,2})?)$/;

/** Percent text -> fraction rounded to 3 decimals, or NaN. */
const pctToFraction = (raw: string): number => {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 10) / 1000 : NaN;
};
const fractionToPct = (f: number): string => String(Math.round(f * 1000) / 10);

/** Exact rule of the server: `x + w <= 1` and `y + h <= 1` (with the same tolerance). */
export function validateZoneRect(r: ZoneRect): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const k of ['x', 'y'] as const) if (!(r[k] >= 0 && r[k] <= 1)) errors[k] = 'Isi 0-100 (%).';
  for (const k of ['w', 'h'] as const) if (!(r[k] > 0 && r[k] <= 1)) errors[k] = 'Isi lebih dari 0 sampai 100 (%).';
  if (!errors.x && !errors.w && r.x + r.w > 1.0001) errors.w = 'X + lebar tidak boleh melebihi 100%.';
  if (!errors.y && !errors.h && r.y + r.h > 1.0001) errors.h = 'Y + tinggi tidak boleh melebihi 100%.';
  return errors;
}

const ZoneFormModal: React.FC<{
  template: AdminTemplateDetail;
  zone?: AdminTemplateTextZone;
  onClose: () => void;
  onSaved: (message: string) => void;
}> = ({ template, zone, onClose, onSaved }) => {
  const editing = !!zone;
  const usedKeys = new Set(template.text_zones.filter((z) => z.id !== zone?.id).map((z) => z.slot_key));
  const slotChoices = template.slots.filter((s) => !usedKeys.has(s.key));

  const [slotKey, setSlotKey] = useState(zone?.slot_key ?? slotChoices[0]?.key ?? '');
  const [x, setX] = useState(zone ? fractionToPct(zone.x) : '10');
  const [y, setY] = useState(zone ? fractionToPct(zone.y) : '8');
  const [w, setW] = useState(zone ? fractionToPct(zone.w) : '80');
  const [h, setH] = useState(zone ? fractionToPct(zone.h) : '12');
  const [align, setAlign] = useState<TextAlign>(zone?.align ?? 'center');
  const [fontFamily, setFontFamily] = useState(zone?.font_family ?? 'Inter');
  const [fontWeight, setFontWeight] = useState(String(zone?.font_weight ?? 700));
  const [fontSize, setFontSize] = useState(zone ? fractionToPct(zone.font_size_ratio) : '5');
  const [color, setColor] = useState(zone?.color ?? '#FFFFFF');
  const [maxLines, setMaxLines] = useState(String(zone?.max_lines ?? 2));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);

  const rect: ZoneRect = { x: pctToFraction(x), y: pctToFraction(y), w: pctToFraction(w), h: pctToFraction(h) };
  const draft = Object.values(rect).every((n) => Number.isFinite(n)) ? rect : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!slotKey) local.slot_key = 'Pilih slot untuk zona ini.';
    Object.assign(local, validateZoneRect(rect));
    const weight = Number(fontWeight);
    const size = pctToFraction(fontSize);
    const lines = Number(maxLines);
    if (!FONT_RE.test(fontFamily.trim())) local.font_family = 'Hanya huruf, angka, spasi, _ dan -.';
    if (!Number.isInteger(weight) || weight < 100 || weight > 900) local.font_weight = 'Bilangan bulat 100-900.';
    if (!(size > 0 && size <= 1)) local.font_size_ratio = 'Lebih dari 0 sampai 100 (% tinggi kanvas).';
    if (!COLOR_RE.test(color.trim())) local.color = 'Gunakan #rrggbb, brand, atau brand:N.';
    if (!Number.isInteger(lines) || lines < 1 || lines > 20) local.max_lines = 'Bilangan bulat 1-20.';
    if (Object.keys(local).length > 0) {
      setError({ message: 'Periksa kembali isian yang ditandai.', fields: local });
      return;
    }

    const next: AdminCreateTextZoneRequest = {
      slot_key: slotKey,
      ...rect,
      align,
      font_family: fontFamily.trim(),
      font_weight: weight,
      font_size_ratio: size,
      color: color.trim(),
      max_lines: lines,
    };
    setPending(true);
    setError(null);
    try {
      if (zone) {
        const body: AdminUpdateTextZoneRequest = {};
        (Object.keys(next) as Array<keyof AdminCreateTextZoneRequest>).forEach((k) => {
          if ((zone as unknown as Record<string, unknown>)[k] !== next[k]) (body as Record<string, unknown>)[k] = next[k];
        });
        if (Object.keys(body).length === 0) {
          onClose();
          return;
        }
        await adminUpdateTextZone(template.id, zone.id, body);
        onSaved(`Zona teks "${slotKey}" diperbarui.`);
      } else {
        await adminCreateTextZone(template.id, next);
        onSaved(`Zona teks "${slotKey}" ditambahkan.`);
      }
    } catch (err) {
      setError(toFormError(err));
      setPending(false);
    }
  };

  const fe = (f: string) => error?.fields[f] ?? null;
  const otherZones = template.text_zones.filter((z) => z.id !== zone?.id);

  return (
    <Modal
      title={editing ? `Edit Zona Teks: ${zone.slot_key}` : 'Tambah Zona Teks'}
      size="xl"
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>
            Batal
          </button>
          <button type="submit" form="zone-form" disabled={pending || (!editing && slotChoices.length === 0)} className={btnPrimary}>
            {pending && <Spinner />}
            {editing ? 'Simpan Zona' : 'Tambah Zona'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        <form id="zone-form" onSubmit={submit} className="md:col-span-3 space-y-4" noValidate>
          {error && <Banner kind="error">{error.message}</Banner>}
          {!editing && slotChoices.length === 0 && <Banner kind="warning">Semua slot sudah punya zona teks (satu zona per slot). Tambahkan slot baru terlebih dahulu.</Banner>}
          <Field label="Slot yang ditampilkan" htmlFor="zone-slot" error={fe('slot_key')} hint="Satu zona per slot. Teks slot ini ditempel pada zona.">
            <select id="zone-slot" value={slotKey} onChange={(e) => setSlotKey(e.target.value)} disabled={pending || editing} className={selectCls}>
              {(editing ? template.slots : slotChoices).map((s) => (
                <option key={s.id} value={s.key}>
                  {s.label} ({s.key})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="X (%)" htmlFor="zone-x" error={fe('x')}>
              <input id="zone-x" inputMode="decimal" value={x} onChange={(e) => setX(e.target.value)} disabled={pending} className={inputCls} />
            </Field>
            <Field label="Y (%)" htmlFor="zone-y" error={fe('y')}>
              <input id="zone-y" inputMode="decimal" value={y} onChange={(e) => setY(e.target.value)} disabled={pending} className={inputCls} />
            </Field>
            <Field label="Lebar (%)" htmlFor="zone-w" error={fe('w')}>
              <input id="zone-w" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} disabled={pending} className={inputCls} />
            </Field>
            <Field label="Tinggi (%)" htmlFor="zone-h" error={fe('h')}>
              <input id="zone-h" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} disabled={pending} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Rata teks" htmlFor="zone-align" error={fe('align')}>
              <select id="zone-align" value={align} onChange={(e) => setAlign(e.target.value as TextAlign)} disabled={pending} className={selectCls}>
                {ALIGNS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Font" htmlFor="zone-font" error={fe('font_family')}>
              <input id="zone-font" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} disabled={pending} className={inputCls} />
            </Field>
            <Field label="Ketebalan font (100-900)" htmlFor="zone-weight" error={fe('font_weight')}>
              <input id="zone-weight" inputMode="numeric" value={fontWeight} onChange={(e) => setFontWeight(e.target.value)} disabled={pending} className={inputCls} />
            </Field>
            <Field label="Ukuran font (% tinggi kanvas)" htmlFor="zone-size" error={fe('font_size_ratio')}>
              <input id="zone-size" inputMode="decimal" value={fontSize} onChange={(e) => setFontSize(e.target.value)} disabled={pending} className={inputCls} />
            </Field>
            <Field label="Warna" htmlFor="zone-color" error={fe('color')} hint="#rrggbb, brand, atau brand:N (warna palet identitas).">
              <input id="zone-color" value={color} onChange={(e) => setColor(e.target.value)} disabled={pending} className={`${inputCls} font-mono`} />
            </Field>
            <Field label="Maksimum baris" htmlFor="zone-lines" error={fe('max_lines')}>
              <input id="zone-lines" inputMode="numeric" value={maxLines} onChange={(e) => setMaxLines(e.target.value)} disabled={pending} className={inputCls} />
            </Field>
          </div>
        </form>

        <div className="md:col-span-2">
          <TextZoneVisualizer
            aspectRatio={template.aspect_ratio}
            zones={otherZones}
            imageUrl={fileUrl(template.preview_url)}
            draft={draft}
            onDraw={(r) => {
              setX(fractionToPct(r.x));
              setY(fractionToPct(r.y));
              setW(fractionToPct(r.w));
              setH(fractionToPct(r.h));
            }}
          />
        </div>
      </div>
    </Modal>
  );
};

/** Text zones of a template: list, visual preview, create / edit / delete. */
export const ZonesEditor: React.FC<{
  template: AdminTemplateDetail;
  onChanged: (message: string) => void;
}> = ({ template, onChanged }) => {
  const [dialog, setDialog] = useState<{ type: 'create' } | { type: 'edit'; zone: AdminTemplateTextZone } | { type: 'delete'; zone: AdminTemplateTextZone } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const zones = template.text_zones;
  const slotLabel = (key: string) => template.slots.find((s) => s.key === key)?.label ?? key;

  return (
    <section className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4" aria-label="Zona teks template">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A]">
            Zona <span className="text-[#2563EB]">Teks</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Area tempat teks slot ditempel tajam di atas gambar. Satu zona per slot; koordinat berupa persen kanvas.</p>
        </div>
        <button type="button" onClick={() => setDialog({ type: 'create' })} className={btnOutline} disabled={template.slots.length === 0}>
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          Tambah Zona
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-start">
        <div className="md:col-span-3">
          {zones.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              {template.slots.length === 0 ? 'Tambahkan slot terlebih dahulu, lalu buat zona teks untuk slot overlay.' : 'Belum ada zona teks.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-2.5 px-3">Slot</th>
                    <th className="py-2.5 px-3">Posisi (x, y, w, h)</th>
                    <th className="py-2.5 px-3">Gaya</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {zones.map((z) => (
                    <tr key={z.id} className={selected === z.id ? 'bg-blue-50/50' : undefined}>
                      <td className="py-2 px-3">
                        <button type="button" onClick={() => setSelected(z.id)} className="text-left cursor-pointer">
                          <div className="font-bold text-[#0F172A]">{slotLabel(z.slot_key)}</div>
                          <code className="text-[11px] text-slate-500">{z.slot_key}</code>
                        </button>
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px]">
                        {fractionToPct(z.x)}, {fractionToPct(z.y)}, {fractionToPct(z.w)}, {fractionToPct(z.h)} %
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-600">
                        {z.font_family} {z.font_weight} &bull; {z.align} &bull; {z.max_lines} baris &bull; <span className="font-mono">{z.color}</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <button type="button" onClick={() => setDialog({ type: 'edit', zone: z })} className={btnOutline} aria-label={`Edit zona ${z.slot_key}`}>
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            Edit
                          </button>
                          <button type="button" onClick={() => setDialog({ type: 'delete', zone: z })} className={`${btnOutline} hover:!border-red-400 hover:!text-red-600`} aria-label={`Hapus zona ${z.slot_key}`}>
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
        </div>
        <div className="md:col-span-2">
          <TextZoneVisualizer aspectRatio={template.aspect_ratio} zones={zones} imageUrl={fileUrl(template.preview_url)} selectedId={selected} onSelect={setSelected} />
        </div>
      </div>

      {dialog && dialog.type !== 'delete' && (
        <ZoneFormModal
          template={template}
          zone={dialog.type === 'edit' ? dialog.zone : undefined}
          onClose={() => setDialog(null)}
          onSaved={(msg) => {
            setDialog(null);
            onChanged(msg);
          }}
        />
      )}
      {dialog?.type === 'delete' && (
        <ConfirmModal
          title="Hapus zona teks?"
          confirmLabel="Hapus Zona"
          danger
          message={
            <>
              Zona teks untuk slot <strong>{dialog.zone.slot_key}</strong> akan dihapus. Slot-nya tetap ada.
            </>
          }
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await adminDeleteTextZone(template.id, dialog.zone.id);
            setSelected(null);
            onChanged(`Zona teks "${dialog.zone.slot_key}" dihapus.`);
          }}
        />
      )}
    </section>
  );
};
