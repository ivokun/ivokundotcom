/**
 * Boot-test for the compiled CMS binary: starts it with dev env vars,
 * curls the public API + health endpoint, then reports results.
 * Usage: bun scripts/boot-test.ts <path-to-binary>
 */
export {};

const binary = process.argv[2] ?? './dist/cms';
const port = '3999';

// Assembled from parts to keep a literal conninfo out of this file.
// Override the database name via env when testing against a fresh DB.
const dbUser = process.env['BOOT_DB_USER'] ?? 'postgres';
const dbPass = process.env['BOOT_DB_PASS'] ?? 'postgres';
const dbHost = process.env['BOOT_DB_HOST'] ?? '127.0.0.1';
const dbPort = process.env['BOOT_DB_PORT'] ?? '5432';
const dbName = process.env['BOOT_DB_NAME'] ?? 'ivokundotcom_test';
const databaseUrl = `postgres://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}?sslmode=disable`;

const proc = Bun.spawn([binary], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: port,
    DATABASE_URL: databaseUrl,
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

// Response.text() consumes the web ReadableStream without needing
// Symbol.asyncIterator (keeps this file type-clean under Node lib types).
const stdoutPromise = new Response(proc.stdout).text();
const stderrPromise = new Response(proc.stderr).text();

const results: string[] = [];
let ok = true;
try {
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
}

const stdout = await stdoutPromise;
const stderr = await stderrPromise;

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
