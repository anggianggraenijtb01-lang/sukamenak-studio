import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/lib/errors.js';
import { JobTimeoutError, PipelineError, describeFailure } from '../../src/pipeline/errors.js';
import { ProviderError } from '../../src/providers/errors.js';

describe('describeFailure', () => {
  it('maps every failure kind to a stored code, a sanitised message and a retry hint', () => {
    expect(describeFailure(new ProviderError('PROVIDER_RATE_LIMITED'), false)).toMatchObject({ code: 'PROVIDER_RATE_LIMITED', transient: true, unexpected: false });
    expect(describeFailure(new ProviderError('PROVIDER_AUTH'), false)).toMatchObject({ code: 'PROVIDER_AUTH', transient: false });
    expect(describeFailure(new AppError('NO_MODEL_AVAILABLE', 'x'), false)).toMatchObject({ code: 'NO_MODEL_AVAILABLE', transient: false });
    expect(describeFailure(new PipelineError('REFERENCE_UNAVAILABLE', 'gone'), false).code).toBe('REFERENCE_UNAVAILABLE');
    expect(describeFailure(new JobTimeoutError(), false).code).toBe('JOB_TIMEOUT');
    // A provider abort caused by the job deadline is a job timeout, not a provider fault.
    expect(describeFailure(new ProviderError('PROVIDER_ABORTED'), true)).toMatchObject({ code: 'JOB_TIMEOUT', transient: false });
  });

  it('never exposes the message of an unexpected error', () => {
    const info = describeFailure(new Error('SELECT secret FROM core_prompts WHERE body = "TOP SECRET"'), false);
    expect(info).toMatchObject({ code: 'INTERNAL_ERROR', unexpected: true, transient: false });
    expect(info.message).not.toContain('SECRET');
  });
});
