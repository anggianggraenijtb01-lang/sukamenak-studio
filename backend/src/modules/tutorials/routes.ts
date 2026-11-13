import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import { ok } from '../../lib/response.js';
import { getValid, validate } from '../../middleware/validate.js';
import { assetUrl } from '../../storage/urls.js';

export const tutorialsRouter = Router();

const LEVELS = ['pemula', 'menengah', 'mahir'] as const;

const listSchemas = { query: z.object({ level: z.enum(LEVELS).optional() }) };
const detailSchemas = { params: z.object({ slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(100) }) };

interface TutorialRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  level: string;
}
interface SectionRow {
  id: string;
  kind: string;
  title: string;
  body_md: string;
}
interface BreakdownRow {
  id: string;
  aspect: string;
  title: string;
  description: string;
  prompt_fragment: string;
  storage_key: string | null;
}

const toTutorialDTO = (t: TutorialRow) => ({ id: t.id, slug: t.slug, title: t.title, summary: t.summary, level: t.level });
const toSectionDTO = (s: SectionRow) => ({ id: s.id, kind: s.kind, title: s.title, body_md: s.body_md });
/** `prompt_fragment` is a teaching snippet written for tutorials, unrelated to the hidden core prompts. */
const toBreakdownDTO = (b: BreakdownRow) => ({
  id: b.id,
  aspect: b.aspect,
  title: b.title,
  description: b.description,
  prompt_fragment: b.prompt_fragment,
  example_url: assetUrl(b.storage_key),
});

tutorialsRouter.get('/', validate(listSchemas), async (req, res) => {
  const { query: q } = getValid(req, listSchemas);
  const rows = await query<TutorialRow>(
    `SELECT id, slug, title, summary, level FROM tutorials
      WHERE status = 'published' AND deleted_at IS NULL AND ($1::text IS NULL OR level = $1)
      ORDER BY sort_order, title`,
    [q.level ?? null],
  );
  ok(res, rows.map(toTutorialDTO), 'Daftar tutorial');
});

tutorialsRouter.get('/:slug', validate(detailSchemas), async (req, res) => {
  const { params } = getValid(req, detailSchemas);
  const tutorial = await queryOne<TutorialRow>(
    `SELECT id, slug, title, summary, level FROM tutorials
      WHERE slug = $1 AND status = 'published' AND deleted_at IS NULL`,
    [params.slug],
  );
  if (!tutorial) throw notFound('Tutorial');

  const [sections, breakdowns] = await Promise.all([
    query<SectionRow>('SELECT id, kind, title, body_md FROM tutorial_sections WHERE tutorial_id = $1 ORDER BY sort_order', [
      tutorial.id,
    ]),
    query<BreakdownRow>(
      `SELECT b.id, b.aspect, b.title, b.description, b.prompt_fragment, a.storage_key
         FROM visual_breakdowns b LEFT JOIN assets a ON a.id = b.example_asset_id AND a.deleted_at IS NULL
        WHERE b.tutorial_id = $1 ORDER BY b.sort_order`,
      [tutorial.id],
    ),
  ]);
  ok(
    res,
    { ...toTutorialDTO(tutorial), sections: sections.map(toSectionDTO), visual_breakdowns: breakdowns.map(toBreakdownDTO) },
    'Detail tutorial',
  );
});
