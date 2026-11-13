import { stripPlaceholderTokens } from './placeholders.js';

export interface DisplaySlot {
  key: string;
  label: string;
}

const clean = (v: string): string => stripPlaceholderTokens(v).replace(/\s+/g, ' ').trim();

/**
 * Human-readable description of a creation for the public gallery, built ONLY from the creator's
 * slot values and remarks, labelled with the (public) slot labels. It never touches the core prompt.
 */
export function buildDisplayPrompt(
  slots: DisplaySlot[],
  slotValues: Record<string, string | null | undefined>,
  remarks?: string | null,
): string {
  const parts: string[] = [];
  for (const slot of slots) {
    const value = slotValues[slot.key];
    if (typeof value === 'string' && clean(value)) parts.push(`${slot.label}: ${clean(value)}`);
  }
  if (remarks && clean(remarks)) parts.push(`Catatan: ${clean(remarks)}`);
  return parts.join(' | ');
}
