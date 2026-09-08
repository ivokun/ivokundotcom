import { describe, expect, it } from 'bun:test';
import { Cause, Effect, Exit } from 'effect';

import { AppConfig } from './config';

/**
 * SEC-001 fail-fast contract (hardening round, 2026-08):
 * production with a wildcard/empty CORS_ORIGIN must refuse to start,
 * development may still default to '*'.
 */

const BASE_ENV: Record<string, string> = {
  DATABASE_URL: 'postgres://pguser:pgpass@localhost:5432/ivokundotcom_test?sslmode=disable',
  SESSION_SECRET: 'test-secret-min-32-chars-long-for-config-tests!',
  R2_ACCESS_KEY_ID: 'test-key',
  R2_ACCESS_SECRET: 'test-secret',
  R2_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
  R2_BUCKET: 'test-bucket',
  R2_PUBLIC_URL: 'https://media.example.com',
};

const CORS_KEYS = ['NODE_ENV', 'CORS_ORIGIN'] as const;

async function runConfig(env: Record<string, string | undefined>) {
  const saved: Record<string, string | undefined> = {};
  for (const k of [...CORS_KEYS, ...Object.keys(BASE_ENV)]) {
    saved[k] = process.env[k];
  }
  try {
    // Deterministic env per test: wipe, then apply.
    delete process.env['NODE_ENV'];
    delete process.env['CORS_ORIGIN'];
    for (const [k, v] of Object.entries(BASE_ENV)) process.env[k] = v;
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }

    const program = Effect.gen(function* () {
      return yield* AppConfig;
    }).pipe(Effect.provide(AppConfig.Default));

    return await Effect.runPromiseExit(program);
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const dieMessage = (exit: Exit.Exit<unknown, unknown>): string => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (!Exit.isFailure(exit)) return '';
  return Cause.pretty(exit.cause);
};

describe('SEC-001: CORS fail-fast in production', () => {
  it('dies when CORS_ORIGIN is unset in production', async () => {
    const exit = await runConfig({ NODE_ENV: 'production', CORS_ORIGIN: undefined });
    expect(dieMessage(exit)).toContain('CORS_ORIGIN');
  });

  it('dies when CORS_ORIGIN is wildcard (*) in production', async () => {
    const exit = await runConfig({ NODE_ENV: 'production', CORS_ORIGIN: '*' });
    expect(dieMessage(exit)).toContain('CORS_ORIGIN');
  });

  it('succeeds with a specific origin in production', async () => {
    const exit = await runConfig({ NODE_ENV: 'production', CORS_ORIGIN: 'https://ivokun.com' });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.corsOrigin).toBe('https://ivokun.com');
    }
  });

  it('still allows wildcard default in development', async () => {
    const exit = await runConfig({ NODE_ENV: 'development', CORS_ORIGIN: undefined });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.corsOrigin).toBe('*');
    }
  });
});
