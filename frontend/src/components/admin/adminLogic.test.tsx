import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '../../api/errors';
import { flattenDiff } from '../../pages/admin/AdminAudit';
import { parseTerms, normalizeTerm } from '../../pages/admin/AdminPolicy';
import { initialsOf } from '../../pages/admin/AdminProfile';
import { consentNoteError } from '../../pages/admin/AdminReferences';
import { corePromptErrorMessage, publishErrorMessage, readinessIssueMessage, toFormError, userActionErrorMessage } from './adminErrors';
import { failureLabel, formatDuration, formatPercent } from './format';
import { TempPasswordModal } from './TempPasswordModal';
import { parseAspectRatio, rectFromPoints } from './TextZoneVisualizer';
import { validateZoneRect } from './ZonesEditor';
import { ConfirmModal, Modal } from './ui';

const err = (status: number, code: string, errors: Array<{ field: string; message: string }> = []) => new ApiError({ status, code, errors });

describe('error mapping', () => {
  it('words the guard errors for the action that triggered them', () => {
    expect(userActionErrorMessage(err(409, 'CANNOT_MODIFY_SELF'), 'delete')).toMatch(/menghapus akun Anda sendiri/);
    expect(userActionErrorMessage(err(409, 'CANNOT_MODIFY_SELF'), 'reset-password')).toMatch(/Profil Admin/);
    expect(userActionErrorMessage(err(409, 'CANNOT_MODIFY_SELF'), 'deactivate')).toMatch(/menonaktifkan/);
    expect(userActionErrorMessage(err(409, 'LAST_ADMIN'), 'demote')).toMatch(/admin aktif terakhir/);
    expect(userActionErrorMessage(new Error('boom'), 'update')).toMatch(/Terjadi kesalahan/);
  });

  it('explains every publish refusal in plain Indonesian', () => {
    const ctx = { coreKey: 'product.poster', slotsWithBlank: 2 };
    expect(publishErrorMessage(err(422, 'CORE_PROMPT_REQUIRED'), ctx)).toContain('"product.poster"');
    expect(publishErrorMessage(err(422, 'BLANK_SLOT_MISMATCH'), ctx)).toMatch(/\(2\).*\[___\]/);
    expect(publishErrorMessage(err(422, 'CONTENT_POLICY_VIOLATION'), ctx)).toMatch(/PSA.*disclaimer/);
    expect(publishErrorMessage(err(400, 'VALIDATION_ERROR', [{ field: 'text_zones', message: 'zona menunjuk slot hilang' }]), ctx)).toMatch(/zona menunjuk slot hilang/);
    // 5xx text never leaks.
    expect(publishErrorMessage(err(500, 'INTERNAL_ERROR'), ctx)).toMatch(/kesalahan pada server/i);
  });

  it('maps readiness codes and core prompt errors', () => {
    expect(readinessIssueMessage('BLANK_SLOT_MISMATCH', 'x')).toMatch(/blank_index/);
    expect(readinessIssueMessage('OTHER', 'pesan server')).toBe('pesan server');
    expect(corePromptErrorMessage(err(422, 'UNKNOWN_PLACEHOLDER'))).toMatch(/subject_lock/);
    expect(corePromptErrorMessage(err(422, 'BLANK_SLOT_MISMATCH'))).toMatch(/template terbit/);
  });

  it('splits an ApiError into a banner text and field messages', () => {
    const e = toFormError(err(400, 'VALIDATION_ERROR', [{ field: 'slug', message: 'Sudah dipakai' }]));
    expect(e.fields).toEqual({ slug: 'Sudah dipakai' });
    expect(e.message).toMatch(/belum sesuai/);
  });
});

describe('formatters', () => {
  it('formats rates, durations and failure codes', () => {
    expect(formatPercent(null)).toBe('-');
    expect(formatPercent(0.985)).toMatch(/98,5%/);
    expect(formatDuration(850)).toBe('850 ms');
    expect(formatDuration(1830)).toBe('1.8 dtk');
    expect(failureLabel('PROVIDER_TIMEOUT')).toMatch(/terlalu lama/);
    expect(failureLabel('UNKNOWN_CODE')).toBeTruthy();
  });
});

