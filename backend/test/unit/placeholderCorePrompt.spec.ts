import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_CORE_PROMPT_MARKER, assertCoreBodyUsable } from '../../src/engine/placeholderCorePrompt.js';
import { AppError } from '../../src/lib/errors.js';
import { SEED_CORE_PROMPTS } from '../../src/seed/data/corePrompts.js';

const standIn = SEED_CORE_PROMPTS[0]?.body as string;
const realLooking = 'A distinctive production prompt about [___] in {{aspect_ratio}}; {{subject_lock}}; {{negative}}.';

describe('assertCoreBodyUsable: production never generates from a stand-in', () => {
  it('refuses a stand-in in production with CORE_PROMPT_REQUIRED (422)', () => {
    expect.assertions(3);
    try {
      assertCoreBodyUsable(standIn, 'production');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('CORE_PROMPT_REQUIRED');
      expect((error as AppError).status).toBe(422);
    }
  });

  it('names the fix and carries none of the prompt', () => {
    const message = (() => {
      try {
        assertCoreBodyUsable(standIn, 'production');
      } catch (error) {
        return (error as AppError).message;
      }
      return '';
    })();
    expect(message).toMatch(/Core Prompt Manager/);
    expect(message).not.toContain(PLACEHOLDER_CORE_PROMPT_MARKER);
    for (const line of standIn.split('\n').filter((l) => l.length >= 30)) expect(message).not.toContain(line.slice(0, 30));
  });

  it('lets a real prompt through in production', () => {
    expect(() => assertCoreBodyUsable(realLooking, 'production')).not.toThrow();
  });

  it.each(['development', 'test'])('lets the stand-in run in %s, so dev and CI keep using the mock pipeline', (nodeEnv) => {
    expect(() => assertCoreBodyUsable(standIn, nodeEnv)).not.toThrow();
  });
});
