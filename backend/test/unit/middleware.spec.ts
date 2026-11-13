import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../../src/lib/errors.js';
import { created, ok, pageMeta } from '../../src/lib/response.js';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler.js';
import { createRateLimiter } from '../../src/middleware/rateLimit.js';
import { requestId } from '../../src/middleware/requestId.js';
import { requireRole } from '../../src/middleware/requireRole.js';
import { getValid, validate } from '../../src/middleware/validate.js';
import '../../src/types/express.js';

function makeApp(setup: (app: express.Express) => void): express.Express {
  const app = express();
  app.use(requestId);
  app.use(express.json({ limit: '1kb' }));
  setup(app);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('response envelope', () => {
  it('wraps success data, optional meta and status codes', async () => {
    const app = makeApp((a) => {
      a.get('/ok', (_req, res) => ok(res, { a: 1 }, 'Halo', pageMeta(2, 10, 25)));
      a.post('/new', (_req, res) => created(res, { id: 1 }));
    });
    const res = await request(app).get('/ok');
    expect(res.body).toEqual({
      status: 'success',
      message: 'Halo',
      data: { a: 1 },
      meta: { page: 2, limit: 10, total: 25, total_pages: 3 },
    });
    expect((await request(app).post('/new')).status).toBe(201);
  });
});

describe('errorHandler', () => {
  const app = makeApp((a) => {
    a.get('/app-error', () => {
      throw new AppError('EMAIL_EXISTS', 'Email sudah terdaftar');
    });
    a.get('/boom', () => {
      throw new Error('SECRET internal detail: select * from users');
    });
    a.get('/async-boom', async () => {
      throw new Error('SECRET async detail');
    });
    a.post('/echo', (req, res) => ok(res, req.body));
  });

  it('maps AppError to the envelope with its code and status', async () => {
    const res = await request(app).get('/app-error');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ status: 'error', message: 'Email sudah terdaftar', error_code: 'EMAIL_EXISTS' });
  });

  it('hides internals of unexpected errors (sync and async)', async () => {
    for (const path of ['/boom', '/async-boom']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(500);
      expect(res.body.error_code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(res.body)).not.toMatch(/SECRET|select|stack/i);
    }
  });

  it('returns 404 NOT_FOUND for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error_code).toBe('NOT_FOUND');
  });

  it('turns malformed JSON and oversized bodies into VALIDATION_ERROR envelopes', async () => {
    const bad = await request(app).post('/echo').set('Content-Type', 'application/json').send('{"a":');
    expect(bad.status).toBe(400);
    expect(bad.body.error_code).toBe('VALIDATION_ERROR');
    const big = await request(app).post('/echo').send({ blob: 'x'.repeat(5000) });
    expect(big.status).toBe(413);
    expect(big.body.error_code).toBe('VALIDATION_ERROR');
  });

  it('adds a request id header, honouring a well-formed incoming one', async () => {
    const res = await request(app).get('/app-error').set('X-Request-Id', 'abc-12345678');
    expect(res.headers['x-request-id']).toBe('abc-12345678');
    const generated = await request(app).get('/app-error').set('X-Request-Id', 'bad id with spaces');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('validate', () => {
  const schemas = {
    body: z.object({ name: z.string().min(2), age: z.coerce.number().int().min(0) }),
    query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
    params: z.object({ id: z.string().uuid() }),
  };
  const app = makeApp((a) => {
    a.post('/things/:id', validate(schemas), (req, res) => ok(res, getValid(req, schemas)));
  });

  it('parses and coerces body, query and params', async () => {
    const id = '5b2c9f64-7a0e-4f55-9d33-7d1c0b6a8e11';
    const res = await request(app).post(`/things/${id}?page=3`).send({ name: 'Ani', age: '20', extra: 'dropped' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ body: { name: 'Ani', age: 20 }, query: { page: 3 }, params: { id } });
  });

  it('reports every failing field with its location', async () => {
    const res = await request(app).post('/things/not-a-uuid').send({ name: 'A' });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('VALIDATION_ERROR');
    const fields = (res.body.errors as { field: string }[]).map((e) => e.field).sort();
    expect(fields).toEqual(['age', 'name', 'params.id']);
  });
});

describe('requireRole', () => {
  it('rejects anonymous (401) and wrong role (403), accepts the right role', async () => {
    const app = makeApp((a) => {
      a.get('/anon', requireRole('admin'), (_req, res) => ok(res, 1));
      a.get('/creator', (req, _res, next) => {
        req.user = { id: 'u', email: 'e', name: 'n', role: 'creator' };
        next();
      }, requireRole('admin'), (_req, res) => ok(res, 1));
      a.get('/admin', (req, _res, next) => {
        req.user = { id: 'u', email: 'e', name: 'n', role: 'admin' };
        next();
      }, requireRole('admin'), (_req, res) => ok(res, 1));
    });
    expect((await request(app).get('/anon')).status).toBe(401);
    const forbidden = await request(app).get('/creator');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error_code).toBe('FORBIDDEN');
    expect((await request(app).get('/admin')).status).toBe(200);
  });
});

describe('rate limiter', () => {
  it('answers RATE_LIMIT_EXCEEDED in the standard envelope once the limit is hit', async () => {
    const app = makeApp((a) => {
      a.use(createRateLimiter({ limit: 2, windowMs: 60_000 }));
      a.get('/x', (_req, res) => ok(res, 1));
    });
    expect((await request(app).get('/x')).status).toBe(200);
    expect((await request(app).get('/x')).status).toBe(200);
    const limited = await request(app).get('/x');
    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({ status: 'error', error_code: 'RATE_LIMIT_EXCEEDED' });
  });
});
