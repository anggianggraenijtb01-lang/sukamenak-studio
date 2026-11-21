import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { assertStorageKey } from './keys.js';
import { signFileToken } from './signing.js';
import type { StorageDriver, StoredObject } from './types.js';

export function createLocalStorage(rootDir: string, baseUrl: string = env.PUBLIC_BASE_URL): StorageDriver {
  const root = path.resolve(rootDir);

  const resolveKey = (key: string): string => {
    assertStorageKey(key);
    const full = path.resolve(root, key);
    if (full !== root && !full.startsWith(root + path.sep)) throw new Error('Invalid storage key');
    return full;
  };

  return {
    name: 'local',
    async put(key, body) {
      const full = resolveKey(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body);
    },
    get: (key) => readFile(resolveKey(key)),
    async open(key): Promise<StoredObject | null> {
      const full = resolveKey(key);
      try {
        const info = await stat(full);
        if (!info.isFile()) return null;
        return { stream: createReadStream(full), bytes: info.size, filePath: full };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await rm(resolveKey(key), { force: true });
    },
    url(key, ttlSeconds) {
      assertStorageKey(key);
      const encoded = key.split('/').map(encodeURIComponent).join('/');
      return `${baseUrl}/api/v1/files/${encoded}?token=${signFileToken(key, ttlSeconds)}`;
    },
  };
}
