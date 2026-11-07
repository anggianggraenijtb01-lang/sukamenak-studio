/**
 * Pipeline Step 3: Generasi Image-to-Image (i2i.ts) & Text-to-Image (t2i)
 * Menghasilkan base visual 4:5 sebelum ditempel tipografi presisi oleh textOverlaySharp.ts.
 */

import { VisionAnalysisResult } from './vision';

export interface I2IGenerationInput {
  mode: 'i2i' | 't2i';
  subjectType: 'Produk UMKM' | 'Human Model';
  title: string;
  remarks: string;
  templateId: string;
  referenceImageUrl?: string;
  visionResult: VisionAnalysisResult;
  activeModel: string;
}

export interface I2IGenerationOutput {
  baseLayerDescription: string;
  aspectRatio: '4:5';
  width: number;
  height: number;
  seed: number;
  modelUsed: string;
}

export async function runI2IGeneration(input: I2IGenerationInput): Promise<I2IGenerationOutput> {
  return {
    baseLayerDescription: `[${input.mode.toUpperCase()}] ${input.subjectType} — ${input.title} (${input.visionResult.lightingProfile})`,
    aspectRatio: '4:5',
    width: 1080,
    height: 1350,
    seed: 8492015,
    modelUsed: input.activeModel,
  };
}

