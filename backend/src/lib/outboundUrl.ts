/**
 * Guards for URLs the server will call on an admin's behalf (model `base_url`, and image URLs a
 * provider hands back). The platform must not be usable as a proxy into its own network: loopback,
 * private, link-local (cloud metadata at 169.254.169.254) and unique-local addresses are refused.
 *
 * Two layers: `isDisallowedHost` rejects literal hosts when the config is saved, and `assertPublicHost`
 * also resolves the name right before a request, which catches a public-looking name that points
 * inward. Resolution and connection are separate steps, so a DNS-rebinding attacker can still race
 * them; that gap is only closed by pinning the resolved address, which fetch does not offer.
 * Operators who really need a private inference node set ALLOW_PRIVATE_PROVIDER_HOSTS=true.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function ipv4Private(ip: string): boolean {
  const [a = 0, b = 0] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

function ipv6Private(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapped?.[1]) return ipv4Private(mapped[1]);
  return /^f[cd]/.test(v) || /^fe[89ab]/.test(v); // unique-local fc00::/7, link-local fe80::/10
}

export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return ipv4Private(ip);
  if (family === 6) return ipv6Private(ip);
  return false;
}

/** Literal-host check, safe to run in a schema refinement (no I/O). */
export function isDisallowedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  return isPrivateAddress(host);
}

export type HostLookup = (hostname: string) => Promise<Array<{ address: string }>>;

const defaultLookup: HostLookup = (hostname) => lookup(hostname, { all: true });

/**
 * Throws when the URL's host is, or resolves to, a non-public address. A name that does not
 * resolve is let through: the request itself will fail, and refusing it would only hide that error.
 */
export async function assertPublicHost(url: string, resolve: HostLookup = defaultLookup): Promise<void> {
  const { hostname } = new URL(url);
  if (isDisallowedHost(hostname)) throw new Error('private host');
  if (isIP(hostname.replace(/^\[|\]$/g, ''))) return;
  let addresses: Array<{ address: string }>;
  try {
    addresses = await resolve(hostname);
  } catch {
    return;
  }
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new Error('private host');
}
