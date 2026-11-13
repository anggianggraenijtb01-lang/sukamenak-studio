import { query } from '../db/pool.js';

/** Last-resort failure marker for jobs that crashed outside the pipeline's own error handling. */
export async function failGeneration(generationId: string, code: string): Promise<void> {
  await query(
    `UPDATE generations SET status = 'failed', error_code = $2 WHERE id = $1 AND status IN ('queued', 'running')`,
    [generationId, code],
  );
}
