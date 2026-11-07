/**
 * BullMQ Async Worker & Stepper Queue Simulation (bullmqQueue.ts)
 * Menjalankan 4 tahapan pipeline secara asinkron dan mengirimkan event update ke UI Stepper (F-10):
 * 1. Analisis Vision
 * 2. Merangkai Prompt Tersembunyi
 * 3. Generasi i2i
 * 4. Tempel Teks Layout sharp
 */

import { analyzeReferenceImage } from '../pipelines/vision';
import { runI2IGeneration } from '../pipelines/i2i';
import { renderSharpTextOverlayCanvas } from '../pipelines/textOverlaySharp';
import { renderTestCorePromptPreview } from '../services/aesEncryption';

export type StepperStageId = 1 | 2 | 3 | 4;

export interface StepperProgressEvent {
  step: StepperStageId;
  label: string;
  detail: string;
  status: 'running' | 'completed';
}

export interface GenerationJobPayload {
  mode: 'i2i' | 't2i';
  subjectType: 'Produk UMKM' | 'Human Model';
  title: string;
  remarks: string;
  templateId: string;
  categoryBadge: string;
  consentGiven: boolean;
  referenceImageDataUrl?: string;
  activeModel: string;
  textZonePosition: 'Top Header + Bottom CTA' | 'Bottom Card Overlay' | 'Split Editorial Frame';
}

export interface GenerationJobResult {
  jobId: string;
  finalImageUrl: string;
  compiledHiddenPromptPreview: string;
  durationMs: number;
  modelUsed: string;
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function enqueueGenerationJob(
  payload: GenerationJobPayload,
  onProgress: (event: StepperProgressEvent) => void
): Promise<GenerationJobResult> {
  const startTime = performance.now();
  const jobId = `job_${Date.now().toString(36)}`;

  // STEP 1: Analisis Vision
  onProgress({
    step: 1,
    label: '1. Analisis Vision',
    detail: `Menganalisis komposisi & pencahayaan subjek (${payload.subjectType})...`,
    status: 'running',
  });
  await delay(550);
  const visionResult = await analyzeReferenceImage({
    subjectType: payload.subjectType,
    consentGiven: payload.consentGiven,
  });
  onProgress({
    step: 1,
    label: '1. Analisis Vision',
    detail: `Vision OK (${Math.round(visionResult.confidenceScore * 100)}%): ${visionResult.lightingProfile}`,
    status: 'completed',
  });

  // STEP 2: Merangkai Prompt Tersembunyi
  onProgress({
    step: 2,
    label: '2. Merangkai Prompt Tersembunyi',
    detail: 'Mengompilasi [HIDDEN_CORE_PROMPT] terenkripsi AES-256-GCM dengan slot user...',
    status: 'running',
  });
  await delay(550);
  const compiled = renderTestCorePromptPreview({
    title: payload.title,
    subjectType: payload.subjectType,
    visionSummary: visionResult.lightingProfile,
    textZone: payload.textZonePosition,
  });
  onProgress({
    step: 2,
    label: '2. Merangkai Prompt Tersembunyi',
    detail: 'Prompt tersembunyi berhasil dirangkai di memori aman.',
    status: 'completed',
  });

  // STEP 3: Generasi i2i / t2i
  onProgress({
    step: 3,
    label: `3. Generasi ${payload.mode}`,
    detail: `Merender base visual 4:5 via model ${payload.activeModel}...`,
    status: 'running',
  });
  await delay(650);
  await runI2IGeneration({
    mode: payload.mode,
    subjectType: payload.subjectType,
    title: payload.title,
    remarks: payload.remarks,
    templateId: payload.templateId,
    referenceImageUrl: payload.referenceImageDataUrl,
    visionResult,
    activeModel: payload.activeModel,
  });
  onProgress({
    step: 3,
    label: `3. Generasi ${payload.mode}`,
    detail: 'Base visual 4:5 selesai dirender.',
    status: 'completed',
  });

  // STEP 4: Tempel Teks Layout sharp
  onProgress({
    step: 4,
    label: '4. Tempel Teks Layout sharp',
    detail: 'Menempelkan tipografi presisi tinggi pada zona aman rasio 4:5...',
    status: 'running',
  });
  await delay(500);
  const finalImageUrl = await renderSharpTextOverlayCanvas({
    title: payload.title,
    remarks: payload.remarks,
    categoryBadge: payload.categoryBadge,
    mode: payload.mode,
    subjectType: payload.subjectType,
    referenceImageDataUrl: payload.referenceImageDataUrl,
    textZonePosition: payload.textZonePosition,
  });
  onProgress({
    step: 4,
    label: '4. Tempel Teks Layout sharp',
    detail: 'Visual HD 4:5 siap diunduh!',
    status: 'completed',
  });

  const durationMs = Math.round(performance.now() - startTime);

  return {
    jobId,
    finalImageUrl,
    compiledHiddenPromptPreview: compiled.maskedView,
    durationMs,
    modelUsed: payload.activeModel,
  };
}

