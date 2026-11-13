import type { Request, RequestHandler } from 'express';
import { z, type ZodError, type ZodTypeAny } from 'zod';
import { AppError, type FieldError } from '../lib/errors.js';

export interface RouteSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

type Infer<T> = T extends ZodTypeAny ? z.output<T> : undefined;

export type Validated<S extends RouteSchemas> = {
  body: Infer<S['body']>;
  query: Infer<S['query']>;
  params: Infer<S['params']>;
};

const PARTS = ['params', 'query', 'body'] as const;

export function zodFieldErrors(error: ZodError, prefix?: string): FieldError[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return { field: prefix && path ? `${prefix}.${path}` : path || prefix || '(root)', message: issue.message };
  });
}

/**
 * Parses params, query and body with Zod. Express 5 exposes `req.query` as a read-only getter,
 * so parsed values are stored on `req.valid` and read through `getValid`.
 */
export const validate =
  (schemas: RouteSchemas): RequestHandler =>
  (req, _res, next) => {
    const errors: FieldError[] = [];
    const valid: Record<string, unknown> = {};
    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      const input = part === 'body' ? (req.body ?? {}) : req[part];
      const result = schema.safeParse(input);
      if (result.success) valid[part] = result.data;
      else errors.push(...zodFieldErrors(result.error, part === 'body' ? undefined : part));
    }
    if (errors.length > 0) return next(new AppError('VALIDATION_ERROR', 'Data yang dikirim tidak valid', { errors }));
    req.valid = valid;
    next();
  };

/** Typed accessor for what `validate(schemas)` stored; pass the same schemas object for inference. */
export const getValid = <S extends RouteSchemas>(req: Request, _schemas: S): Validated<S> =>
  (req.valid ?? {}) as Validated<S>;
