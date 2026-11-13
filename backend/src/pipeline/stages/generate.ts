import sharp from 'sharp';
import { query } from '../../db/pool.js';
import { aspectSize } from '../../providers/aspect.js';
import { ProviderError } from '../../providers/errors.js';
import type { PipelineContext } from '../context.js';
import { callWithFallback } from '../modelCall.js';
import type { LoadedReference } from './analysis.js';

export interface GenerateOutcome {
  image: Buffer;
  costUsd: number;
  modelConfigId: string;
  referencesUsed: number;
}

/**
 * i2i sends ALL references to the image model as images; t2i sends none. The counters written to the
 * generation row come from what the adapter reports it actually sent, not from what was requested.
 */
export async function runGenerate(ctx: PipelineContext, prompt: string, references: LoadedReference[]): Promise<GenerateOutcome> {
  const mode = ctx.gen.mode;
  const { width, height } = aspectSize(ctx.template.aspect_ratio, 1024);
  const emptyZones = ctx.template.zones.map((z) => ({ x: Number(z.x), y: Number(z.y), w: Number(z.w), h: Number(z.h) }));

  const { value, config } = await callWithFallback(mode, ctx.signal, async (adapter, cfg) => {
    const result = await (adapter.generateImage as NonNullable<typeof adapter.generateImage>)(
      cfg,
      {
        prompt,
        mode,
        references: mode === 'i2i' ? references.map((r) => r.image) : [],
        aspectRatio: ctx.template.aspect_ratio,
        width,
        height,
        emptyZones,
      },
      { signal: ctx.signal },
    );
    // A model that returns something that is not a decodable image counts as a failure of that model.
    try {
      const meta = await sharp(result.image, { limitInputPixels: 100_000_000 }).metadata();
      if (!meta.width || !meta.height) throw new Error('empty');
    } catch {
      throw new ProviderError('PROVIDER_BAD_RESPONSE');
    }
    return result;
  });

  await query('UPDATE generations SET used_reference_image = $2, reference_count_used = $3, model_image_id = $4 WHERE id = $1', [
    ctx.gen.id,
    mode === 'i2i' && value.referencesUsed > 0,
    value.referencesUsed,
    config.id,
  ]);
  ctx.modelImageId = config.id;
  return { image: value.image, costUsd: value.costUsd, modelConfigId: config.id, referencesUsed: value.referencesUsed };
}
