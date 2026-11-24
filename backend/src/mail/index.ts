import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Resend answered with a non-2xx status. Carries the status only, never the message body. */
export class MailDeliveryError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Mail provider rejected the message (HTTP ${status})`);
    this.name = 'MailDeliveryError';
    this.status = status;
  }
}

const RESEND_URL = 'https://api.resend.com/emails';

/** backend/var/outbox, from both src/mail (tsx) and dist/mail (built). */
export const OUTBOX_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'var', 'outbox');

/**
 * Sends one plain-text email through Resend when RESEND_API_KEY is set. Without a key the full
 * message is written to OUTBOX_DIR so a developer or tester can open the link without SMTP.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (env.RESEND_API_KEY) {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new MailDeliveryError(res.status);
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeTo = message.to.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  const file = path.join(OUTBOX_DIR, `${stamp}-${safeTo}.txt`);
  await mkdir(OUTBOX_DIR, { recursive: true });
  await writeFile(file, `From: ${env.MAIL_FROM}\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`, 'utf8');
  // In production an unset key means no mail ever leaves the server: make that loud.
  if (env.isProduction) logger.warn({ file }, 'RESEND_API_KEY not set: mail written to outbox');
  else logger.info({ file }, 'RESEND_API_KEY not set: mail written to outbox');
}
