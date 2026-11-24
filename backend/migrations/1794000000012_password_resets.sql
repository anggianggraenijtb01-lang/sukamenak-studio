-- Up Migration

-- Self-service password reset ("lupa sandi"). Only the SHA-256 of the emailed token is stored, so a
-- database read does not yield a usable link. A token is single use (used_at) and short lived (expires_at).
CREATE TABLE password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  requested_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_id_idx ON password_resets (user_id);
CREATE INDEX password_resets_expires_at_idx ON password_resets (expires_at);

-- Down Migration

DROP TABLE IF EXISTS password_resets;