describe('policy terms', () => {
  it('normalises, splits and de-duplicates blocked terms', () => {
    expect(normalizeTerm('  Judi   ONLINE ')).toBe('judi online');
    expect(parseTerms('Judol, slot  gacor\nJUDOL\n, ', ['judi online'])).toEqual({ added: ['judol', 'slot gacor'], skipped: 1 });
    expect(parseTerms('judi online', ['judi online'])).toEqual({ added: [], skipped: 1 });
  });
});

describe('small rules', () => {
  it('requires a consent note for human_model references only', () => {
    expect(consentNoteError('human_model', '   ')).toMatch(/wajib/);
    expect(consentNoteError('human_model', 'Disetujui Bu Ani, 1 Nov 2026')).toBeNull();
    expect(consentNoteError('product', '')).toBeNull();
  });

  it('builds initials instead of a photo', () => {
    expect(initialsOf('Admin Utama')).toBe('AU');
    expect(initialsOf('  budi  ')).toBe('B');
    expect(initialsOf('')).toBe('A');
  });

  it('parses aspect ratios and normalises drawn rectangles', () => {
    expect(parseAspectRatio('16:9')).toEqual([16, 9]);
    expect(parseAspectRatio('bogus')).toEqual([4, 5]);
    expect(rectFromPoints({ x: 0.6, y: 0.9 }, { x: 0.2, y: 0.1 })).toEqual({ x: 0.2, y: 0.1, w: 0.4, h: 0.8 });
    expect(rectFromPoints({ x: -1, y: 0 }, { x: 2, y: 0.5 })).toEqual({ x: 0, y: 0, w: 1, h: 0.5 });
  });

  it('applies the server rule x + w <= 1 and y + h <= 1 to text zones', () => {
    expect(validateZoneRect({ x: 0.1, y: 0.1, w: 0.8, h: 0.2 })).toEqual({});
    expect(validateZoneRect({ x: 0.5, y: 0.1, w: 0.6, h: 0.2 }).w).toMatch(/X \+ lebar/);
    expect(validateZoneRect({ x: 0.1, y: 0.9, w: 0.2, h: 0.2 }).h).toMatch(/Y \+ tinggi/);
    expect(validateZoneRect({ x: 0.1, y: 0.1, w: 0, h: 0.2 }).w).toBeTruthy();
  });
});

describe('dialogs', () => {
  it('TempPasswordModal shows the secret and reports close', () => {
    const onClose = vi.fn();
    render(<TempPasswordModal email="a@x.id" password="Abc-123-xyz" onClose={onClose} />);
    expect(screen.getByTestId('temp-password').textContent).toBe('Abc-123-xyz');
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Modal does not close while busy', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Sibuk" onClose={onClose} busy>
        isi
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ConfirmModal runs the action, closes on success and shows a formatted error on failure', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockRejectedValueOnce(err(409, 'LAST_ADMIN')).mockResolvedValueOnce(undefined);
    render(<ConfirmModal title="Yakin?" message="Hapus" confirmLabel="Ya" onConfirm={onConfirm} onClose={onClose} formatError={(e) => userActionErrorMessage(e, 'delete')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ya' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/admin aktif terakhir/);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ya' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('ConfirmModal still reports a failure under React StrictMode (double mount in development)', async () => {
    const onConfirm = vi.fn().mockRejectedValue(err(409, 'CANNOT_MODIFY_SELF'));
    render(
      <React.StrictMode>
        <ConfirmModal title="Yakin?" message="Hapus" confirmLabel="Ya" onConfirm={onConfirm} onClose={() => undefined} formatError={(e) => userActionErrorMessage(e, 'delete')} />
      </React.StrictMode>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ya' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/menghapus akun Anda sendiri/);
    expect((screen.getByRole('button', { name: 'Ya' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('flattens the audit "changed" group into one row per field and leaves other facts alone', () => {
    expect(flattenDiff({ changed: { name: { from: 'a', to: 'b' }, role: { from: 'x', to: 'y' } } })).toEqual([
      ['name', { from: 'a', to: 'b' }],
      ['role', { from: 'x', to: 'y' }],
    ]);
    expect(flattenDiff({ key: 'product.poster', version: 2 })).toEqual([
      ['key', 'product.poster'],
      ['version', 2],
    ]);
  });
});
