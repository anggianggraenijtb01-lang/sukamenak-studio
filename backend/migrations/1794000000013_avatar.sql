-- Up Migration

-- Profile photos are stored as assets of their own kind so retention and ownership rules apply to them
-- like any other upload. The kind CHECK was last widened by 1794000000010 (video).
ALTER TABLE assets DROP CONSTRAINT assets_kind_check;
ALTER TABLE assets ADD CONSTRAINT assets_kind_check
  CHECK (kind IN ('reference', 'result', 'thumbnail', 'preview', 'gallery', 'logo', 'video', 'avatar', 'other'));

ALTER TABLE users ADD COLUMN avatar_asset_id uuid REFERENCES assets (id) ON DELETE SET NULL;

-- Down Migration

ALTER TABLE users DROP COLUMN IF EXISTS avatar_asset_id;
-- Avatar rows would violate the narrower CHECK. They become soft-deleted `other` assets, so the
-- retention job still removes their files instead of leaving them orphaned in storage.
UPDATE assets SET kind = 'other', deleted_at = COALESCE(deleted_at, now()) WHERE kind = 'avatar';
ALTER TABLE assets DROP CONSTRAINT assets_kind_check;
ALTER TABLE assets ADD CONSTRAINT assets_kind_check
  CHECK (kind IN ('reference', 'result', 'thumbnail', 'preview', 'gallery', 'logo', 'video', 'other'));
