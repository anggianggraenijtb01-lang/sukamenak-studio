/**
 * Admin-specific wording for API errors. The generic text of every `error_code` lives in `api/errors.ts`; this module
 * adds the context-specific explanations the admin pages need (guards on users, publish rules of templates, the write-only
 * core prompt rules). Server text is never echoed except for field messages, which the API documents as secret-free.
 */
import { getErrorMessage, isApiError } from '../../api/errors';

export interface FormError {
  message: string;
  fields: Record<string, string>;
}

/** Splits any thrown value into the banner text and the per-field messages. */
export function toFormError(err: unknown): FormError {
  if (isApiError(err)) return { message: err.message, fields: err.fieldErrors };
  return { message: getErrorMessage(err), fields: {} };
}

export type UserAction = 'update' | 'deactivate' | 'demote' | 'delete' | 'reset-password' | 'revoke';

/** The two guard errors of the users API, worded for the action that triggered them. */
export function userActionErrorMessage(err: unknown, action: UserAction): string {
  if (isApiError(err)) {
    if (err.code === 'CANNOT_MODIFY_SELF') {
      switch (action) {
        case 'reset-password':
          return 'Kata sandi akun Anda sendiri tidak bisa direset lewat panel admin. Ubah lewat menu Profil Admin.';
        case 'delete':
          return 'Anda tidak dapat menghapus akun Anda sendiri.';
        case 'deactivate':
          return 'Anda tidak dapat menonaktifkan akun Anda sendiri.';
        case 'demote':
          return 'Anda tidak dapat menurunkan peran akun Anda sendiri dari admin.';
        default:
          return 'Anda tidak dapat mengubah, menonaktifkan, atau menghapus akun Anda sendiri.';
      }
    }
    if (err.code === 'LAST_ADMIN') {
      return 'Ditolak: ini admin aktif terakhir. Jadikan pengguna lain admin terlebih dahulu sebelum menonaktifkan, menurunkan, atau menghapus akun ini.';
    }
  }
  return getErrorMessage(err);
}

export interface PublishContext {
  coreKey?: string;
  slotsWithBlank?: number;
  category?: string;
}

/** Plain-Indonesian explanation of why publishing (or saving a published template) was refused. */
export function publishErrorMessage(err: unknown, ctx: PublishContext = {}): string {
  if (isApiError(err)) {
    switch (err.code) {
      case 'CORE_PROMPT_REQUIRED':
        return `Belum bisa diterbitkan: tidak ada core prompt aktif untuk key "${ctx.coreKey ?? 'template ini'}". Buka Core Prompt Engine, kirim versi baru untuk key tersebut, lalu aktifkan.`;
      case 'BLANK_SLOT_MISMATCH':
        return `Belum bisa diterbitkan: jumlah slot yang memiliki blank_index${
          ctx.slotsWithBlank != null ? ` (${ctx.slotsWithBlank})` : ''
        } tidak sama dengan jumlah isian [___] pada core prompt aktif. Tambah atau hapus slot ber-blank, atau buat versi core prompt baru dengan jumlah isian yang sama.`;
      case 'CONTENT_POLICY_VIOLATION':
        return 'Belum bisa diterbitkan: kategori PSA wajib memiliki disclaimer yang tidak kosong. Isi disclaimer PSA di menu Content Policy terlebih dahulu.';
      case 'VALIDATION_ERROR': {
        const first = err.errors[0];
        return first
          ? `Belum bisa diterbitkan: ${first.message}. Pastikan setiap zona teks menunjuk ke slot yang masih ada.`
          : 'Belum bisa diterbitkan: ada isian template yang belum valid. Pastikan setiap zona teks menunjuk ke slot yang masih ada.';
      }
      default:
        break;
    }
  }
  return getErrorMessage(err);
}

/** Explanations for the readiness issues the template detail returns (`code` is the server's). */
export function readinessIssueMessage(code: string, serverMessage: string, ctx: PublishContext = {}): string {
  switch (code) {
    case 'CORE_PROMPT_REQUIRED':
      return `Belum ada core prompt aktif untuk key "${ctx.coreKey ?? '-'}".`;
    case 'BLANK_SLOT_MISMATCH':
      return 'Jumlah slot ber-blank_index tidak sama dengan jumlah isian [___] pada core prompt aktif.';
    case 'CONTENT_POLICY_VIOLATION':
      return 'Kategori PSA membutuhkan disclaimer PSA yang tidak kosong di Content Policy.';
    default:
      return serverMessage;
  }
}

/** Core prompt create / activate errors. The server never echoes the submitted text. */
export function corePromptErrorMessage(err: unknown): string {
  if (isApiError(err)) {
    if (err.code === 'BLANK_SLOT_MISMATCH') {
      return 'Ditolak: ada template terbit yang memakai key ini dan jumlah slot ber-blank-nya tidak sama dengan jumlah isian [___] versi tersebut. Samakan jumlahnya sebelum mengaktifkan.';
    }
    if (err.code === 'UNKNOWN_PLACEHOLDER') {
      return 'Ditolak: core prompt memakai placeholder {{...}} yang tidak dikenal. Hanya subject_lock, negative, text_zone, aspect_ratio, dan brand_palette yang diizinkan.';
    }
  }
  return getErrorMessage(err);
}
