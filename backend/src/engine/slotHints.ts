import { normalizeForMatch } from './policy.js';

/**
 * Deterministic keyword -> slot map (Indonesian + English). The key order is the tie-break
 * priority when a clause matches several slots equally well.
 */
export const SLOT_HINTS: Readonly<Record<string, readonly string[]>> = {
  lighting: [
    'cahaya', 'pencahayaan', 'penerangan', 'sinar', 'terang', 'redup', 'bayangan', 'senja', 'matahari', 'lampu',
    'lighting', 'light', 'lit', 'softbox', 'backlight', 'rim light', 'golden hour', 'daylight', 'sunlight', 'shadow',
    'shadows', 'glow', 'highlight', 'high key', 'low key',
  ],
  background: [
    'latar', 'background', 'backdrop', 'setting', 'suasana', 'meja', 'table', 'kayu', 'wooden', 'dinding', 'wall',
    'lantai', 'floor', 'taman', 'garden', 'pantai', 'beach', 'pasar', 'market', 'dapur', 'kitchen', 'outdoor',
    'indoor', 'studio', 'jendela', 'window', 'sawah', 'rice field', 'pegunungan', 'mountain', 'kafe', 'cafe',
    'permukaan', 'surface', 'marmer', 'marble', 'tekstur', 'texture',
  ],
  color: [
    'warna', 'merah', 'biru', 'hijau', 'kuning', 'oranye', 'jingga', 'ungu', 'hitam', 'putih', 'cokelat', 'coklat',
    'emas', 'perak', 'pastel', 'hangat', 'dingin', 'earth tone', 'monokrom',
    'color', 'colour', 'colors', 'colours', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'black', 'white',
    'brown', 'gold', 'silver', 'pink', 'cream', 'beige', 'warm', 'cool', 'palette', 'tone', 'tones', 'monochrome',
    'gradient', 'gradasi',
  ],
  angle: [
    'sudut', 'angle', 'dari atas', 'top down', 'flat lay', 'flatlay', 'eye level', 'low angle', 'high angle',
    'close up', 'closeup', 'makro', 'macro', 'frontal', 'samping', 'side view', 'bird eye', 'tampak depan',
  ],
  composition: [
    'komposisi', 'composition', 'tengah', 'center', 'centre', 'centered', 'kiri', 'kanan', 'left', 'right',
    'ruang kosong', 'negative space', 'simetris', 'symmetrical', 'rule of thirds', 'margin', 'seimbang', 'balanced',
    'diagonal', 'framing', 'layout', 'ruang', 'space',
  ],
  style: [
    'gaya', 'style', 'minimalis', 'minimalist', 'modern', 'vintage', 'retro', 'elegan', 'elegant', 'mewah', 'luxury',
    'premium', 'ceria', 'playful', 'rustic', 'tradisional', 'traditional', 'festive', 'meriah', 'bersih', 'clean',
    'realistis', 'realistic', 'ilustrasi', 'illustration', 'flat design', 'kartun', 'cartoon', 'cinematic', 'sinematik',
    'mood', 'nuansa', 'vibe',
  ],
  pose: [
    'pose', 'berdiri', 'standing', 'duduk', 'sitting', 'seated', 'senyum', 'smile', 'smiling', 'menghadap',
    'facing', 'berjalan', 'walking', 'tangan', 'arms', 'menoleh', 'posture', 'gesture',
  ],
  outfit: [
    'baju', 'pakaian', 'busana', 'kemeja', 'outfit', 'dress', 'hijab', 'jaket', 'jacket', 'batik', 'kaos', 'kebaya',
    'seragam', 'uniform', 'clothing', 'clothes', 'wearing', 'berpakaian',
  ],
  product: [
    'produk', 'product', 'kemasan', 'packaging', 'package', 'botol', 'bottle', 'pouch', 'toples', 'jar', 'kotak',
    'box', 'kantong', 'bag', 'label', 'merek', 'brand', 'makanan', 'food', 'minuman', 'drink',
  ],
} as const;

export interface MappedRemarks {
  /** Slot key -> remark fragments assigned to it (joined with ", "). */
  assigned: Record<string, string>;
  /** Fragments that matched no available slot. */
  unmapped: string[];
}

const CLAUSE_SPLIT = /[\n;.!?]+|,(?=\s)|\s+(?:dan|and|serta|with|dengan)\s+(?=\S+\s+\S+\s+\S+)/i;

const tokenize = (normalized: string): string[] => normalized.split(' ').filter(Boolean);

function scoreClause(normalizedClause: string, keywords: readonly string[]): number {
  const tokens = tokenize(normalizedClause);
  const padded = ` ${normalizedClause} `;
  let score = 0;
  for (const raw of keywords) {
    const kw = normalizeForMatch(raw);
    if (!kw) continue;
    if (kw.includes(' ')) {
      if (padded.includes(` ${kw} `)) score += 2;
    } else if (tokens.some((t) => t === kw || (kw.length >= 5 && t.startsWith(kw)))) {
      score += 1;
    }
  }
  return score;
}

/** How strongly `text` mentions the given slot's topic (0 = not at all). */
export function hintScore(text: string, slotKey: string): number {
  const keywords = SLOT_HINTS[slotKey];
  return keywords ? scoreClause(normalizeForMatch(text), keywords) : 0;
}

/** Slot key that best matches `clause`, restricted to `availableKeys`; null when nothing matches. */
export function matchClauseToSlot(clause: string, availableKeys: readonly string[]): string | null {
  const normalized = normalizeForMatch(clause);
  if (!normalized) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const [slotKey, keywords] of Object.entries(SLOT_HINTS)) {
    if (!availableKeys.includes(slotKey)) continue;
    const score = scoreClause(normalized, keywords);
    if (score > bestScore) {
      best = slotKey;
      bestScore = score;
    }
  }
  return best;
}

/** Splits remarks into clauses and routes each to a slot by keyword. Pure and deterministic. */
export function mapRemarksToSlots(remarks: string, availableKeys: readonly string[]): MappedRemarks {
  const assigned: Record<string, string> = {};
  const unmapped: string[] = [];
  const clauses = remarks
    .split(CLAUSE_SPLIT)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  for (const clause of clauses) {
    const slotKey = matchClauseToSlot(clause, availableKeys);
    if (slotKey) assigned[slotKey] = assigned[slotKey] ? `${assigned[slotKey]}, ${clause}` : clause;
    else unmapped.push(clause);
  }
  return { assigned, unmapped };
}
