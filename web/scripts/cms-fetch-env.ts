#!/usr/bin/env bun
/**
 * Helper spawned by api.test.ts to exercise cmsFetch env handling in a
 * clean process. cmsFetch captures import.meta.env at module-eval time,
 * so env cases need a fresh process rather than a mutated one.
 *
 * Usage: bun cms-fetch-env.ts <case>
 *   missing-url    -> CMS_API_URL unset, expect the descriptive error
 *   unreachable    -> CMS points at a dead port, expect "unreachable"
 */

const testCase = process.argv[2];

if (testCase === 'missing-url') {
  delete process.env['CMS_API_URL'];
  delete process.env['CMS_API_TOKEN'];
} else if (testCase === 'unreachable') {
  process.env['CMS_API_URL'] = 'http://127.0.0.1:1';
  process.env['CMS_API_TOKEN'] = 'dummy-token';
} else {
  console.error(`unknown case: ${testCase}`);
  process.exit(2);
}

const { cmsFetch } = await import('../src/api/cms');

let message = '';
try {
  await cmsFetch('api/posts');
} catch (e) {
  message = e instanceof Error ? e.message : String(e);
}

const expected = testCase === 'missing-url' ? 'CMS_API_URL' : 'unreachable';
if (message.includes(expected)) {
  console.log(`OK: ${message}`);
  process.exit(0);
}
console.error(`FAIL: expected message containing "${expected}", got: ${message}`);
process.exit(1);
