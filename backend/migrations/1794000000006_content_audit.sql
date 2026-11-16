-- Up Migration
CREATE TABLE user_prompts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text NOT NULL,
  source     text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'imported')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_prompts_user_idx ON user_prompts (user_id, updated_at DESC);
CREATE TRIGGER user_prompts_set_updated_at BEFORE UPDATE ON user_prompts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE prompt_improvements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  input_text      text NOT NULL,
  output_text     text NOT NULL,
  score_before    integer NOT NULL CHECK (score_before BETWEEN 0 AND 100),
  score_after     integer NOT NULL CHECK (score_after BETWEEN 0 AND 100),
  model_config_id uuid REFERENCES model_configs (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prompt_improvements_user_idx ON prompt_improvements (user_id, created_at DESC);

CREATE TABLE tutorials (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title      text NOT NULL,
  summary    text NOT NULL DEFAULT '',
  level      text NOT NULL DEFAULT 'pemula' CHECK (level IN ('pemula', 'menengah', 'mahir')),
  status     text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
  deleted_at timestamptz
);
CREATE INDEX tutorials_listing_idx ON tutorials (status, sort_order) WHERE deleted_at IS NULL;
CREATE TRIGGER tutorials_set_updated_at BEFORE UPDATE ON tutorials FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE tutorial_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id uuid NOT NULL REFERENCES tutorials (id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('what_to_do', 'do', 'dont', 'tip', 'example')),
  title       text NOT NULL,
  body_md     text NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tutorial_sections_tutorial_idx ON tutorial_sections (tutorial_id, sort_order);
CREATE TRIGGER tutorial_sections_set_updated_at BEFORE UPDATE ON tutorial_sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE visual_breakdowns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id      uuid REFERENCES tutorials (id) ON DELETE CASCADE,
  aspect           text NOT NULL CHECK (aspect IN ('style', 'color', 'gradient', 'angle', 'lighting', 'composition')),
  title            text NOT NULL,
  description      text NOT NULL DEFAULT '',
  prompt_fragment  text NOT NULL DEFAULT '',
  example_asset_id uuid REFERENCES assets (id) ON DELETE SET NULL,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visual_breakdowns_tutorial_idx ON visual_breakdowns (tutorial_id, sort_order);
CREATE TRIGGER visual_breakdowns_set_updated_at BEFORE UPDATE ON visual_breakdowns FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- diff must never contain SECRET fields (core prompt bodies, final prompts, password hashes).
CREATE TABLE audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  text,
  diff       jsonb,
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity, entity_id);

-- Down Migration
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS visual_breakdowns;
DROP TABLE IF EXISTS tutorial_sections;
DROP TABLE IF EXISTS tutorials;
DROP TABLE IF EXISTS prompt_improvements;
DROP TABLE IF EXISTS user_prompts;
