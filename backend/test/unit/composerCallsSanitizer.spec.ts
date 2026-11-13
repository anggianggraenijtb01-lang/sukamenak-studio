import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/engine/sanitizeRemark.js', () => ({
  sanitizeRemark: vi.fn((input: string) => `SANITIZED<${input}>`),
}));

import { composePrompt } from '../../src/engine/promptComposer.js';
import { sanitizeRemark } from '../../src/engine/sanitizeRemark.js';

const slots = [
  { key: 'product', blank_index: 1, default_value: 'a jar' },
  { key: 'remarks', blank_index: 2, default_value: 'nothing special' },
];

describe('composePrompt -> sanitizeRemark', () => {
  beforeEach(() => vi.mocked(sanitizeRemark).mockClear());

  it('runs every remark through sanitizeRemark with the policy terms and a length limit', () => {
    const out = composePrompt({
      coreBody: 'Photo of [___]. Notes: [___]. {{subject_lock}}',
      slots,
      remarks: 'raw creator remark',
      blockedTerms: ['bad'],
      maxRemarkLength: 120,
      subject: 'product',
      aspectRatio: '1:1',
    });
    expect(sanitizeRemark).toHaveBeenCalledTimes(1);
    expect(sanitizeRemark).toHaveBeenCalledWith('raw creator remark', { blockedTerms: ['bad'], maxLength: 120 });
    // The sanitised value (not the raw input) is what reaches the prompt.
    expect(out).toContain('SANITIZED<raw creator remark>');
  });

  it('does not call it when there are no remarks', () => {
    composePrompt({
      coreBody: 'Photo of [___]. Notes: [___]. {{subject_lock}}',
      slots,
      subject: 'product',
      aspectRatio: '1:1',
    });
    expect(sanitizeRemark).not.toHaveBeenCalled();
  });
});
