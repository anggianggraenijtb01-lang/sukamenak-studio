import { AppError } from '../lib/errors.js';
import {
  BLANK_TOKEN,
  countBlanks,
  findUnknownPlaceholders,
  isNamedPlaceholder,
  stripPlaceholderTokens,
  type NamedPlaceholder,
} from './placeholders.js';
import { stripBlockedTerms, stripForbiddenWords } from './policy.js';
import { sanitizeRemark } from './sanitizeRemark.js';
import { mapRemarksToSlots } from './slotHints.js';

export type Subject = 'product' | 'human_model';

export interface ComposeSlot {
  key: string;
  label?: string;
  /** 1-based position among the blanks of the core prompt; null for slots applied onto text zones. */
  blank_index: number | null;
  required?: boolean;
  default_value?: string | null;
  max_length?: number | null;
  /** Clause appended when the value comes from a reference analysis, e.g. "colour taken from the colour reference". */
  source_hint?: string | null;
}

export interface ComposeTextZone {
  slot_key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ComposeBrand {
  palette?: string[];
}

export interface ComposeInput {
  /** Decrypted core prompt body. Never log or return it. */
  coreBody: string;
  slots: ComposeSlot[];
  slotValues?: Record<string, string | null | undefined>;
  remarks?: string | null;
  subject: Subject;
  aspectRatio: string;
  /** Vision output per slot key (colour, lighting, ...). Used when the creator gave no explicit value. */
  analysis?: Record<string, string | null | undefined> | null;
  brand?: ComposeBrand | null;
  textZones?: ComposeTextZone[];
  blockedTerms?: string[];
  maxRemarkLength?: number;
}

export type ValueSource = 'explicit' | 'remarks' | 'analysis' | 'default' | 'fallback';

export interface ComposeResult {
  prompt: string;
  /** Provenance of each filled blank, keyed by slot key. Contains no prompt text. */
  sources: Record<string, ValueSource>;
  /** True when remarks could not be routed to any slot and were dropped. */
  droppedRemarks: boolean;
}

export const SUBJECT_LOCK: Record<Subject, string> = {
  product: 'no human, no face, no hands',
  human_model: 'exactly one human model, no additional people',
};

const NEGATIVE: Record<Subject, string> = {
  product: 'no watermark, no logo, no signage, no glyphs, no distorted shapes, no blur',
  human_model: 'no watermark, no logo, no signage, no glyphs, natural anatomy, no extra fingers, no blur',
};

const DEFAULT_MAX_REMARK = 300;
const DEFAULT_MAX_VALUE = 200;
const FALLBACK_VALUE = 'as appropriate to the subject';
const ASPECT_RE = /^\d{1,2}:\d{1,2}$/;
const TOKEN_RE = /\[___\]|\{\{\s*([^{}]*?)\s*\}\}/g;

/** Cleans a creator-supplied or model-supplied value so it cannot smuggle tokens, glyph words or blocked terms. */
export function cleanValue(raw: string | null | undefined, maxLength: number, blockedTerms: string[]): string {
  if (!raw) return '';
  let v = stripPlaceholderTokens(String(raw));
  v = stripForbiddenWords(v);
  v = stripBlockedTerms(v, blockedTerms);
  return v.replace(/\s+/g, ' ').trim().slice(0, maxLength).trim();
}

/** Plain-language description of where the application will later place each text zone. */
export function describeTextZones(zones: ComposeTextZone[] | undefined): string {
  if (!zones || zones.length === 0) return 'a flat empty colour field along the top of the frame';
  return zones
    .map((z) => {
      const cx = z.x + z.w / 2;
      const cy = z.y + z.h / 2;
      const vertical = cy < 0.34 ? 'along the top of the frame' : cy > 0.66 ? 'along the bottom of the frame' : 'across the middle of the frame';
      const horizontal = z.w > 0.7 ? '' : cx < 0.35 ? ' on the left' : cx > 0.65 ? ' on the right' : '';
      return `a flat empty colour field ${vertical}${horizontal}`;
    })
    .filter((d, i, all) => all.indexOf(d) === i)
    .join(' and ');
}

function describeBrandPalette(brand: ComposeBrand | null | undefined, blockedTerms: string[]): string {
  const colours = (brand?.palette ?? []).map((c) => cleanValue(c, 40, blockedTerms)).filter(Boolean);
  return colours.length > 0 ? `the brand colours ${colours.join(', ')}` : 'balanced complementary tones';
}

/**
 * Deterministic prompt composition (no LLM). Fills the core prompt's blanks in blank_index order.
 * Precedence per slot: explicit value > remarks routed by SLOT_HINTS > reference analysis >
 * slot default. Valid with zero remarks. Errors carry counts/field names only, never prompt text.
 */
export function composePromptDetailed(input: ComposeInput): ComposeResult {
  const blockedTerms = input.blockedTerms ?? [];

  const unknown = findUnknownPlaceholders(input.coreBody);
  if (unknown.length > 0) {
    throw new AppError('UNKNOWN_PLACEHOLDER', `Core prompt memuat ${unknown.length} placeholder yang tidak dikenal`);
  }

  const blankSlots = input.slots
    .filter((s): s is ComposeSlot & { blank_index: number } => s.blank_index !== null && s.blank_index !== undefined)
    .sort((a, b) => a.blank_index - b.blank_index);
  const distinctIndexes = new Set(blankSlots.map((s) => s.blank_index));
  const blankCount = countBlanks(input.coreBody);
  if (blankCount !== blankSlots.length || distinctIndexes.size !== blankSlots.length) {
    throw new AppError(
      'BLANK_SLOT_MISMATCH',
      `Jumlah blank pada core prompt (${blankCount}) tidak sama dengan jumlah slot (${blankSlots.length})`,
    );
  }

  if (!ASPECT_RE.test(input.aspectRatio)) {
    throw new AppError('VALIDATION_ERROR', 'Rasio aspek tidak valid', {
      errors: [{ field: 'aspectRatio', message: 'Gunakan format seperti 4:5' }],
    });
  }

  // Remarks: sanitise first (injection boundary), then route clauses to slots by keyword.
  const maxRemark = input.maxRemarkLength ?? DEFAULT_MAX_REMARK;
  const sanitizedRemarks = input.remarks
    ? cleanValue(sanitizeRemark(input.remarks, { blockedTerms, maxLength: maxRemark }), maxRemark, blockedTerms)
    : '';
  // The subject itself (product / model) is never re-targeted by free text: only explicit values
  // or reference analysis may change it. Remarks about it fall through to the generic remarks blank.
  const routableKeys = input.slots.map((s) => s.key).filter((k) => k !== 'product' && k !== 'model');
  const mapped = sanitizedRemarks ? mapRemarksToSlots(sanitizedRemarks, routableKeys) : { assigned: {}, unmapped: [] };
  const remarksSlot = input.slots.find((s) => s.key === 'remarks' && s.blank_index !== null);
  const remarkValues: Record<string, string> = { ...mapped.assigned };
  let droppedRemarks = false;
  if (mapped.unmapped.length > 0) {
    if (remarksSlot) {
      remarkValues[remarksSlot.key] = [remarkValues[remarksSlot.key], ...mapped.unmapped].filter(Boolean).join('; ');
    } else {
      droppedRemarks = true;
    }
  }

  const sources: Record<string, ValueSource> = {};
  const resolved: string[] = [];
  for (const slot of blankSlots) {
    const max = Math.min(slot.max_length ?? DEFAULT_MAX_VALUE, DEFAULT_MAX_VALUE * 2);
    const explicit = cleanValue(input.slotValues?.[slot.key], max, blockedTerms);
    const fromRemarks = cleanValue(remarkValues[slot.key], max, blockedTerms);
    const fromAnalysis = cleanValue(input.analysis?.[slot.key], max, blockedTerms);
    const fallbackDefault = cleanValue(slot.default_value, max, blockedTerms);

    let value: string;
    if (explicit) {
      value = explicit;
      sources[slot.key] = 'explicit';
    } else if (fromRemarks) {
      value = fromRemarks;
      sources[slot.key] = 'remarks';
    } else if (fromAnalysis) {
      const hint = cleanValue(slot.source_hint, 120, blockedTerms);
      value = hint ? `${fromAnalysis} (${hint})` : fromAnalysis;
      sources[slot.key] = 'analysis';
    } else if (fallbackDefault) {
      value = fallbackDefault;
      sources[slot.key] = 'default';
    } else if (slot.required) {
      throw new AppError('VALIDATION_ERROR', 'Slot wajib belum diisi', {
        errors: [{ field: `slot_values.${slot.key}`, message: 'Wajib diisi' }],
      });
    } else {
      value = FALLBACK_VALUE;
      sources[slot.key] = 'fallback';
    }
    resolved.push(value);
  }

  const named: Record<NamedPlaceholder, string> = {
    subject_lock: SUBJECT_LOCK[input.subject],
    negative: NEGATIVE[input.subject],
    text_zone: describeTextZones(input.textZones),
    aspect_ratio: input.aspectRatio,
    brand_palette: describeBrandPalette(input.brand, blockedTerms),
  };

  // Single pass: substituted values are never re-scanned, so a value can not inject a placeholder.
  let blankPointer = 0;
  const seen = new Set<NamedPlaceholder>();
  let prompt = input.coreBody.replace(TOKEN_RE, (token, name: string | undefined) => {
    if (token === BLANK_TOKEN) return resolved[blankPointer++] ?? '';
    const key = (name ?? '').trim();
    if (!isNamedPlaceholder(key)) return '';
    seen.add(key);
    return named[key];
  });

  // The subject lock and glyph-negative are invariants: add them when the body did not place them.
  const missing: string[] = [];
  if (!seen.has('subject_lock')) missing.push(named.subject_lock);
  if (!seen.has('negative')) missing.push(named.negative);
  if (missing.length > 0) prompt = `${prompt.trimEnd()}\nConstraints: ${missing.join('; ')}.`;

  // Last line of defence for the glyph-word rule, whatever the core body contained.
  prompt = prompt
    .split('\n')
    .map((line) => stripForbiddenWords(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { prompt, sources, droppedRemarks };
}

export const composePrompt = (input: ComposeInput): string => composePromptDetailed(input).prompt;
