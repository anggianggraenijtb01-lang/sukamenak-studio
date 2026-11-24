/**
 * Pure rules of the Studio Generator: which modes a template allows, how its slots become a form and a
 * `POST /generations` body, when consent is needed and when the submit button must stay disabled.
 * No React in here, so every rule is unit tested (studioLogic.test.ts).
 *
 * The server stays the source of truth (it re-checks all of this). These rules only save a round trip and
 * explain the problem next to the right input.
 */
import type {
  CreateGenerationRequest,
  Generation,
  GenerationMode,
  ProgressStep,
  ReferenceRole,
  TemplateDetail,
  TemplateListItem,
  TemplateSlot,
} from '../../api/types';

/** `GET /admin/settings` is not readable by creators, so this is the documented seed default. A rejected
 *  generation (`TOO_MANY_REFERENCES`) teaches the page the real value (see `parseMaxReferences`). */
export const DEFAULT_MAX_REFERENCES = 4;
/** Hard API maximum of `reference_ids`. */
export const API_MAX_REFERENCES = 12;
export const MAX_REMARKS_LENGTH = 1000;
/** The free "remarks" text is routed into this slot by the server; the form never shows it as its own field. */
export const REMARKS_SLOT_KEY = 'remarks';

// ---- template and mode -----------------------------------------------------------------------------------

/** Modes a template allows. Image-to-image comes first: it is the main path. */
export function allowedModes(template: Pick<TemplateListItem, 'mode'>): GenerationMode[] {
  return template.mode === 'both' ? ['i2i', 't2i'] : [template.mode];
}

/** The preferred mode when the template allows it, else its first allowed mode (i2i wins for `both`). */
export function pickMode(template: Pick<TemplateListItem, 'mode'>, preferred?: string | null): GenerationMode {
  const modes = allowedModes(template);
  return modes.find((m) => m === preferred) ?? modes[0];
}

/**
 * What the studio's mode dropdown selects: one of the two image modes (a `POST /generations`), or `video`
 * (a reel rendered from an already finished poster via `POST /generations/:id/video`).
 */
export type StudioMode = GenerationMode | 'video';

export interface StudioModeOption {
  value: StudioMode;
  label: string;
  /** One line shown under the dropdown while this option is selected. */
  help: string;
}

const STUDIO_MODE_OPTIONS: Record<StudioMode, StudioModeOption> = {
  t2i: { value: 't2i', label: 'Teks ke Gambar', help: 'Desain dibuat dari isian dan deskripsi Anda, tanpa foto referensi.' },
  i2i: { value: 'i2i', label: 'Foto ke Gambar', help: 'Unggah foto produk atau model; AI menyusun poster berdasarkan foto tersebut.' },
  video: { value: 'video', label: 'Video (Reel)', help: 'Ubah poster yang sudah selesai menjadi video vertikal 9:16 untuk Reels, TikTok, dan Status WhatsApp.' },
};

/** Display order of the dropdown. */
const STUDIO_MODE_ORDER: readonly StudioMode[] = ['t2i', 'i2i', 'video'];

export const isImageMode = (mode: StudioMode): mode is GenerationMode => mode !== 'video';

/** Reads `?mode=` of a deep link; anything unknown is `null`. */
export function parseStudioMode(raw: string | null | undefined): StudioMode | null {
  return raw === 't2i' || raw === 'i2i' || raw === 'video' ? raw : null;
}

/**
 * Options of the mode dropdown. The image modes are narrowed to what the template allows (no template yet =
 * no restriction known); video is always offered because it works on finished posters, not on the template.
 */
export function modeOptions(template: Pick<TemplateListItem, 'mode'> | null | undefined): StudioModeOption[] {
  const images: readonly GenerationMode[] = template ? allowedModes(template) : ['i2i', 't2i'];
  return STUDIO_MODE_ORDER.filter((m) => m === 'video' || images.includes(m)).map((m) => STUDIO_MODE_OPTIONS[m]);
}

export const studioModeOption = (mode: StudioMode): StudioModeOption => STUDIO_MODE_OPTIONS[mode];

/** Like `pickMode`, but a video selection survives a template switch (the template does not restrict it). */
export function pickStudioMode(template: Pick<TemplateListItem, 'mode'>, current: StudioMode | null | undefined): StudioMode {
  return current === 'video' ? 'video' : pickMode(template, current);
}

// ---- video -----------------------------------------------------------------------------------------------

/** Backend `MIN_VIDEO_DURATION`. */
export const MIN_VIDEO_DURATION = 3;
/** Default of `VIDEO_MAX_DURATION_SECONDS` (deploy-time; the server answers VALIDATION_ERROR above its value). */
export const MAX_VIDEO_DURATION = 15;
/** Backend `DEFAULT_VIDEO_DURATION`. */
export const DEFAULT_VIDEO_DURATION = 15;

/** A whole number of seconds inside the accepted range; garbage falls back to the default. */
export function clampVideoDuration(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_VIDEO_DURATION;
  return Math.min(MAX_VIDEO_DURATION, Math.max(MIN_VIDEO_DURATION, Math.round(n)));
}

