import { query } from '../../db/pool.js';
import { createAsset, softDeleteAssets, type AssetRecord } from '../../storage/assets.js';
import { makeThumbnail } from '../../storage/image.js';
import { compositeText, type ZoneSpec } from '../compositor.js';
import { stringValues, type PipelineContext } from '../context.js';

export interface CompositeOutcome {
  result: AssetRecord;
  thumbnail: AssetRecord;
  placed: string[];
}

/**
 * Pastes the slot texts into the template's text zones (sharp + bundled font), adds the optional
 * watermark, strips metadata and stores the result and a thumbnail. The model never draws text.
 */
export async function runComposite(ctx: PipelineContext, base: Buffer): Promise<CompositeOutcome> {
  const values = stringValues(ctx.gen.slot_values);
  // An optional overlay slot the creator left empty falls back to the slot default, when it has one.
  for (const slot of ctx.template.slots) {
    if (slot.blank_index === null && !values[slot.key]?.trim() && slot.default_value) values[slot.key] = slot.default_value;
  }

  const zones: ZoneSpec[] = ctx.template.zones.map((z) => ({
    slot_key: z.slot_key,
    x: Number(z.x),
    y: Number(z.y),
    w: Number(z.w),
    h: Number(z.h),
    align: z.align,
    font_family: z.font_family,
    font_weight: z.font_weight,
    font_size_ratio: Number(z.font_size_ratio),
    color: z.color,
    max_lines: z.max_lines,
  }));

  const composed = await compositeText({
    base,
    zones,
    values,
    palette: ctx.palette,
    aspectRatio: ctx.template.aspect_ratio,
    watermark: ctx.watermarkEnabled ? ctx.brandName || 'Sukamenak Studio' : null,
  });
  const thumb = await makeThumbnail(composed.image);

  const result = await createAsset({
    buffer: composed.image,
    mime: 'image/png',
    kind: 'result',
    ownerId: ctx.gen.user_id,
    prefix: 'results',
    width: composed.width,
    height: composed.height,
  });
  let thumbnail: AssetRecord;
  try {
    thumbnail = await createAsset({
      buffer: thumb.buffer,
      mime: thumb.mime,
      kind: 'thumbnail',
      ownerId: ctx.gen.user_id,
      prefix: 'thumbs',
      width: thumb.width,
      height: thumb.height,
    });
  } catch (err) {
    await softDeleteAssets([result.id]);
    throw err;
  }

  await query('UPDATE generations SET result_asset_id = $2, thumbnail_asset_id = $3, composited_text = $4 WHERE id = $1', [
    ctx.gen.id,
    result.id,
    thumbnail.id,
    composed.placed.length > 0,
  ]);
  return { result, thumbnail, placed: composed.placed };
}
