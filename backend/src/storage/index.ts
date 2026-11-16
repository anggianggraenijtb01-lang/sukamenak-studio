import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { createLocalStorage } from './local.js';
import { createS3Storage } from './s3.js';
import type { StorageDriver } from './types.js';

export type { StorageDriver, StoredObject } from './types.js';

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Relative STORAGE_LOCAL_DIR resolves against the backend directory (same rule the seed uses). */
export const localStorageRoot = (): string => path.resolve(BACKEND_ROOT, env.STORAGE_LOCAL_DIR);

let driver: StorageDriver | undefined;

export function getStorage(): StorageDriver {
  driver ??= env.STORAGE_DRIVER === 's3' ? createS3Storage() : createLocalStorage(localStorageRoot());
  return driver;
}

/** Test hook: replace (or reset with undefined) the process-wide driver. */
export function setStorage(next: StorageDriver | undefined): void {
  driver = next;
}