/** Videos left today (`null` while unknown), never negative. */
export function videoQuotaLeft(quota: { limit: number; used: number } | null | undefined): number | null {
  return quota ? Math.max(0, quota.limit - quota.used) : null;
}

/** The template to open when none was asked for: the first one that supports the preferred mode (default i2i). */
export function pickDefaultTemplate<T extends Pick<TemplateListItem, 'mode' | 'subject'>>(
  templates: readonly T[],
  preferredMode: GenerationMode = 'i2i',
): T | undefined {
  const supports = (t: T, m: GenerationMode) => t.mode === 'both' || t.mode === m;
  return (
    templates.find((t) => t.subject === 'product' && supports(t, preferredMode)) ??
    templates.find((t) => supports(t, preferredMode)) ??
    templates[0]
  );
}

// ---- slots -----------------------------------------------------------------------------------------------

export const slotFieldName = (key: string) => `slot_values.${key}`;

/** Slots the user fills in. `remarks` is excluded: the free remarks field feeds it. */
export function visibleSlots(template: Pick<TemplateDetail, 'slots'>): TemplateSlot[] {
  return template.slots.filter((s) => s.key !== REMARKS_SLOT_KEY);
}

export const imageSlots = (template: Pick<TemplateDetail, 'slots'>) => visibleSlots(template).filter((s) => s.target === 'image');
export const overlaySlots = (template: Pick<TemplateDetail, 'slots'>) => visibleSlots(template).filter((s) => s.target === 'overlay');

/**
 * Starting values of the form. A select starts on its default when that default is one of the options; every
 * other slot starts empty (an empty optional slot is simply not sent and the server fills its default).
 */
export function initialSlotValues(template: Pick<TemplateDetail, 'slots'>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const slot of visibleSlots(template)) {
    const def = slot.default_value?.trim() ?? '';
    values[slot.key] = slot.type === 'select' && def && slot.options?.some((o) => o.value === def) ? def : '';
  }
  return values;
}

/** Same rule as the server: required, no default and empty means the user must fill it. */
export function slotIsMandatory(slot: TemplateSlot): boolean {
  return slot.required && !slot.default_value?.trim();
}

export function slotMaxLength(slot: TemplateSlot): number | null {
  return slot.max_length && slot.max_length > 0 ? slot.max_length : null;
}

/** Field errors keyed `slot_values.<key>`, in the same shape the server answers with. */
export function validateSlotValues(template: Pick<TemplateDetail, 'slots'>, values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const slot of visibleSlots(template)) {
    const value = (values[slot.key] ?? '').trim();
    const field = slotFieldName(slot.key);
    if (!value) {
      if (slotIsMandatory(slot)) errors[field] = 'Wajib diisi';
      continue;
    }
    const max = slotMaxLength(slot);
    if (max && value.length > max) errors[field] = `Maksimal ${max} karakter`;
    else if (slot.type === 'select' && slot.options && !slot.options.some((o) => o.value === value)) errors[field] = 'Pilihan tidak valid';
  }
  return errors;
}

/** Only the template's own keys, trimmed, empty ones dropped (the server rejects unknown keys). */
export function buildSlotValues(template: Pick<TemplateDetail, 'slots'>, values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slot of visibleSlots(template)) {
    const value = (values[slot.key] ?? '').trim();
    if (value) out[slot.key] = value;
  }
  return out;
}

/** Role the upload box starts with: what the template's main reference slot asks for, else a product photo. */
export function defaultUploadRole(template: Pick<TemplateDetail, 'slots' | 'subject'> | null | undefined): ReferenceRole {
  if (!template) return 'product';
  const main = visibleSlots(template).find((s) => s.target === 'image' && s.reference_role && s.required);
  if (main?.reference_role) return main.reference_role;
  return template.subject === 'human_model' ? 'human_model' : 'product';
}

// ---- consent ---------------------------------------------------------------------------------------------

export interface RefLike {
  id: string;
  role: ReferenceRole;
}

/** Photos of people need an explicit consent: a human-model template, or any human_model reference in use. */
export function needsConsent(
  template: Pick<TemplateListItem, 'subject' | 'requires_consent'> | null | undefined,
  refs: readonly Pick<RefLike, 'role'>[],
): boolean {
  if (template && (template.subject === 'human_model' || template.requires_consent)) return true;
  return refs.some((r) => r.role === 'human_model');
}

// ---- the request -----------------------------------------------------------------------------------------

export interface GenerationRequestInput {
  template: Pick<TemplateDetail, 'slug' | 'slots' | 'mode' | 'subject' | 'requires_consent'>;
  mode: GenerationMode;
  values: Record<string, string>;
  remarks: string;
  refs: readonly RefLike[];
  consent: boolean;
}

/**
 * The `POST /generations` body. t2i never carries references; the consent flag is only sent when it is needed
 * (and then it is always `true`: the submit button stays disabled until the box is ticked).
 */
