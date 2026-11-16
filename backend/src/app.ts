import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { requestId } from './middleware/requestId.js';
import { createApiRouter } from './modules/index.js';
import { initProviders } from './providers/index.js';
import './types/express.js';

export function createApp(): Express {
  initProviders();

  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      // Only method + path (no query string: signed file tokens travel there) and the status are logged.
      serializers: {
        req: (req: { id?: string; method?: string; url?: string }) => ({
          id: req.id,
          method: req.method,
          url: (req.url ?? '').split('?')[0],
        }),
        // pino-http hands over an already-standardised object; the raw ServerResponse has the real status.
        res: (res: { statusCode?: number | null; raw?: { statusCode?: number } }) => ({
          statusCode: res.raw?.statusCode ?? res.statusCode,
        }),
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      autoLogging: { ignore: (req) => (req.url ?? '').startsWith('/api/v1/health') },
    }),
  );
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser clients send no Origin header; browsers must come from the allowlist.
        callback(null, !origin || env.CORS_ORIGINS.includes(origin));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
      maxAge: 600,
    }),
  );
  app.use(createRateLimiter({ limit: env.RATE_LIMIT_PER_MINUTE }));
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/v1', createApiRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
