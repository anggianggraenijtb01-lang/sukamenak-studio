import { query } from '../../db/pool.js';
import { sanitizeRemark } from '../../engine/sanitizeRemark.js';
import { AppError } from '../../lib/errors.js';
import { isProviderError } from '../../providers/errors.js';
import type { ImageInput } from '../../providers/types.js';
import { getStorage } from '../../storage/index.js';
import type { PipelineContext } from '../context.js';
import { PipelineError } from '../errors.js';
import { callWithFallback } from '../modelCall.js';

export interface LoadedReference {
  id: string;
  role: string;
  image: ImageInput;
}

const ROLE_FOCUS: Record<string, string> = {
  product: 'product: its shape, packaging, material and colours',
  human_model: 'person: general appearance, age range and expression, without naming or identifying anyone',
  font: 'typeface style: weight, proportions and mood',
  color: 'colour palette: the dominant and accent colours',
  lighting: 'lighting: its quality, direction and warmth',
  pose: 'pose: body posture and gesture',
  background: 'background: the setting and surroundings',
  style: 'overall visual style and mood',
};

/** Vision prompt: "extract ONLY <role>, ignore the rest", asking for a short, glyph-free description. */
export function analysisInstruction(role: string): string {
  const focus = ROLE_FOCUS[role] ?? role;
  return (
    `Extract ONLY the ${focus} from this image and ignore everything else in it. ` +
    'Answer with one short descriptive phrase in English (at most 25 words), with no preface and no list. ' +
    'Do not describe or quote any lettering or writing that appears in the image.'
  );
}

/** Loads every reference of a generation as image bytes, in the order the creator gave them. */
export async function loadReferences(userId: string, inputs: { reference_id: string; role: string }[]): Promise<LoadedReference[]> {
  if (inputs.length === 0) return [];
  const rows = await query<{ id: string; role: string; storage_key: string; mime: string }>(
    `SELECT r.id, r.role, a.storage_key, a.mime
       FROM reference_assets r JOIN assets a ON a.id = r.asset_id
      WHERE r.id = ANY($1::uuid[]) AND r.deleted_at IS NULL AND a.deleted_at IS NULL
        AND (r.expires_at IS NULL OR r.expires_at > now())
        AND (r.is_library OR r.owner_id = $2)`,
    [inputs.map((i) => i.reference_id), userId],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const storage = getStorage();
  const loaded: LoadedReference[] = [];
  for (const input of inputs) {
    const row = byId.get(input.reference_id);
    if (!row) throw new PipelineError('REFERENCE_UNAVAILABLE', 'Salah satu gambar referensi sudah tidak tersedia');
    try {
      loaded.push({ id: row.id, role: row.role, image: { data: await storage.get(row.storage_key), mime: row.mime } });
    } catch {
      throw new PipelineError('REFERENCE_UNAVAILABLE', 'Salah satu gambar referensi sudah tidak tersedia');
    }
  }
  return loaded;
}

export interface AnalysisOutcome {
  /** Slot key -> sanitised description, for the slots that a reference role feeds. */
  analysis: Record<string, string>;
  costUsd: number;
  modelConfigId: string | null;
  degraded: boolean;
  failureCode: string | null;
}

function markDegraded(outcome: AnalysisOutcome, code: string): void {
  outcome.degraded = true;
  outcome.failureCode ??= code;
}

/**
 * One vision call per reference (skipped when no slot listens to the reference's role: the answer
 * would be discarded). Any vision failure leaves the slot on its default, flags the generation as
 * degraded and lets the pipeline continue: a vision failure never fails a generation.
 */
export async function runAnalysis(ctx: PipelineContext, references: LoadedReference[]): Promise<AnalysisOutcome> {
  const outcome: AnalysisOutcome = { analysis: {}, costUsd: 0, modelConfigId: null, degraded: false, failureCode: null };

  for (const ref of references) {
    const slot = ctx.template.slots.find((s) => s.vision_role === ref.role && s.blank_index !== null);
    if (!slot) continue;
    if (ctx.signal.aborted) break;
    try {
      const { value, config } = await callWithFallback('vision', ctx.signal, (adapter, cfg) =>
        (adapter.analyzeReference as NonNullable<typeof adapter.analyzeReference>)(
          cfg,
          { image: ref.image, role: ref.role, instruction: analysisInstruction(ref.role) },
          { signal: ctx.signal },
        ),
      );
      outcome.costUsd += value.costUsd;
      outcome.modelConfigId ??= config.id;
      // The description comes from a model that has looked at an untrusted image: treat it like a remark.
      const cleaned = sanitizeRemark(value.description, { blockedTerms: ctx.blockedTerms, maxLength: 200 });
      if (cleaned) outcome.analysis[slot.key] = outcome.analysis[slot.key] ? `${outcome.analysis[slot.key]}; ${cleaned}` : cleaned;
      else markDegraded(outcome, 'VISION_EMPTY');
    } catch (err) {
      if (ctx.signal.aborted) throw err;
      if (isProviderError(err)) markDegraded(outcome, err.code);
      else if (err instanceof AppError) markDegraded(outcome, err.code);
      else markDegraded(outcome, 'VISION_FAILED');
    }
  }
  return outcome;
}
