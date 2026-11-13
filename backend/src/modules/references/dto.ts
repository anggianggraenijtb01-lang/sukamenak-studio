import { assetUrl } from '../../storage/urls.js';

export interface ReferenceRow {
  id: string;
  owner_id: string | null;
  role: string;
  label: string | null;
  is_library: boolean;
  expires_at: Date | null;
  created_at: Date;
  storage_key: string;
  width: number | null;
  height: number | null;
  template_slug?: string | null;
}

/** Owner view. The storage key never leaves the server: clients only get a signed, expiring URL. */
export const toReferenceDTO = (r: ReferenceRow) => ({
  id: r.id,
  role: r.role,
  label: r.label,
  url: assetUrl(r.storage_key),
  width: r.width,
  height: r.height,
  expires_at: r.expires_at,
  created_at: r.created_at,
});

export const toLibraryReferenceDTO = (r: ReferenceRow) => ({
  id: r.id,
  role: r.role,
  label: r.label,
  url: assetUrl(r.storage_key),
  width: r.width,
  height: r.height,
  template_slug: r.template_slug ?? null,
});
