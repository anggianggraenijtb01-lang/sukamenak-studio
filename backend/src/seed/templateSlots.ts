import type { SeedCorePrompt } from './data/corePrompts.js';
import { SLOT_LIBRARY, type OverlaySlot, type SeedTemplate, type SlotBase } from './data/templates.js';

export interface ResolvedSlot extends SlotBase {
  key: string;
  /** 1-based blank position for slots that fill the core prompt; null for text-overlay slots. */
  blank_index: number | null;
  sort_order: number;
  overlay?: OverlaySlot;
}

/**
 * Expands a template spec into concrete slots. The n-th key in the core prompt's `blankKeys`
 * becomes the slot with blank_index n, so the blank count always matches by construction.
 */
export function resolveSlots(template: SeedTemplate, core: SeedCorePrompt): ResolvedSlot[] {
  const blankSlots = core.blankKeys.map((key, i): ResolvedSlot => {
    const base = SLOT_LIBRARY[key];
    if (!base) throw new Error(`Seed bug: unknown slot key "${key}" in core prompt ${core.key}`);
    return { ...base, ...template.slots[key], key, blank_index: i + 1, sort_order: i };
  });
  for (const key of Object.keys(template.slots)) {
    if (!core.blankKeys.includes(key)) {
      throw new Error(`Seed bug: template ${template.slug} overrides "${key}" which core prompt ${core.key} has no blank for`);
    }
  }
  const overlays = template.overlay_slots.map(
    (o, j): ResolvedSlot => ({
      key: o.key,
      label: o.label,
      type: o.type,
      required: o.required ?? false,
      max_length: o.max_length,
      default_value: o.default_value,
      blank_index: null,
      sort_order: 100 + j,
      overlay: o,
    }),
  );
  return [...blankSlots, ...overlays];
}
