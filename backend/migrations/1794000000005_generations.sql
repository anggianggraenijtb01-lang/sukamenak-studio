-- Up Migration
CREATE TABLE usage_counters (
  user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date          date NOT NULL,
  success_count integer NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE generations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  template_id             uuid REFERENCES templates (id) ON DELETE SET NULL,
  mode                    text NOT NULL CHECK (mode IN ('i2i', 't2i')),
  subject                 text NOT NULL CHECK (subject IN ('product', 'human_model')),
  publication             text NOT NULL CHECK (publication IN ('poster', 'psa', 'social_post', 'product_shot', 'human_model')),
  status                  text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  progress_step           text CHECK (progress_step IN ('analysis', 'compose', 'generate', 'composite', 'done')),
  slot_values             jsonb NOT NULL DEFAULT '{}'::jsonb,
  remarks                 text,
  reference_inputs        jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- SECRET: the final composed prompt, encrypted. Never returned by any endpoint.
  final_prompt_ciphertext bytea,
  final_prompt_iv         bytea,
  final_prompt_auth_tag   bytea,
  used_reference_image    boolean NOT NULL DEFAULT false,
  reference_count_used    integer NOT NULL DEFAULT 0,
  composited_text         boolean NOT NULL DEFAULT false,
  degraded                boolean NOT NULL DEFAULT false,
  result_asset_id         uuid REFERENCES assets (id) ON DELETE SET NULL,
  thumbnail_asset_id      uuid REFERENCES assets (id) ON DELETE SET NULL,
  model_vision_id         uuid REFERENCES model_configs (id) ON DELETE SET NULL,
  model_image_id          uuid REFERENCES model_configs (id) ON DELETE SET NULL,
  total_cost_usd          numeric(10, 6) NOT NULL DEFAULT 0,
  duration_ms             integer,
  error_code              text,
  consent_confirmed       boolean NOT NULL DEFAULT false,
  archived_at             timestamptz,
  deleted_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX generations_user_idx ON generations (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX generations_status_idx ON generations (status) WHERE status IN ('queued', 'running');
CREATE INDEX generations_template_idx ON generations (template_id);
CREATE INDEX generations_created_idx ON generations (created_at DESC);
CREATE TRIGGER generations_set_updated_at BEFORE UPDATE ON generations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE generation_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id   uuid NOT NULL REFERENCES generations (id) ON DELETE CASCADE,
  stage           text NOT NULL CHECK (stage IN ('validate', 'analysis', 'compose', 'generate', 'composite')),
  status          text NOT NULL CHECK (status IN ('started', 'ok', 'degraded', 'failed')),
  duration_ms     integer,
  cost_usd        numeric(10, 6) NOT NULL DEFAULT 0,
  model_config_id uuid REFERENCES model_configs (id) ON DELETE SET NULL,
  error_code      text,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX generation_events_generation_idx ON generation_events (generation_id, created_at);

CREATE TABLE gallery_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id  uuid REFERENCES generations (id) ON DELETE SET NULL,
  template_id    uuid REFERENCES templates (id) ON DELETE SET NULL,
  image_asset_id uuid NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
  title          text NOT NULL,
  -- Built from slot values + remarks ONLY. This is the single prompt-like field any public endpoint may return.
  display_prompt text NOT NULL DEFAULT '',
  is_featured    boolean NOT NULL DEFAULT false,
  is_hidden      boolean NOT NULL DEFAULT false,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by     uuid REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX gallery_items_listing_idx ON gallery_items (is_featured DESC, sort_order, created_at DESC) WHERE NOT is_hidden;
CREATE INDEX gallery_items_template_idx ON gallery_items (template_id);
CREATE TRIGGER gallery_items_set_updated_at BEFORE UPDATE ON gallery_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration
DROP TABLE IF EXISTS gallery_items;
DROP TABLE IF EXISTS generation_events;
DROP TABLE IF EXISTS generations;
DROP TABLE IF EXISTS usage_counters;
