import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { env } from '../config/env.js';
import { query, queryOne } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { createAsset, softDeleteAssets } from '../storage/assets.js';
import { getStorage } from '../storage/index.js';
import { toRenderProps, type VideoJobProps } from './props.js';

/** Repo-root relative default: `video/render.mjs` next to `backend/`. */
const DEFAULT_RENDER_SCRIPT = path.resolve(process.cwd(), '..', 'video', 'render.mjs');

interface JobRow {
  id: string;
  status: string;
  props: VideoJobProps;
  duration_seconds: number;
  width: number;
  height: number;
  fps: number;
  user_id: string;
}

export interface RenderResult {
  buffer: Buffer;
  progressSeen: number;
}

/**
 * Runs the renderer as a child process. The worker never imports Remotion: a Chrome OOM kills the
 * child, the job is marked failed, and the worker keeps serving the queue.
 *
 * Bounded by VIDEO_JOB_TIMEOUT_MS; a timeout kills the process group and reports `timedOut`.
 */
export function runRenderer(
  propsPath: string,
  outPath: string,
  opts: { timeoutMs?: number; onProgress?: (percent: number) => void; command?: string } = {},
): Promise<{ timedOut: boolean; stdout: string; stderr: string }> {
  const command = opts.command ?? env.VIDEO_RENDER_COMMAND ?? DEFAULT_RENDER_SCRIPT;
  const timeoutMs = opts.timeoutMs ?? env.VIDEO_JOB_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [command, '--props', propsPath, '--out', outPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let lineBuffer = '';

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      lineBuffer += text;
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const match = /^PROGRESS (\d{1,3})$/.exec(line.trim());
        if (match) opts.onProgress?.(Number(match[1]));
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', () => {
      clearTimeout(timer);
      // stderr is truncated: a Chrome stack trace can be hundreds of lines and none of it is user-facing.
      resolve({ timedOut, stdout, stderr: stderr.slice(-2000) });
    });
  });
}

const setStatus = (id: string, fields: Record<string, unknown>): Promise<unknown> => {
  const keys = Object.keys(fields);
  const values = keys.map((k) => fields[k]);
  const assignments = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  return query(`UPDATE video_jobs SET ${assignments} WHERE id = $1`, [id, ...values]);
};

/**
 * Records render progress. Only a job that is still rendering moves, and only forwards: a write that
 * lands after the job was marked done (or after a higher value) must not undo it.
 */
export async function recordProgress(jobId: string, percent: number): Promise<void> {
  await query("UPDATE video_jobs SET progress = $2 WHERE id = $1 AND status = 'rendering' AND progress < $2", [jobId, percent]);
}

/**
 * Renders one video job: queued -> rendering -> done, or -> failed with a stored error code.
 *
 * A job deleted while it was rendering is finished and then thrown away (the caller owns the file).
 * Progress is written at most every ~2% so polling sees movement without hammering the database.
 */
export async function runVideoJob(jobId: string): Promise<void> {
  const job = await queryOne<JobRow>(
    `SELECT id, status, props, duration_seconds, width, height, fps, user_id
       FROM video_jobs WHERE id = $1 AND deleted_at IS NULL`,
    [jobId],
  );
  if (!job) return;
  if (job.status === 'done' || job.status === 'failed') return;

  const startedAt = Date.now();
  await setStatus(jobId, { status: 'rendering', started_at: new Date(), attempts: 1 });

  const workDir = await mkdtemp(path.join(os.tmpdir(), 'sukamenak-video-'));
  const propsPath = path.join(workDir, 'props.json');
  const outPath = path.join(workDir, 'out.mp4');

  try {
    const poster = await getStorage().get(job.props.poster_key);
    const renderProps = toRenderProps(job.props, poster, 'image/png');
    await writeFile(propsPath, JSON.stringify(renderProps), 'utf8');

    let lastProgress = -10;
    // One write at a time, and all of them finished before the final status below.
    let progressWrites: Promise<unknown> = Promise.resolve();
    const { timedOut, stderr } = await runRenderer(propsPath, outPath, {
      timeoutMs: env.VIDEO_JOB_TIMEOUT_MS,
      onProgress: (percent) => {
        if (percent - lastProgress < 2 && percent < 100) return;
        lastProgress = percent;
        progressWrites = progressWrites.then(() => recordProgress(jobId, Math.min(99, percent))).catch(() => undefined);
      },
    });
    await progressWrites;

    if (timedOut) {
      await setStatus(jobId, { status: 'failed', error_code: 'VIDEO_TIMEOUT', finished_at: new Date(), render_ms: Date.now() - startedAt, progress: 100 });
      logger.warn({ video_job_id: jobId, timeout_ms: env.VIDEO_JOB_TIMEOUT_MS }, 'video render timed out');
      return;
    }

    let mp4: Buffer;
    try {
      mp4 = await readFile(outPath);
    } catch {
      await setStatus(jobId, { status: 'failed', error_code: 'VIDEO_RENDER_FAILED', finished_at: new Date(), render_ms: Date.now() - startedAt, progress: 100 });
      logger.warn({ video_job_id: jobId, stderr }, 'video render produced no output');
      return;
    }
    if (mp4.length === 0) {
      await setStatus(jobId, { status: 'failed', error_code: 'VIDEO_RENDER_FAILED', finished_at: new Date(), render_ms: Date.now() - startedAt, progress: 100 });
      return;
    }

    const asset = await createAsset({
      buffer: mp4,
      mime: 'video/mp4',
      kind: 'video',
      ownerId: job.user_id,
      prefix: 'videos',
      width: job.width,
      height: job.height,
    });

    const deleted = await queryOne<{ deleted_at: Date | null }>('SELECT deleted_at FROM video_jobs WHERE id = $1', [jobId]);
    if (deleted?.deleted_at) {
      // Deleted while rendering: keep the row out of the way and drop the file we just made.
      await softDeleteAssets([asset.id]).catch(() => undefined);
      return;
    }

    await setStatus(jobId, {
      status: 'done',
      progress: 100,
      result_asset_id: asset.id,
      render_ms: Date.now() - startedAt,
      finished_at: new Date(),
    });
  } catch (err) {
    const name = (err as Error)?.name ?? 'Error';
    await setStatus(jobId, {
      status: 'failed',
      error_code: name === 'timeout' ? 'VIDEO_TIMEOUT' : 'VIDEO_RENDER_FAILED',
      finished_at: new Date(),
      render_ms: Date.now() - startedAt,
      progress: 100,
    }).catch(() => undefined);
    logger.error({ video_job_id: jobId, err_name: name }, 'video job failed');
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
