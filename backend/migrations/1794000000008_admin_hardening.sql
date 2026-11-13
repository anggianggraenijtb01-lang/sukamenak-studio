-- Up Migration

-- Admin review flags on generations (Phase C). The note is operator text, never prompt content.
ALTER TABLE generations ADD COLUMN flagged_at timestamptz;
ALTER TABLE generations ADD COLUMN flagged_by uuid REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE generations ADD COLUMN flag_note text;
CREATE INDEX generations_flagged_idx ON generations (flagged_at DESC) WHERE flagged_at IS NOT NULL;

-- Access tokens issued before this instant are rejected (set by admin reset-password / revoke-sessions).
ALTER TABLE users ADD COLUMN sessions_valid_after timestamptz;

CREATE INDEX audit_logs_action_idx ON audit_logs (action, created_at DESC);

-- Down Migration
DROP INDEX IF EXISTS audit_logs_action_idx;
ALTER TABLE users DROP COLUMN IF EXISTS sessions_valid_after;
DROP INDEX IF EXISTS generations_flagged_idx;
ALTER TABLE generations DROP COLUMN IF EXISTS flag_note;
ALTER TABLE generations DROP COLUMN IF EXISTS flagged_by;
ALTER TABLE generations DROP COLUMN IF EXISTS flagged_at;
