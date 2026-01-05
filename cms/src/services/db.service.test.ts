import { Effect, Layer, Scope } from 'effect';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { DbService, DbServiceLive } from './db.service';

const TEST_DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://cms_user:cms_password@localhost:5432/ivokun_cms';

describe('DbService', () => {
  test('connects to database successfully', async () => {
    const program = Effect.gen(function* () {
      const { query } = yield* DbService;
      const result = yield* query('test_query', (db) =>
        db.selectFrom('home').select('id').execute()
      );
      return result;
    });

    const scope = Effect.runSync(Scope.make());
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(DbServiceLive(TEST_DB_URL)), Effect.scoped)
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('singleton');
  });

  test('wraps database errors correctly', async () => {
    const program = Effect.gen(function* () {
      const { query } = yield* DbService;
      return yield* query('invalid_query', (db) =>
        db.selectFrom('nonexistent_table' as any).selectAll().execute()
      );
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(DbServiceLive(TEST_DB_URL)),
        Effect.scoped,
        Effect.either
      )
    );

    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('DatabaseError');
    }
  });
});
