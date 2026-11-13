/**
 * Guards for URLs the server will call on an admin's behalf (model `base_url`, and image URLs a
 * provider hands back). The platform must not be usable as a proxy into its own network: loopback,
 * private, link-local (cloud metadata at 169.254.169.254), unique-local and transition-mechanism
 * (IPv4-mapped/compatible, NAT64, 6to4, Teredo) addresses are refused.
 *
 * Two layers, because the admin who picks the URL may also run the DNS server behind it:
 *   - `isDisallowedHost` rejects literal hosts (and names like localhost) when the config is saved
 *     and again before each request. Run it on `new URL(...).hostname`: the URL parser normalises
 *     `[::ffff:127.0.0.1]` to `[::ffff:7f00:1]`, `2130706433` to `127.0.0.1`, and so on.
 *   - `guardedLookup` is installed as the connection's DNS lookup (see providers/http.ts), so the
 *     address that is validated is the very address that is connected to. A check done before the
 *     request and a connection made after it could be raced with a rebinding DNS answer; this cannot.
 *
 * Operators who really need a private inference node set ALLOW_PRIVATE_PROVIDER_HOSTS=true.
 */

import { lookup as dnsLookup } from 'node:dns';
import { BlockList, isIP, type LookupFunction } from 'node:net';

const blocked = new BlockList();

// IPv4. BlockList also applies these to IPv4-mapped IPv6 addresses (::ffff:a.b.c.d, in either notation).
for (const [network, prefix] of [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12],
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.168.0.0', 16],
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 3], // multicast, reserved, broadcast
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4');
}

// IPv6 ranges that are not ordinary global unicast.
for (const [network, prefix] of [
  ['::', 96], // unspecified, loopback and IPv4-compatible (::a.b.c.d)
  ['64:ff9b::', 96], // NAT64: embeds an IPv4 address
  ['64:ff9b:1::', 48], // local-use NAT64
  ['100::', 64], // discard-only
  ['2001::', 32], // Teredo
  ['2002::', 16], // 6to4: embeds an IPv4 address
  ['fc00::', 7], // unique-local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6');
}

/** True for an address that must not be contacted. Hostnames (non-IP input) are not addresses: false. */
export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return blocked.check(ip, 'ipv4');
  if (family === 6) return blocked.check(ip, 'ipv6');
  return false;
}

/** Literal-host check, safe to run in a schema refinement (no I/O). */
export function isDisallowedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  return isPrivateAddress(host);
}

/** The signature `net.connect` / undici's `connect.lookup` expect, in both forms (single address, or `all: true`). */
export type LookupFn = LookupFunction;

/**
 * Wraps a DNS lookup so that a hostname resolving to any non-public address fails the connection.
 * On failure the callback's address argument is an empty placeholder that Node ignores.
 */
export function createGuardedLookup(resolve: LookupFn = dnsLookup as unknown as LookupFn): LookupFn {
  return (hostname, options, callback) => {
    resolve(hostname, options, (err, address, family) => {
      if (err) return callback(err, address, family);
      const resolved = Array.isArray(address) ? address.map((a) => a.address) : [address];
      if (resolved.some(isPrivateAddress)) {
        const refusal: NodeJS.ErrnoException = new Error('Host resolves to a non-public address');
        refusal.code = 'EBLOCKEDHOST';
        return callback(refusal, '', 4);
      }
      callback(null, address, family);
    });
  };
}

export const guardedLookup: LookupFn = createGuardedLookup();
