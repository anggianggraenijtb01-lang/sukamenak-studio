export interface CorePromptMetaRow {
  id: string;
  key: string;
  version: number;
  subject: string;
  publication: string;
  blank_count: number;
  is_active: boolean;
  created_at: Date;
  created_by: string | null;
  created_by_name: string | null;
  templates_using: number;
}

/**
 * The ONLY column list used to read core prompts for responses: no body_ciphertext, body_iv or
 * body_auth_tag. Keep it that way; decryption happens in dedicated server-side functions only.
 */
export const CORE_PROMPT_META_SELECT = `
  SELECT c.id, c.key, c.version, c.subject, c.publication, c.blank_count, c.is_active, c.created_at, c.created_by,
         u.name AS created_by_name,
         (SELECT count(*) FROM templates t WHERE t.core_prompt_key = c.key AND t.deleted_at IS NULL) AS templates_using
    FROM core_prompts c
    LEFT JOIN users u ON u.id = c.created_by`;

/** Metadata only. There is deliberately no field that could carry the body, a preview or ciphertext. */
export const toCorePromptMetaDTO = (r: CorePromptMetaRow) => ({
  id: r.id,
  key: r.key,
  version: r.version,
  subject: r.subject,
  publication: r.publication,
  blank_count: r.blank_count,
  is_active: r.is_active,
  templates_using: r.templates_using,
  created_at: r.created_at,
  created_by: r.created_by ? { id: r.created_by, name: r.created_by_name } : null,
});