export function buildGenerationRequest(input: GenerationRequestInput): CreateGenerationRequest {
  const refs = input.mode === 'i2i' ? input.refs : [];
  const body: CreateGenerationRequest = {
    template_slug: input.template.slug,
    mode: input.mode,
    slot_values: buildSlotValues(input.template, input.values),
  };
  const remarks = input.remarks.trim().slice(0, MAX_REMARKS_LENGTH);
  if (remarks) body.remarks = remarks;
  if (refs.length > 0) body.reference_ids = [...new Set(refs.map((r) => r.id))];
  if (needsConsent(input.template, refs)) body.consent_confirmed = input.consent;
  return body;
}

// ---- submit gate -----------------------------------------------------------------------------------------

export type SubmitBlock =
  | 'no_template'
  | 'daily_limit'
  | 'consent'
  | 'uploading'
  | 'generating';

export interface SubmitGateInput {
  template: unknown;
  remainingToday: number | null | undefined;
  consentNeeded: boolean;
  consentGiven: boolean;
  uploading: boolean;
  generating: boolean;
}

/** Why the generate button must stay disabled, or `null` when it may be pressed. Order = priority. */
export function submitBlock(input: SubmitGateInput): SubmitBlock | null {
  if (input.generating) return 'generating';
  if (!input.template) return 'no_template';
  if (input.remainingToday !== null && input.remainingToday !== undefined && input.remainingToday <= 0) return 'daily_limit';
  if (input.uploading) return 'uploading';
  if (input.consentNeeded && !input.consentGiven) return 'consent';
  return null;
}

export const SUBMIT_BLOCK_HINTS: Record<SubmitBlock, string> = {
  no_template: 'Pilih template terlebih dahulu.',
  daily_limit: 'Batas harian tercapai. Hubungi admin.',
  consent: 'Centang pernyataan persetujuan untuk melanjutkan.',
  uploading: 'Tunggu hingga unggahan foto selesai.',
  generating: 'Desain sedang diproses.',
};

/** Local checks that run when the button is pressed. Returns field errors (empty = fine to send). */
export function validateSubmission(input: {
  template: Pick<TemplateDetail, 'slots'>;
  mode: GenerationMode;
  values: Record<string, string>;
  refs: readonly RefLike[];
  maxReferences: number;
}): Record<string, string> {
  const errors = validateSlotValues(input.template, input.values);
  if (input.mode === 'i2i' && input.refs.length === 0) {
    errors.reference_ids = 'Unggah minimal 1 foto referensi, atau pilih metode Teks ke Gambar bila template mengizinkan.';
  }
  if (input.mode === 'i2i' && input.refs.length > input.maxReferences) {
    errors.reference_ids = `Maksimal ${input.maxReferences} foto referensi per desain.`;
  }
  return errors;
}

/** The server explains `TOO_MANY_REFERENCES` as "Maksimal N gambar referensi ..."; reads N (null when absent). */
export function parseMaxReferences(serverMessage: string | undefined): number | null {
  const match = /maksimal\s+(\d{1,2})\b/i.exec(serverMessage ?? '');
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 && n <= API_MAX_REFERENCES ? n : null;
}

// ---- stepper ---------------------------------------------------------------------------------------------

export type StepState = 'pending' | 'running' | 'done' | 'failed';

export const STEPPER_LABELS = ['Analisis', 'Komposisi', 'Render', 'Selesai'] as const;

/** 1 to 4: the step the pipeline is on. `composite` still belongs to "Render" (the text is pasted onto it). */
const STEP_OF_PROGRESS: Record<ProgressStep, number> = { analysis: 1, compose: 2, generate: 3, composite: 3, done: 4 };

export const stepOfProgress = (step: ProgressStep | null | undefined): number => (step ? STEP_OF_PROGRESS[step] ?? 1 : 1);

/**
 * State of the four stepper steps for a generation (`null` = nothing started yet: all pending).
 *  - queued / unknown step: step 1 is running
 *  - running: steps before the current one are done, the current one is running
 *  - done: all four are done
 *  - failed: the step it stopped on is failed, the earlier ones are done
 */
export function stepperStates(generation: Pick<Generation, 'status' | 'progress_step'> | null | undefined): StepState[] {
  if (!generation) return ['pending', 'pending', 'pending', 'pending'];
  if (generation.status === 'done') return ['done', 'done', 'done', 'done'];
  const current = stepOfProgress(generation.progress_step);
  return [1, 2, 3, 4].map((n): StepState => {
    if (n < current) return 'done';
    if (n === current) return generation.status === 'failed' ? 'failed' : 'running';
    return 'pending';
  });
}

// ---- result badge ----------------------------------------------------------------------------------------

/** Honest badge of PRD section 5: was the reference image really used? */
export function referenceBadge(generation: Pick<Generation, 'used_reference_image' | 'reference_count_used'>): string {
  return generation.used_reference_image ? `Referensi: Dipakai langsung (${generation.reference_count_used})` : 'Teks saja';
}
