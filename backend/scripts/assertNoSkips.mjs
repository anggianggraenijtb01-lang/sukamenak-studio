#!/usr/bin/env node
/**
 * Fails when a Vitest JSON report contains any skipped or todo test, so a test can never turn into a silent pass.
 *
 *   vitest run --reporter=default --reporter=json --outputFile=test-results.json
 *   node scripts/assertNoSkips.mjs test-results.json
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'test-results.json';

let report;
try {
  report = JSON.parse(readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`assertNoSkips: cannot read the Vitest JSON report "${file}": ${error.message}`);
  process.exit(2);
}

const notRun = [];
for (const suite of report.testResults ?? []) {
  const where = String(suite.name ?? '').replace(/\\/g, '/').split('/').slice(-3).join('/');
  for (const test of suite.assertionResults ?? []) {
    if (test.status !== 'passed') notRun.push(`${where} :: ${test.status} :: ${test.fullName}`);
  }
}

console.log(`assertNoSkips: ${report.numTotalTests} tests, ${report.numPassedTests} passed, ${report.numFailedTests} failed, ${report.numPendingTests} skipped, ${report.numTodoTests} todo`);

if (report.numTotalTests === 0) {
  console.error('assertNoSkips: the report contains no tests at all.');
  process.exit(1);
}

if (report.numPendingTests > 0 || report.numTodoTests > 0 || notRun.length > 0) {
  console.error('\nassertNoSkips: tests that did not run as passed (a skipped test is a failure here):');
  for (const line of notRun) console.error(`  - ${line}`);
  process.exit(1);
}
