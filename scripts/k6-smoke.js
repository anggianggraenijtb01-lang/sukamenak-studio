/**
 * Phase H (docs/IMPLEMENTATION_PLAN.md): the k6 smoke test.
 *
 * Reads the endpoints every page hits on load, with a logged-in session, and fails the run when they get
 * slow. It is deliberately read-only: it never creates a generation, so it costs nothing on staging and
 * leaves no rows behind. The generation journey is covered by the Playwright specs instead.
 *
 *   k6 run scripts/k6-smoke.js
 *   BASE=https://staging.sukamenak.org/api/v1 DEMO_EMAIL=... DEMO_PASSWORD=... k6 run scripts/k6-smoke.js
 *
 * Without k6 installed: docker run --rm -i -e BASE=... -v "$PWD/scripts:/scripts" \
 *   grafana/k6 run /scripts/k6-smoke.js      (Windows: point BASE at host.docker.internal, not 127.0.0.1)
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://127.0.0.1:3000/api/v1';
const EMAIL = __ENV.DEMO_EMAIL || 'demo@sukamenak.studio';
const PASSWORD = __ENV.DEMO_PASSWORD || '';

// The API applies a GLOBAL per-IP budget (RATE_LIMIT_PER_MINUTE, 60 by default). This profile must stay
// under it or every request answers 429 and the run measures the limiter, not the app. One iteration
// sends 4 requests (health, templates, gallery, me), so SLEEP_S=5 is ~48/min: a smoke test, not a load
// test. To push real load, raise RATE_LIMIT_PER_MINUTE on the target first and lower SLEEP_S here.
const SLEEP_S = __ENV.SLEEP_S ? Number(__ENV.SLEEP_S) : 5;

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: __ENV.DURATION || '60s',
    },
  },
  thresholds: {
    // The reads a page needs before it can render: anything slower is visible to the user.
    'http_req_duration{kind:read}': ['p(95)<1000'],
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  if (!PASSWORD) return { token: null };
  const res = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { kind: 'auth' } },
  );
  const ok = check(res, { 'login 200': (r) => r.status === 200 });
  if (!ok) return { token: null };
  return { token: res.json('data.access_token') };
}

const headers = (token) => ({
  headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
});

/**
 * Never let a malformed or empty body throw: an exception aborts the iteration before the closing
 * sleep, which turns a dead endpoint into a hot loop hammering the target.
 */
const safeJson = (res) => {
  try {
    return res.json();
  } catch {
    return null;
  }
};

export default function (data) {
  try {
    group('health', () => {
      const res = http.get(`${BASE}/health`, { tags: { kind: 'read' } });
      check(res, {
        'health 200': (r) => r.status === 200,
        // A 429 here means this profile passed RATE_LIMIT_PER_MINUTE of the target; the numbers below
        // would then describe the limiter instead of the app.
        'health not rate limited': (r) => r.status !== 429,
      });
    });

    group('templates', () => {
      const res = http.get(`${BASE}/templates`, { tags: { kind: 'read' } });
      check(res, {
        'templates 200': (r) => r.status === 200,
        'has a list': (r) => {
          const body = safeJson(r);
          return Array.isArray(body?.data) && body.data.length > 0;
        },
      });
    });

    group('gallery', () => {
      const res = http.get(`${BASE}/gallery`, { tags: { kind: 'read' } });
      check(res, { 'gallery 200': (r) => r.status === 200 });
    });

    if (data.token) {
      group('me', () => {
        const res = http.get(`${BASE}/me`, { ...headers(data.token), tags: { kind: 'read' } });
        check(res, { 'me 200': (r) => r.status === 200 });
      });
    }
  } finally {
    // One iteration per SLEEP_S per VU, whatever happened above.
    sleep(SLEEP_S);
  }
}
