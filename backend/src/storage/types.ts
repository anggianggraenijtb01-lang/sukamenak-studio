export interface StoredObject {
  stream: NodeJS.ReadableStream;
  bytes: number;
  /** Absolute path on disk, when the driver stores files locally. Lets `/files` answer Range requests by
   *  seeking on disk instead of reading and discarding the bytes before the range. */
  filePath?: string;
}

/**
 * Where binary assets live. `url()` is synchronous on purpose: DTO serializers call it while
 * mapping rows, and both drivers can sign without I/O (HMAC token / SigV4 presign).
 */
export interface StorageDriver {
  readonly name: 'local' | 's3';
  put(key: string, body: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Streams an object; resolves null when it does not exist. Used by the local `/files` route. */
  open(key: string): Promise<StoredObject | null>;
  /** Removes the object; missing objects are not an error. */
  delete(key: string): Promise<void>;
  /** Time-limited URL that grants read access to `key`. Never an unsigned URL. */
  url(key: string, ttlSeconds?: number): string;
}
