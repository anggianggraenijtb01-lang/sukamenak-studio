/**
 * Client-side mirror of the server rules for model configs (backend/docs/API.md section 3.2). The server stays the
 * authority; these checks only explain the rules before a request is sent.
 */
import type { ModelProvider } from '../../api/types';

export const KNOWN_PROVIDER_KEY_ENVS = ['DEEPSEEK_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'FAL_KEY', 'ARK_API_KEY'] as const;
export const PROVIDER_KEY_PREFIX = 'PROVIDER_KEY_';

export const API_KEY_ENV_HELP = `Isi NAMA variabel lingkungan di server (bukan nilai API key): salah satu dari ${KNOWN_PROVIDER_KEY_ENVS.join(
  ', ',
)}, atau nama berawalan ${PROVIDER_KEY_PREFIX} (huruf besar, angka, garis bawah).`;

export const BASE_URL_HELP =
  'Harus URL https:// menuju host publik, tanpa username/password, query, atau fragment. localhost, 127.x, 10.x, 172.16-31.x, 192.168.x, dan alamat link-local ditolak.';

const NAME_SHAPE = /^[A-Z][A-Z0-9_]*$/;
const PREFIXED = /^PROVIDER_KEY_[A-Z0-9_]{1,60}$/;

/** Returns an Indonesian error message, or `null` when the variable name is acceptable. */
export function validateApiKeyEnv(value: string): string | null {
  if (!NAME_SHAPE.test(value)) {
    return 'Harus berupa nama variabel lingkungan: huruf besar, angka, dan garis bawah, diawali huruf. Jangan tempelkan nilai API key di sini.';
  }
  if (value.length > 80) return 'Nama variabel maksimal 80 karakter.';
  if (!(KNOWN_PROVIDER_KEY_ENVS as readonly string[]).includes(value) && !PREFIXED.test(value)) {
    return `Nama tidak diizinkan. Gunakan ${KNOWN_PROVIDER_KEY_ENVS.join(', ')} atau nama berawalan ${PROVIDER_KEY_PREFIX}.`;
  }
  return null;
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateIpv4(host: string): boolean {
  const m = IPV4.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** True for hosts the server refuses to call (literal check only, like the server's schema refinement). */
export function isDisallowedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (isPrivateIpv4(host)) return true;
  if (host.includes(':')) {
    // IPv6: loopback / unspecified, unique-local fc00::/7, link-local fe80::/10, multicast, and IPv4-mapped forms.
    if (host === '::' || host === '::1') return true;
    if (/^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host) || /^ff[0-9a-f]{2}:/.test(host)) return true;
    if (host.startsWith('::ffff:') || host.startsWith('64:ff9b:') || host.startsWith('2002:') || host.startsWith('2001:0:') || host.startsWith('2001::')) return true;
  }
  return false;
}

/** Returns an Indonesian error message, or `null` when the base URL is acceptable. Empty input is validated by the caller. */
export function validateBaseUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'Bukan URL yang valid. Contoh: https://api.penyedia.com/v1';
  }
  if (url.protocol !== 'https:') return 'Gunakan https:// (http tidak diizinkan untuk host publik).';
  if (url.username || url.password) return 'URL tidak boleh memuat username atau password.';
  if (url.search || url.hash) return 'URL tidak boleh memuat query (?) atau fragment (#). API key tidak boleh dikirim lewat URL.';
  if (isDisallowedHost(url.hostname)) return 'Host harus publik: localhost, alamat privat, dan link-local ditolak.';
  return null;
}

export interface ModelFormValues {
  provider: ModelProvider;
  api_key_env: string;
  base_url: string;
}

/** Cross-field rules of the create form (mock takes no key; real providers need one; openai_compat needs a base URL). */
export function validateModelProviderFields(v: ModelFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const env = v.api_key_env.trim();
  const base = v.base_url.trim();
  if (v.provider === 'mock') {
    if (env) errors.api_key_env = 'Provider mock tidak memakai API key. Kosongkan kolom ini.';
  } else if (!env) {
    errors.api_key_env = 'Wajib diisi untuk provider ini.';
  } else {
    const msg = validateApiKeyEnv(env);
    if (msg) errors.api_key_env = msg;
  }
  if (v.provider === 'openai_compat' && !base) errors.base_url = 'Wajib diisi untuk provider openai_compat.';
  if (base) {
    const msg = validateBaseUrl(base);
    if (msg) errors.base_url = msg;
  }
  return errors;
}
