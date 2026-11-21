-- Up Migration

-- Video is a render of an existing finished generation (poster -> reel), not a model capability:
-- model_configs.capability stays vision|text|t2i|i2i.
ALTER TABLE assets DROP CONSTRAINT assets_kind_check;
ALTER TABLE assets ADD CONSTRAINT assets_kind_check
  CHECK (kind IN ('reference', 'result', 'thumbnail', 'preview', 'gallery', 'logo', 'video', 'other'));

CREATE TABLE video_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id    uuid NOT NULL REFERENCES generations (id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  composition      text NOT NULL DEFAULT 'story-promo',
  status           text NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'rendering', 'done', 'failed')),
  -- Poster key, slot text, palette and duration ONLY. No prompt, no ciphertext, no model field.
  props            jsonb NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 3 AND 30),
  width            integer NOT NULL DEFAULT 1080 CHECK (width > 0),
  height           integer NOT NULL DEFAULT 1920 CHECK (height > 0),
  fps              integer NOT NULL DEFAULT 30 CHECK (fps > 0),
  progress         smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  render_ms        integer,
  result_asset_id  uuid REFERENCES assets (id) ON DELETE SET NULL,
  error_code       text,
  attempts         smallint NOT NULL DEFAULT 0,
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX video_jobs_user_idx ON video_jobs (user_id, created_at DESC);
CREATE INDEX video_jobs_status_idx ON video_jobs (status) WHERE status IN ('queued', 'rendering');
CREATE INDEX video_jobs_retention_idx ON video_jobs (created_at) WHERE deleted_at IS NULL;

-- One render per generation at a time: a double click cannot start (and pay for) two renders.
CREATE UNIQUE INDEX video_jobs_one_active_per_generation
  ON video_jobs (generation_id) WHERE status IN ('queued', 'rendering') AND deleted_at IS NULL;

-- Down Migration

DROP INDEX IF EXISTS video_jobs_one_active_per_generation;
DROP INDEX IF EXISTS video_jobs_retention_idx;
DROP INDEX IF EXISTS video_jobs_status_idx;
DROP INDEX IF EXISTS video_jobs_user_idx;
DROP TABLE IF EXISTS video_jobs;
ALTER TABLE assets DROP CONSTRAINT assets_kind_check;
ALTER TABLE assets ADD CONSTRAINT assets_kind_check
  CHECK (kind IN ('reference', 'result', 'thumbnail', 'preview', 'gallery', 'logo', 'other'));
