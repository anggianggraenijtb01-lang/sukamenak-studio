-- Up Migration

-- True while a core prompt is the committed stand-in (see src/engine/placeholderCorePrompt.ts) rather than a real
-- prompt. Computed once, when the prompt is written and its body is in memory, so admin reads never have to decrypt.
-- Rows that exist before this migration were written by hand or by an older seed: they are not stand-ins.
ALTER TABLE core_prompts ADD COLUMN is_placeholder boolean NOT NULL DEFAULT false;

-- Down Migration

ALTER TABLE core_prompts DROP COLUMN is_placeholder;
