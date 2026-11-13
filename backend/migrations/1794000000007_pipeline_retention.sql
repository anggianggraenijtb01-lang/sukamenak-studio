-- Up Migration

-- Marks a generation whose prompt-bearing fields were wiped by the retention job (90 days).
ALTER TABLE generations ADD COLUMN purged_at timestamptz;
CREATE INDEX generations_retention_idx ON generations (created_at) WHERE purged_at IS NULL;

-- Soft-deleted assets keep their row; this records when the stored file was actually removed.
ALTER TABLE assets ADD COLUMN file_deleted_at timestamptz;
CREATE INDEX assets_file_cleanup_idx ON assets (deleted_at) WHERE deleted_at IS NOT NULL AND file_deleted_at IS NULL;

-- Library lookup and per-user reference cap.
CREATE INDEX reference_assets_library_idx ON reference_assets (role) WHERE is_library AND owner_id IS NULL AND deleted_at IS NULL;

-- Down Migration
DROP INDEX IF EXISTS reference_assets_library_idx;
DROP INDEX IF EXISTS assets_file_cleanup_idx;
ALTER TABLE assets DROP COLUMN IF EXISTS file_deleted_at;
DROP INDEX IF EXISTS generations_retention_idx;
ALTER TABLE generations DROP COLUMN IF EXISTS purged_at;
