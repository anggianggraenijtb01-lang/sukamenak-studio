/**
 * Generation Controller (src/controllers/generationController.ts)
 * Mengelola orkestrasi permintaan generasi visual Creator Studio.
 */

import {
  enqueueGenerationJob,
  GenerationJobPayload,
  GenerationJobResult,
  StepperProgressEvent,
} from '../workers/bullmqQueue';

export async function handleStudioGenerateRequest(
  payload: GenerationJobPayload,
  onStepperUpdate: (event: StepperProgressEvent) => void
): Promise<GenerationJobResult> {
  if (!payload.title.trim()) {
    throw new Error('Judul konten wajib diisi sebelum melakukan generasi visual.');
  }
  if (payload.subjectType === 'Human Model' && !payload.consentGiven) {
    throw new Error('Wajib menyetujui kepatuhan UU PDP No. 27/2022 untuk penggunaan foto manusia.');
  }
  return enqueueGenerationJob(payload, onStepperUpdate);
}

