import type { Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export type Meta = object;

export interface SuccessEnvelope<T> {
  status: 'success';
  message: string;
  data: T;
  meta?: Meta;
}

export interface ErrorEnvelope {
  status: 'error';
  message: string;
  error_code: string;
  errors?: { field: string; message: string }[];
}

export function ok<T>(res: Response, data: T, message = 'OK', meta?: Meta, statusCode = 200): Response {
  const body: SuccessEnvelope<T> = { status: 'success', message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function created<T>(res: Response, data: T, message = 'Berhasil dibuat'): Response {
  return ok(res, data, message, undefined, 201);
}

export function accepted<T>(res: Response, data: T, message = 'Diterima'): Response {
  return ok(res, data, message, undefined, 202);
}

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) };
}
