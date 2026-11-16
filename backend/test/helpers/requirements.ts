/**
 * Tests that need something outside the test process (Redis, MinIO, a built frontend) must never turn into a silent
 * pass. A missing dependency FAILS the suite and says how to fix it.
 *
 * A developer without that dependency (no Docker, no frontend build) can opt out on purpose with TEST_ALLOW_SKIP=1.
 * The skip is then announced on stderr, and CI refuses it twice over: it never sets the flag, and
 * scripts/assertNoSkips.mjs fails the run when the report contains any skipped or todo test.
 */
export const allowSkip = process.env.TEST_ALLOW_SKIP === '1';

/**
 * Returns `available` when the dependency is there. When it is missing it throws (default) or, only with
 * TEST_ALLOW_SKIP=1, logs loudly and returns false so the caller can skip its tests.
 */
export function requireDependency(available: boolean, what: string, howToFix: string): boolean {
  if (available) return true;
  const message = `${what} is not available. ${howToFix}`;
  if (!allowSkip) throw new Error(`${message} (To skip these tests on purpose, set TEST_ALLOW_SKIP=1.)`);
  process.stderr.write(`\n!! SKIPPED ON PURPOSE (TEST_ALLOW_SKIP=1): ${message}\n`);
  return false;
}
