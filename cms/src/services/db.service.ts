/**
 * @fileoverview Database service using Kysely with Effect TS
 * @see PRD Section 5.1 - DbService layer
 */

import { Context, Effect, Layer, Scope } from 'effect';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import { DatabaseError } from '../errors';
import type { Database } from '../types';

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export class DbService extends Context.Tag('DbService')<
  DbService,
  {
    readonly db: Kysely<Database>;
    readonly query: <T>(
      operation: string,
      fn: (db: Kysely<Database>) => Promise<T>
    ) => Effect.Effect<T, DatabaseError>;
    readonly transaction: <T, E>(
      fn: (trx: Kysely<Database>) => Effect.Effect<T, E>
    ) => Effect.Effect<T, E | DatabaseError>;
  }
>() {}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export const makeDbService = (connectionString: string) =>
  Effect.gen(function* () {
    const pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    const db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    });

    // Test connection
    yield* Effect.tryPromise({
      try: () => db.selectFrom('users').select('id').limit(1).execute(),
      catch: (error) =>
        new DatabaseError({
          cause: error,
          operation: 'connection_test',
        }),
    });

    const query = <T>(
      operation: string,
      fn: (db: Kysely<Database>) => Promise<T>
    ): Effect.Effect<T, DatabaseError> =>
      Effect.tryPromise({
        try: () => fn(db),
        catch: (error) => new DatabaseError({ cause: error, operation }),
      });

    const transaction = <T, E>(
      fn: (trx: Kysely<Database>) => Effect.Effect<T, E>
    ): Effect.Effect<T, E | DatabaseError> =>
      Effect.tryPromise({
        try: () => db.transaction().execute((trx) => Effect.runPromise(fn(trx))),
        catch: (error) => new DatabaseError({ cause: error, operation: 'transaction' }),
      });

    // Register cleanup
    yield* Effect.addFinalizer(() =>
      Effect.promise(async () => {
        await db.destroy();
        try {
          await pool.end();
        } catch (e) {
          // Ignore if already closed by db.destroy()
        }
      })
    );

    return { db, query, transaction };
  });

// =============================================================================
// LAYER
// =============================================================================

export const DbServiceLive = (connectionString: string) =>
  Layer.scoped(DbService, makeDbService(connectionString));
