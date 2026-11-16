import sharp, { type OverlayOptions, type Sharp } from 'sharp';
import { AppError } from '../lib/errors.js';

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 8000;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const MIN_IMAGE_SIDE = 32;
/** Uploaded references are downscaled to this longest side: providers never need more, and it bounds payload size. */
export const REFERENCE_MAX_SIDE = 2048;
export const THUMBNAIL_MAX_SIDE = 480;

export interface ProcessedImage {
  buffer: Buffer;
  mime: ImageMime;
  width: number;
  height: number;
}

/** Identifies jpeg/png/webp from the leading bytes. The client-declared type and file name are never trusted. */
export function detectImageMime(buf: Buffer): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const invalid = (message: string) => new AppError('VALIDATION_ERROR', message, { errors: [{ field: 'file', message }] });

function encode(pipeline: Sharp, mime: ImageMime): Sharp {
  if (mime === 'image/jpeg') return pipeline.jpeg({ quality: 90 });
  if (mime === 'image/png') return pipeline.png({ compressionLevel: 9 });
  return pipeline.webp({ quality: 90 });
}

/**
 * Validates and sanitises an uploaded image: size cap, magic-byte type check, dimension sanity cap,
 * EXIF orientation applied, then ALL metadata (EXIF, GPS, comments) dropped by re-encoding.
 */
export async function processUploadedImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length === 0) throw invalid('File kosong');
  if (input.length > MAX_UPLOAD_BYTES) throw invalid('Ukuran file maksimal 8 MB');
  const mime = detectImageMime(input);
  if (!mime) throw invalid('Format file harus JPEG, PNG, atau WebP');

  try {
    const meta = await sharp(input, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < MIN_IMAGE_SIDE || h < MIN_IMAGE_SIDE) throw invalid('Dimensi gambar terlalu kecil');
    if (w > MAX_IMAGE_SIDE || h > MAX_IMAGE_SIDE || w * h > MAX_IMAGE_PIXELS) throw invalid('Dimensi gambar terlalu besar');

    // `.rotate()` without arguments bakes in the EXIF orientation; sharp drops metadata unless asked to keep it.
    const pipeline = sharp(input, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' })
      .rotate()
      .resize({ width: REFERENCE_MAX_SIDE, height: REFERENCE_MAX_SIDE, fit: 'inside', withoutEnlargement: true });
    const { data, info } = await encode(pipeline, mime).toBuffer({ resolveWithObject: true });
    return { buffer: data, mime, width: info.width, height: info.height };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw invalid('File gambar rusak atau tidak dapat dibaca');
  }
}

/** WebP thumbnail with the longest side capped at `maxSide`. */
export async function makeThumbnail(input: Buffer, maxSide: number = THUMBNAIL_MAX_SIDE): Promise<ProcessedImage> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, mime: 'image/webp', width: info.width, height: info.height };
}

export async function readImageSize(input: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(input, { limitInputPixels: MAX_IMAGE_PIXELS * 2 }).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0 };
}
