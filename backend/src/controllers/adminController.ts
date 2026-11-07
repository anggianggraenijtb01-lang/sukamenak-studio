/**
 * Admin Operator Controller (src/controllers/adminController.ts)
 * Mengelola operasi Core Prompt AES-256-GCM (F-14), CRUD Template & Text Zone (F-12, F-13),
 * serta Model Switcher tanpa redeploy (F-16).
 */

import {
  encryptMasterPrompt,
  EncryptedPromptRecord,
  renderTestCorePromptPreview,
} from '../services/aesEncryption';

export async function updateEncryptedCorePrompt(newMasterPrompt: string): Promise<EncryptedPromptRecord> {
  if (!newMasterPrompt.includes('[___]')) {
    throw new Error('Master prompt wajib memiliki minimal satu placeholder [___] untuk injeksi slot.');
  }
  return encryptMasterPrompt(newMasterPrompt);
}

export function previewCompiledCorePrompt(slots: {
  title: string;
  subjectType: string;
  visionSummary: string;
  textZone: string;
}) {
  return renderTestCorePromptPreview(slots);
}

