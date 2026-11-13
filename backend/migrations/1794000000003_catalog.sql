-- Up Migration

-- Core prompts are SECRET: only ciphertext (AES-256-GCM) is stored. At most one active version per key.
CREATE TABLE core_prompts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key              text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  version          integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  subject          text NOT NULL CHECK (subject IN ('product', 'human_model')),
  publication      text NOT NULL CHECK (publication IN ('poster', 'psa', 'social_post', 'product_shot', 'human_model')),
  body_ciphertext  bytea NOT NULL,
  body_iv          bytea NOT NULL,
  body_auth_tag    bytea NOT NULL,
  blank_count      integer NOT NULL CHECK (blank_count >= 0),
  is_active        boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  UNIQUE (key, version)
);
CREATE UNIQUE INDEX core_prompts_one_active_per_key ON core_prompts (key) WHERE is_active;
CREATE TRIGGER core_prompts_set_updated_at BEFORE UPDATE ON core_prompts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text NOT NULL,
  description      text NOT NULL DEFAULT '',
  category         text NOT NULL CHECK (category IN ('poster', 'psa', 'social_post', 'product_shot', 'human_model')),
  mode             text NOT NULL CHECK (mode IN ('i2i', 't2i', 'both')),
  subject          text NOT NULL CHECK (subject IN ('product', 'human_model')),
  aspect_ratio     text NOT NULL DEFAULT '4:5' CHECK (aspect_ratio ~ '^[0-9]{1,2}:[0-9]{1,2}$'),
  core_prompt_key  text NOT NULL,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  preview_asset_id uuid REFERENCES assets (id) ON DELETE SET NULL,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  deleted_at       timestamptz
);
CREATE INDEX templates_listing_idx ON templates (status, sort_order, name) WHERE deleted_at IS NULL;
CREATE INDEX templates_core_prompt_key_idx ON templates (core_prompt_key);
CREATE TRIGGER templates_set_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A slot with a blank_index fills the n-th `[___]` of the core prompt. A slot without one
-- (title, CTA, ...) is applied by the application onto a text zone, never sent to the model.
CREATE TABLE template_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid NOT NULL REFERENCES templates (id) ON DELETE CASCADE,
  key           text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  label         text NOT NULL,
  type          text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'color', 'select', 'textarea')),
  blank_index   integer CHECK (blank_index IS NULL OR blank_index >= 1),
  required      boolean NOT NULL DEFAULT false,
  default_value text,
  options       jsonb,
  max_length    integer CHECK (max_length IS NULL OR max_length > 0),
  vision_role   text CHECK (vision_role IN ('product', 'human_model', 'font', 'color', 'lighting', 'pose', 'background', 'style')),
  source_hint   text,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, key)
);
CREATE UNIQUE INDEX template_slots_blank_index_uniq ON template_slots (template_id, blank_index) WHERE blank_index IS NOT NULL;
CREATE TRIGGER template_slots_set_updated_at BEFORE UPDATE ON template_slots FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Rectangles are fractions (0-1) of the output image.
CREATE TABLE text_zones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid NOT NULL,
  slot_key        text NOT NULL,
  x               numeric(5, 4) NOT NULL CHECK (x >= 0 AND x <= 1),
  y               numeric(5, 4) NOT NULL CHECK (y >= 0 AND y <= 1),
  w               numeric(5, 4) NOT NULL CHECK (w > 0 AND w <= 1),
  h               numeric(5, 4) NOT NULL CHECK (h > 0 AND h <= 1),
  align           text NOT NULL DEFAULT 'center' CHECK (align IN ('left', 'center', 'right')),
  font_family     text NOT NULL DEFAULT 'Inter',
  font_weight     integer NOT NULL DEFAULT 700 CHECK (font_weight BETWEEN 100 AND 900),
  font_size_ratio numeric(5, 4) NOT NULL DEFAULT 0.0500 CHECK (font_size_ratio > 0 AND font_size_ratio <= 1),
  color           text NOT NULL DEFAULT '#FFFFFF',
  max_lines       integer NOT NULL DEFAULT 2 CHECK (max_lines >= 1),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, slot_key),
  CHECK (x + w <= 1.0001 AND y + h <= 1.0001),
  FOREIGN KEY (template_id, slot_key) REFERENCES template_slots (template_id, key) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TRIGGER text_zones_set_updated_at BEFORE UPDATE ON text_zones FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Library references (is_library) can be attached to a template as visible examples via template_id.
CREATE TABLE reference_assets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid REFERENCES users (id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('product', 'human_model', 'font', 'color', 'lighting', 'pose', 'background', 'style')),
  asset_id     uuid NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
  template_id  uuid REFERENCES templates (id) ON DELETE SET NULL,
  label        text,
  consent_note text,
  is_library   boolean NOT NULL DEFAULT false,
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  CHECK (role <> 'human_model' OR (consent_note IS NOT NULL AND length(btrim(consent_note)) > 0))
);
CREATE INDEX reference_assets_owner_idx ON reference_assets (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX reference_assets_template_idx ON reference_assets (template_id) WHERE is_library AND deleted_at IS NULL;
CREATE INDEX reference_assets_expiry_idx ON reference_assets (expires_at) WHERE expires_at IS NOT NULL;

-- Down Migration
DROP TABLE IF EXISTS reference_assets;
DROP TABLE IF EXISTS text_zones;
DROP TABLE IF EXISTS template_slots;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS core_prompts;
