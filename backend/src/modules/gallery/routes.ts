import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { ok, pageMeta } from '../../lib/response.js';
import { getValid, validate } from '../../middleware/validate.js';
import { assetUrl } from '../../storage/urls.js';

export const galleryRouter = Router();

const listSchemas = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    template: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .max(100)
      .optional(),
    featured: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
  }),
};

interface GalleryRow {
  id: string;
  title: string;
  display_prompt: string;
  is_featured: boolean;
  created_at: Date;
  storage_key: string;
  template_slug: string | null;
  template_name: string | null;
  template_category: string | null;
}

/** `display_prompt` (slot values + remarks only) is the one prompt-like field the public API exposes. */
const toGalleryItemDTO = (r: GalleryRow) => ({
  id: r.id,
  title: r.title,
  image_url: assetUrl(r.storage_key),
  display_prompt: r.display_prompt,
  is_featured: r.is_featured,
  template: r.template_slug ? { slug: r.template_slug, name: r.template_name, category: r.template_category } : null,
  created_at: r.created_at,
});

galleryRouter.get('/', validate(listSchemas), async (req, res) => {
  const { query: q } = getValid(req, listSchemas);
  const where = ['NOT g.is_hidden'];
  const params: unknown[] = [];
  if (q.template) {
    params.push(q.template);
    where.push(`t.slug = $${params.length}`);
  }
  if (q.featured !== undefined) {
    params.push(q.featured);
    where.push(`g.is_featured = $${params.length}`);
  }
  const from = `FROM gallery_items g
      JOIN assets a ON a.id = g.image_asset_id AND a.deleted_at IS NULL
      LEFT JOIN templates t ON t.id = g.template_id AND t.deleted_at IS NULL
     WHERE ${where.join(' AND ')}`;

  const total = (await queryOne<{ n: number }>(`SELECT count(*) AS n ${from}`, params))?.n ?? 0;
  const rows = await query<GalleryRow>(
    `SELECT g.id, g.title, g.display_prompt, g.is_featured, g.created_at, a.storage_key,
            t.slug AS template_slug, t.name AS template_name, t.category AS template_category
       ${from}
      ORDER BY g.is_featured DESC, g.sort_order ASC, g.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, q.limit, (q.page - 1) * q.limit],
  );
  ok(res, rows.map(toGalleryItemDTO), 'Galeri', pageMeta(q.page, q.limit, total));
});
