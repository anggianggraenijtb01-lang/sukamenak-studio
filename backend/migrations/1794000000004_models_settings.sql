-- Up Migration
CREATE TABLE model_configs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL UNIQUE,
  provider          text NOT NULL CHECK (provider IN ('mock', 'openai_compat', 'gemini', 'fal')),
  capability        text NOT NULL CHECK (capability IN ('vision', 'text', 't2i', 'i2i')),
  model_id          text NOT NULL,
  base_url          text,
  -- Name of the environment variable holding the API key, never the key itself.
  api_key_env       text CHECK (api_key_env IS NULL OR api_key_env ~ '^[A-Z][A-Z0-9_]*$'),
  is_default        boolean NOT NULL DEFAULT false,
  is_active         boolean NOT NULL DEFAULT false,
  priority          integer NOT NULL DEFAULT 100,
  cost_per_call_usd numeric(10, 6) NOT NULL DEFAULT 0 CHECK (cost_per_call_usd >= 0),
  timeout_ms        integer NOT NULL DEFAULT 60000 CHECK (timeout_ms > 0),
  last_test_at      timestamptz,
  last_test_ok      boolean,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by        uuid REFERENCES users (id) ON DELETE SET NULL,
  deleted_at        timestamptz,
  CHECK (NOT is_default OR is_active)
);
-- Exactly one default model per capability.
CREATE UNIQUE INDEX model_configs_one_default_per_capability ON model_configs (capability) WHERE is_default AND deleted_at IS NULL;
CREATE INDEX model_configs_lookup_idx ON model_configs (capability, is_active, priority) WHERE deleted_at IS NULL;
CREATE TRIGGER model_configs_set_updated_at BEFORE UPDATE ON model_configs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL
);
CREATE TRIGGER app_settings_set_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE brand_identities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  logo_asset_id uuid REFERENCES assets (id) ON DELETE SET NULL,
  palette       jsonb NOT NULL DEFAULT '[]'::jsonb,
  font_family   text,
  disclaimer    text,
  is_default    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by    uuid REFERENCES users (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX brand_identities_one_default ON brand_identities ((true)) WHERE is_default;
CREATE TRIGGER brand_identities_set_updated_at BEFORE UPDATE ON brand_identities FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE content_policies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  blocked_terms    text[] NOT NULL DEFAULT '{}',
  moderation_level text NOT NULL DEFAULT 'standard' CHECK (moderation_level IN ('lenient', 'standard', 'strict')),
  -- Per publication category; the `psa` disclaimer is mandatory.
  disclaimers      jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by       uuid REFERENCES users (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX content_policies_one_active ON content_policies ((true)) WHERE is_active;
CREATE TRIGGER content_policies_set_updated_at BEFORE UPDATE ON content_policies FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration
DROP TABLE IF EXISTS content_policies;
DROP TABLE IF EXISTS brand_identities;
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS model_configs;
