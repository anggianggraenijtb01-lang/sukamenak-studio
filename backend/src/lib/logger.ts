import { pino, type DestinationStream, type Logger } from 'pino';
import { env } from '../config/env.js';

const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|cookie|prompt|cipher|auth_?tag|api_?key|^iv$|remarks|slot_values/i;
const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;

/**
 * Deep-redacts any property whose NAME looks sensitive (pino's own `redact` cannot match
 * substrings such as `*prompt*`). Values of other keys are left untouched.
 */
export function redactDeep(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[TRUNCATED]';
  if (Buffer.isBuffer(value)) return REDACTED;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));
  if (value instanceof Error) {
    return { type: value.name, message: value.message, stack: value.stack };
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redactDeep(v, depth + 1);
  }
  return out;
}

export const REDACT_PATHS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
  '*.body_ciphertext',
  '*.final_prompt_ciphertext',
];

export function createLogger(destination?: DestinationStream, level: string = env.LOG_LEVEL): Logger {
  const options = {
    level: env.isTest && !destination ? 'silent' : level,
    redact: { paths: REDACT_PATHS, censor: REDACTED },
    formatters: {
      log: (obj: Record<string, unknown>) => redactDeep(obj) as Record<string, unknown>,
    },
    base: { service: 'sukamenak-api' },
  };
  return destination ? pino(options, destination) : pino(options);
}

export const logger: Logger = createLogger();
