/**
 * The repository is public, so it must not contain the real core prompts. The seed ships neutral stand-in prompts that
 * carry this marker; the real ones are entered through the admin Core Prompt Manager and live only, encrypted, in the
 * database. `isPlaceholderCoreBody` tells a stand-in from a real prompt.
 */
import { AppError } from '../lib/errors.js';

export const PLACEHOLDER_CORE_PROMPT_MARKER = 'PLACEHOLDER-CORE-PROMPT';

export const isPlaceholderCoreBody = (body: string): boolean => body.includes(PLACEHOLDER_CORE_PROMPT_MARKER);

/**
 * Production must never generate from a stand-in: it would quietly serve generic images to creators. Only
 * NODE_ENV=production is guarded, so development and CI keep running the whole pipeline on the stand-ins with the mock
 * provider. The failure uses the existing CORE_PROMPT_REQUIRED (422), which fails the generation without using up the
 * creator's daily allowance; the message names the fix and never carries any of the prompt.
 */
export function assertCoreBodyUsable(body: string, nodeEnv: string): void {
  if (nodeEnv === 'production' && isPlaceholderCoreBody(body)) {
    throw new AppError(
      'CORE_PROMPT_REQUIRED',
      'Core prompt aktif masih berupa prompt pengganti. Masukkan prompt asli lewat Core Prompt Manager lalu aktifkan.',
    );
  }
}
