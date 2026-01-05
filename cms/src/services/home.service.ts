import { Context, Effect, Layer } from 'effect';

import { DatabaseError, NotFound } from '../errors';
import type { Home, HomeUpdate } from '../types';

import { DbService } from './db.service';

const HOME_ID = 'singleton';

export class HomeService extends Context.Tag('HomeService')<
  HomeService,
  {
    readonly get: () => Effect.Effect<Home, DatabaseError | NotFound>;
    readonly update: (data: HomeUpdate) => Effect.Effect<Home, DatabaseError>;
  }
>() {}

export const makeHomeService = Effect.gen(function* () {
  const { query } = yield* DbService;

  const get = () =>
    query('get_home', (db) =>
      db.selectFrom('home').selectAll().where('id', '=', HOME_ID).executeTakeFirst()
    ).pipe(
      Effect.flatMap((home) =>
        home
          ? Effect.succeed(home)
          : Effect.fail(new NotFound({ resource: 'Home', id: HOME_ID }))
      )
    );

  const update = (data: HomeUpdate) =>
    Effect.gen(function* () {
      // Upsert pattern: update if exists, insert if not (with ID='singleton')
      // Kysely `onConflict` can be used.

      const updateData = {
        ...data,
        updated_at: new Date(),
      };

      return yield* query('update_home', (db) =>
        db
          .insertInto('home')
          .values({
            id: HOME_ID,
            ...updateData,
          })
          .onConflict((oc) =>
            oc.column('id').doUpdateSet({
              ...updateData,
            })
          )
          .returningAll()
          .executeTakeFirstOrThrow()
      );
    });

  return { get, update };
});

export const HomeServiceLive = Layer.effect(HomeService, makeHomeService);
