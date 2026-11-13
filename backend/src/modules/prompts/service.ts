import { query, queryOne } from '../../db/pool.js';
import { withTimeout } from '../../lib/async.js';
import { AppError, notFound } from '../../lib/errors.js';
import { analyzePrompt, heuristicImprove, type PromptAnalysis } from '../../engine/promptAnalysis.js';
import { assertContentPolicy, findBlockedTerms } from '../../engine/policy.js';
import { getProvider, listActiveModels } from '../../providers/registry.js';
import { getActivePolicy } from '../shared/settings.js';

const MAX_SAVED_PROMPTS = 200;

export interface UserPromptRow {
  id: string;
  title: string;
  body: string;
  source: string;
  created_at: Date;
  updated_at: Date;
}

/** Explicit allowlist; the row's user_id is never returned. */
export const toUserPromptDTO = (r: UserPromptRow) => ({
  id: r.id,
  title: r.title,
  body: r.body,
  source: r.source,
  created_at: r.created_at,
  updated_at: r.updated_at,
});

const PROMPT_COLUMNS = 'id, title, body, source, created_at, updated_at';

export async function listUserPrompts(userId: string, page: number, limit: number) {
  const total = (await queryOne<{ n: number }>('SELECT count(*) AS n FROM user_prompts WHERE user_id = $1', [userId]))?.n ?? 0;
  const rows = await query<UserPromptRow>(
    `SELECT ${PROMPT_COLUMNS} FROM user_prompts WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, (page - 1) * limit],
  );
  return { items: rows.map(toUserPromptDTO), total };
}

export async function getUserPrompt(userId: string, id: string) {
  const row = await queryOne<UserPromptRow>(`SELECT ${PROMPT_COLUMNS} FROM user_prompts WHERE id = $1 AND user_id = $2`, [id, userId]);
  if (!row) throw notFound('Prompt');
  return toUserPromptDTO(row);
}

export async function createUserPrompt(userId: string, input: { title: string; body: string; source: string }) {
  const policy = await getActivePolicy();
  assertContentPolicy({ title: input.title, body: input.body }, policy.blocked_terms);

  const count = (await queryOne<{ n: number }>('SELECT count(*) AS n FROM user_prompts WHERE user_id = $1', [userId]))?.n ?? 0;
  if (count >= MAX_SAVED_PROMPTS) {
    throw new AppError('VALIDATION_ERROR', `Batas ${MAX_SAVED_PROMPTS} prompt tersimpan tercapai`);
  }
  const row = await queryOne<UserPromptRow>(
    `INSERT INTO user_prompts (user_id, title, body, source) VALUES ($1, $2, $3, $4) RETURNING ${PROMPT_COLUMNS}`,
    [userId, input.title, input.body, input.source],
  );
  return toUserPromptDTO(row as UserPromptRow);
}

export async function updateUserPrompt(userId: string, id: string, input: { title?: string; body?: string }) {
  const policy = await getActivePolicy();
  assertContentPolicy({ title: input.title, body: input.body }, policy.blocked_terms);
  const row = await queryOne<UserPromptRow>(
    `UPDATE user_prompts SET title = COALESCE($3, title), body = COALESCE($4, body)
      WHERE id = $1 AND user_id = $2 RETURNING ${PROMPT_COLUMNS}`,
    [id, userId, input.title ?? null, input.body ?? null],
  );
  if (!row) throw notFound('Prompt');
  return toUserPromptDTO(row);
}

export async function deleteUserPrompt(userId: string, id: string): Promise<void> {
  const rows = await query('DELETE FROM user_prompts WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  if (rows.length === 0) throw notFound('Prompt');
}

export const analyze = (text: string): PromptAnalysis => analyzePrompt(text);

export interface ImproveResult {
  improved_text: string;
  score_before: number;
  score_after: number;
  source: 'model' | 'heuristic';
  suggestions: string[];
}

/**
 * Improves a user's own prompt. Uses the highest-priority active `text` model that has a registered
 * adapter; any failure, blocked output or empty output falls back to the deterministic heuristic.
 */
export async function improve(userId: string, text: string): Promise<ImproveResult> {
  const policy = await getActivePolicy();
  assertContentPolicy({ text }, policy.blocked_terms);

  const before = analyzePrompt(text);
  let improved: string | null = null;
  let source: 'model' | 'heuristic' = 'heuristic';
  let modelConfigId: string | null = null;

  for (const model of await listActiveModels('text')) {
    const adapter = getProvider(model.provider);
    if (!adapter?.improveText) continue;
    try {
      const result = await withTimeout(adapter.improveText(model, { text }), model.timeout_ms);
      const candidate = result.text.trim();
      if (candidate && findBlockedTerms([candidate], policy.blocked_terms).length === 0) {
        improved = candidate;
        source = result.source;
        modelConfigId = model.id;
        break;
      }
    } catch {
      // Try the next configured model, then the heuristic. The error is intentionally not surfaced.
    }
  }

  if (!improved) {
    improved = heuristicImprove(text).text || text.trim();
    source = 'heuristic';
    modelConfigId = null;
  }

  const after = analyzePrompt(improved);
  await query(
    `INSERT INTO prompt_improvements (user_id, input_text, output_text, score_before, score_after, model_config_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, text, improved, before.score, after.score, modelConfigId],
  );
  return {
    improved_text: improved,
    score_before: before.score,
    score_after: after.score,
    source,
    suggestions: after.suggestions,
  };
}
