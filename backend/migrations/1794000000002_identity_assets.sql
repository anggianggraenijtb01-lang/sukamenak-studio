-- Up Migration
CREATE TABLE users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                citext NOT NULL UNIQUE,
  password_hash        text NOT NULL,
  name                 text NOT NULL,
  role                 text NOT NULL DEFAULT 'creator' CHECK (role IN ('creator', 'admin')),
  is_active            boolean NOT NULL DEFAULT true,
  daily_limit_override integer CHECK (daily_limit_override IS NULL OR daily_limit_override >= 0),
  last_login_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by           uuid REFERENCES users (id) ON DELETE SET NULL,
  deleted_at           timestamptz
);
CREATE INDEX users_role_idx ON users (role) WHERE deleted_at IS NULL;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Refresh token rotation with reuse detection. `id` equals the JWT `jti`; only the sha256 of the token is stored.
CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  family_id   uuid NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  replaced_by uuid REFERENCES refresh_tokens (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_expires_idx ON refresh_tokens (expires_at);

-- Generic file table referenced by every other table that holds an image.
CREATE TABLE assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key text NOT NULL UNIQUE,
  mime        text NOT NULL,
  bytes       bigint NOT NULL CHECK (bytes >= 0),
  width       integer,
  height      integer,
  owner_id    uuid REFERENCES users (id) ON DELETE SET NULL,
  kind        text NOT NULL DEFAULT 'other'
              CHECK (kind IN ('reference', 'result', 'thumbnail', 'preview', 'gallery', 'logo', 'other')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX assets_owner_idx ON assets (owner_id);
CREATE INDEX assets_deleted_idx ON assets (deleted_at) WHERE deleted_at IS NOT NULL;

-- Down Migration
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;
