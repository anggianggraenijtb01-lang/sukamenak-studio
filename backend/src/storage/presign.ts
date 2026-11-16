import { createHash, createHmac } from 'node:crypto';

export interface PresignOptions {
  endpoint: string;
  region: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresSeconds: number;
  forcePathStyle: boolean;
  now?: Date;
}

const hmac = (key: Buffer | string, data: string): Buffer => createHmac('sha256', key).update(data).digest();
const sha256 = (data: string): string => createHash('sha256').update(data).digest('hex');
/** RFC 3986 encoding as SigV4 requires (encodeURIComponent leaves !'()* unescaped). */
const uriEncode = (s: string): string => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * Synchronous SigV4 query-string presign for `GET Object`. The AWS SDK presigner is async only
 * because credentials may be lazy; ours are static, and a sync signature lets DTO mappers stay sync.
 */
export function presignGetUrl(o: PresignOptions): string {
  const base = new URL(o.endpoint);
  const host = o.forcePathStyle ? base.host : `${o.bucket}.${base.host}`;
  const encodedKey = o.key.split('/').map(uriEncode).join('/');
  const prefix = base.pathname.replace(/\/+$/, '');
  const canonicalUri = `${prefix}${o.forcePathStyle ? `/${uriEncode(o.bucket)}` : ''}/${encodedKey}`;

  const now = o.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${o.region}/s3/aws4_request`;

  const params: [string, string][] = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${o.accessKeyId}/${scope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(Math.min(Math.max(o.expiresSeconds, 1), 604_800))],
    ['X-Amz-SignedHeaders', 'host'],
  ];
  const canonicalQuery = params
    .map(([k, v]) => [uriEncode(k), uriEncode(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const canonicalRequest = ['GET', canonicalUri, canonicalQuery, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${o.secretAccessKey}`, date), o.region), 's3'), 'aws4_request');
  const signature = hmac(signingKey, stringToSign).toString('hex');

  return `${base.protocol}//${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
