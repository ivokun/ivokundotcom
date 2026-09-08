/**
 * Boot-test for the compiled CMS binary: starts it with dev env vars,
 * curls the public API + health endpoint, then reports results.
 * Usage: bun scripts/boot-test.ts <path-to-binary>
 */
const binary = process.argv[2] ?? './dist/cms';
const port = '3999';

const proc = Bun.spawn([binary], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: port,
    DATABASE_URL: 'postgres://postgres@127.0.0.1:5432/ivokundotcom_test?sslmode=disable',
    SESSION_SECRET: 'boot-test-secret-32-chars-long-ok!!!',
    R2_ACCESS_KEY_ID: 'boot-test-key',
    R2_ACCESS_SECRET: 'boot-test-secret-not-real',
    R2_ENDPOINT: 'https://boot-test.invalid',
    R2_BUCKET: 'boot-test-bucket',
    R2_PUBLIC_URL: 'https://boot-test.invalid/pub',
  },
  stdout: 'pipe',
  stderr: 'pipe',
});

let stderr = '';
let stdout = '';
const collectStderr = (async () => {
  try {
    for await (const chunk of proc.stderr) stderr += new TextDecoder().decode(chunk);
  } catch {}
})();
const collectStdout = (async () => {
  try {
    for await (const chunk of proc.stdout) stdout += new TextDecoder().decode(chunk);
  } catch {}
})();

const results: string[] = [];
let ok = true;
try {
  // wait for the server to come up
  let ready = false;
  for (let i = 0; i < 20; i++) {
    await Bun.sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) { ready = true; break; }
    } catch {}
  }
  if (!ready) {
    results.push('FAIL: server never became ready on /health');
    ok = false;
  } else {
    results.push('ok: /health responds');
    // /api/posts is API-key gated: an invalid key must yield 401 WITH a
    // non-empty JSON error body (regression guard for the May 2026
    // empty-body 500 class of bugs - see docs/adr/013).
    const posts = await fetch(`http://127.0.0.1:${port}/api/posts`, {
      headers: { 'X-API-Key': 'definitely-invalid-key' },
    });
    const bodyText = await posts.text();
    const bodyIsJson = bodyText.trim().startsWith('{');
    if (posts.status === 401 && bodyIsJson) {
      results.push('ok: /api/posts -> 401 with non-empty JSON body (auth gate + error pipeline intact)');
    } else {
      results.push(`FAIL: /api/posts -> HTTP ${posts.status}, body JSON: ${bodyIsJson}, body: ${bodyText.slice(0, 120)}`);
      ok = false;
    }
  }
} finally {
  proc.kill();
  await collectStderr;
  await collectStdout;
}

console.log(results.join('\n'));
if (stdout.trim()) {
  console.log('--- stdout (first 800 chars) ---');
  console.log(stdout.slice(0, 800));
}
if (stderr.trim()) {
  console.log('--- stderr (first 500 chars) ---');
  console.log(stderr.slice(0, 500));
}
process.exit(ok ? 0 : 1);
