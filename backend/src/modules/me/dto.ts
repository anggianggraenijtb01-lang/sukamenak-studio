import { assetUrl } from '../../storage/urls.js';
import { toUserDTO, type UserDTO, type UserRow } from '../auth/dto.js';

export interface MeUserRow extends UserRow {
  /** Storage key of the live avatar asset, null when the user has none. */
  avatar_storage_key: string | null;
}

export interface MeUserDTO extends UserDTO {
  avatar_url: string | null;
}

/** The auth user payload plus a signed, expiring avatar URL; the storage key never leaves the server. */
export const toMeUserDTO = (row: MeUserRow): MeUserDTO => ({
  ...toUserDTO(row),
  avatar_url: assetUrl(row.avatar_storage_key),
});
