/**
 * Admin Operator Controller (src/controllers/adminController.ts)
 * Mengelola operasi Core Prompt AES-256-GCM, CRUD Template & Text Zone,
 * serta Model Switcher tanpa redeploy.
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

