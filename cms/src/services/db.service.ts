/**
 * @fileoverview Database service using Kysely with Effect TS
 * @see PRD Section 5.1 - DbService layer
 */

import { Context, Effect, Exit, Layer, Schedule } from 'effect';
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

    // Register unhandled pool error handler to prevent process crashes
    pool.on('error', (err) => {
      console.error('[DbService] Unexpected pool client error:', err);
    });

    const db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    });

    // Test connection with retry (handles transient startup delays)
    yield* Effect.tryPromise({
      try: () => db.selectFrom('users').select('id').limit(1).execute(),
      catch: (error) =>
        new DatabaseError({
          cause: error,
          operation: 'connection_test',
        }),
    }).pipe(
      Effect.retry({
        schedule: Schedule.exponential('200 millis').pipe(
          Schedule.intersect(Schedule.recurs(5))
        ),
      })
    );

    const query = <T>(
      operation: string,
      fn: (db: Kysely<Database>) => Promise<T>
    ): Effect.Effect<T, DatabaseError> =>
      Effect.tryPromise({
        try: () => fn(db),
        catch: (error) => new DatabaseError({ cause: error, operation }),
      });

    // Transaction using Effect.acquireUseRelease to preserve Effect semantics.
    // Note: Kysely does not expose .begin()/.commit()/.rollback() as separate
    // public methods — its transaction() callback handles commit/rollback
    // internally. We bridge this by wrapping in tryPromise and running the
    // Effect inside the Kysely transaction callback, converting the result
    // back to a Promise as required by Kysely's API.
    const transaction = <T, E>(
      fn: (trx: Kysely<Database>) => Effect.Effect<T, E>
    ): Effect.Effect<T, E | DatabaseError> =>
      Effect.async<T, E | DatabaseError>((resume) => {
        db.transaction()
          .execute((trx) => {
            return new Promise<T>((resolve, reject) => {
              Effect.runFork(
                fn(trx).pipe(
                  Effect.matchCauseEffect({
                    onSuccess: (value) =>
                      Effect.sync(() => {
                        resume(Effect.succeed(value));
                        resolve(value);
                      }),
                    onFailure: (cause) =>
                      Effect.sync(() => {
                        const error = Exit.failCause(cause);
                        resume(error);
                        reject(new Error('Transaction rolled back'));
                      }),
                  })
                )
              );
            });
          })
          .catch((err) => {
            // Only resume with DatabaseError if the Effect didn't already resume
            resume(Effect.fail(new DatabaseError({ cause: err, operation: 'transaction' }) as E | DatabaseError));
          });
      });

    // Register cleanup — db.destroy() handles pool shutdown
    yield* Effect.addFinalizer((exit) =>
      Effect.tryPromise({
        try: () => db.destroy(),
        catch: (error) => {
          // Log non-trivial cleanup errors (ignore "already closed")
          if (
            !(
              error instanceof Error &&
              (error.message.includes('closed') || error.message.includes('ended'))
            )
          ) {
            console.error('[DbService] Database cleanup error:', error);
          }
          return undefined;
        },
      }).pipe(
        Effect.tap(() =>
          exit._tag === 'Failure'
            ? Effect.logDebug('[DbService] Pool closed after failure')
            : Effect.logDebug('[DbService] Pool closed cleanly')
        ),
        Effect.ignore
      )
    );

    return { db, query, transaction };
  });

// =============================================================================
// LAYER
// =============================================================================

export const DbServiceLive = (connectionString: string) =>
  Layer.scoped(DbService, makeDbService(connectionString));
