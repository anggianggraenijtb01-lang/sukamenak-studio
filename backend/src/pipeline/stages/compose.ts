import { query, queryOne } from '../../db/pool.js';
import { composePromptDetailed } from '../../engine/promptComposer.js';
import { corePromptAad, decryptWithCoreKey, encryptWithCoreKey, finalPromptAad } from '../../lib/coreCipher.js';
import { AppError } from '../../lib/errors.js';
import { stringValues, type PipelineContext } from '../context.js';

interface CorePromptRow {
  version: number;
  body_ciphertext: Buffer;
  body_iv: Buffer;
  body_auth_tag: Buffer;
}

/**
 * Deterministic composition (no model). Decrypts the active core prompt, fills it from the slot values,
 * remarks and reference analysis, and stores the result ONLY as ciphertext. The returned plaintext lives
 * in memory for the generate stage and is never logged.
 */
export async function runCompose(ctx: PipelineContext, analysis: Record<string, string>): Promise<{ prompt: string }> {
  const row = await queryOne<CorePromptRow>(
    'SELECT version, body_ciphertext, body_iv, body_auth_tag FROM core_prompts WHERE key = $1 AND is_active',
    [ctx.template.core_prompt_key],
  );
  if (!row) throw new AppError('CORE_PROMPT_REQUIRED', 'Template belum memiliki core prompt aktif');

  const coreBody = decryptWithCoreKey(
    { ciphertext: row.body_ciphertext, iv: row.body_iv, authTag: row.body_auth_tag },
    corePromptAad(ctx.template.core_prompt_key, row.version),
  );

  const { prompt } = composePromptDetailed({
    coreBody,
    slots: ctx.template.slots.map((s) => ({
      key: s.key,
      label: s.label,
      blank_index: s.blank_index,
      required: s.required,
      default_value: s.default_value,
      max_length: s.max_length,
      source_hint: s.source_hint,
    })),
    slotValues: stringValues(ctx.gen.slot_values),
    remarks: ctx.gen.remarks,
    subject: ctx.gen.subject,
    aspectRatio: ctx.template.aspect_ratio,
    analysis,
    brand: { palette: ctx.palette },
    textZones: ctx.template.zones.map((z) => ({ slot_key: z.slot_key, x: Number(z.x), y: Number(z.y), w: Number(z.w), h: Number(z.h) })),
    blockedTerms: ctx.blockedTerms,
  });

  const enc = encryptWithCoreKey(prompt, finalPromptAad(ctx.gen.id));
  await query(
    'UPDATE generations SET final_prompt_ciphertext = $2, final_prompt_iv = $3, final_prompt_auth_tag = $4 WHERE id = $1',
    [ctx.gen.id, enc.ciphertext, enc.iv, enc.authTag],
  );
  return { prompt };
}
