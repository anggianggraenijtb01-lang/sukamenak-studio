import type { Request } from 'express';
import { z } from 'zod';
import { AppError } from '../../lib/errors.js';

/** Who performed an admin action; stored on every audit row. */
export interface AdminCtx {
  actorId: string;
  ip: string | null;
}

export const adminCtx = (req: Request): AdminCtx => ({ actorId: req.user!.id, ip: req.ip ?? null });

export const idParams = { params: z.object({ id: z.string().uuid() }) };

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const pageFields = (defaultLimit = 20, maxLimit = 100) => ({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(maxLimit).default(defaultLimit),
});

export const boolQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

/** `YYYY-MM-DD`, validated as a real calendar date. Interpreted in APP_TIMEZONE. */
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Gunakan format YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), 'Tanggal tidak valid');

export const escapeLike = (value: string): string => value.replace(/[%_\\]/g, '\\$&');

export const offsetOf = (q: { page: number; limit: number }): number => (q.page - 1) * q.limit;

/** Collects parameterised WHERE clauses. */
export class Where {
  readonly params: unknown[] = [];
  private readonly clauses: string[];

  constructor(...base: string[]) {
    this.clauses = [...base];
  }

  /** `build` receives the `$n` placeholder for `value`. */
  add(build: (placeholder: string) => string, value: unknown): this {
    this.params.push(value);
    this.clauses.push(build(`$${this.params.length}`));
    return this;
  }

  /** Registers a parameter without adding a clause; returns its `$n` placeholder. */
  param(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  raw(clause: string): this {
    this.clauses.push(clause);
    return this;
  }

  next(): string {
    return `$${this.params.length + 1}`;
  }

  get sql(): string {
    return this.clauses.length > 0 ? `WHERE ${this.clauses.join(' AND ')}` : '';
  }
}

interface PgErrorLike {
  code?: string;
  constraint?: string;
}

/** Constraint name of a unique violation (23505), or null for any other error. */
export function uniqueViolation(err: unknown): string | null {
  const e = err as PgErrorLike | null;
  return typeof e === 'object' && e !== null && e.code === '23505' ? (e.constraint ?? '') : null;
}

export const isForeignKeyViolation = (err: unknown): boolean => (err as PgErrorLike | null)?.code === '23503';

export const conflictField = (field: string, message: string): AppError =>
  new AppError('VALIDATION_ERROR', message, { errors: [{ field, message }] });

/** A nullable-or-absent patch field helper: keeps `undefined` (leave alone) distinct from `null` (clear). */
export const hasKey = <T extends object>(obj: T, key: keyof T): boolean => Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined;

export function requireAnyKey<T extends z.ZodTypeAny>(schema: T): z.ZodEffects<T> {
  return schema.refine((v) => v && typeof v === 'object' && Object.values(v as Record<string, unknown>).some((x) => x !== undefined), {
    message: 'Kirim minimal satu field yang diubah',
  });
}
