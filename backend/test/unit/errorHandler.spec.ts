import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler.js';

function harness() {
  const log = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const res = { headersSent: false, status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  const req = { log, requestId: 'req-1' };
  return {
    log,
    res,
    req,
    call: (err: unknown) =>
      errorHandler(err, req as unknown as Request, res as unknown as Response, vi.fn()),
  };
}

const withCode = (code: string) => Object.assign(new Error('stream closed'), { code });

describe('errorHandler', () => {
  it('treats a cancelled download as routine: no error log, no response attempt', () => {
    const { log, res, call } = harness();
    call(withCode('ERR_STREAM_PREMATURE_CLOSE'));
    expect(log.error).not.toHaveBeenCalled();
    expect(log.debug).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('still reports a genuine failure with 500 and an error log', () => {
    const { log, res, call } = harness();
    call(new Error('database is on fire'));
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error_code: 'INTERNAL_ERROR' }));
  });

  it('keeps an upstream connection reset as a real failure, not a client abort', () => {
    const { log, call } = harness();
    call(withCode('ECONNRESET'));
    expect(log.error).toHaveBeenCalledTimes(1);
  });
});
