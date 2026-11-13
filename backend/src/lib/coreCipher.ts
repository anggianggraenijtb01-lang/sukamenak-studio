import { env } from '../config/env.js';
import { decryptSecret, encryptSecret, parseKey, type EncryptedPayload } from './crypto.js';

const key = parseKey(env.CORE_PROMPT_KEY);

/** AAD binding for a core prompt row. Phase C admin writes must use the same helper. */
export const corePromptAad = (promptKey: string, version: number): string => `core_prompt:${promptKey}:v${version}`;

/** AAD binding for a generation's final prompt (Phase B). */
export const finalPromptAad = (generationId: string): string => `final_prompt:${generationId}`;

export const encryptWithCoreKey = (plaintext: string, aad?: string): EncryptedPayload =>
  encryptSecret(plaintext, key, aad);

export const decryptWithCoreKey = (payload: EncryptedPayload, aad?: string): string =>
  decryptSecret(payload, key, aad);
