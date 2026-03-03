import { Context, Effect, Layer } from 'effect';

import { DatabaseError, NotFound } from '../errors';
import type { Home, HomeUpdate } from '../types';
import { DbService } from './db.service';
import { WebhookService } from './webhook.service';

const HOME_ID = 'singleton';

/** Home data with keywords as string array for API */
export interface HomeWithArrayKeywords extends Omit<Home, 'keywords'> {
  keywords: string[];
}

/** Input for updating home with keywords as string array */
export interface UpdateHomeInput extends Omit<HomeUpdate, 'keywords'> {
  keywords?: string[];
}

export class HomeService extends Context.Tag('HomeService')<
  HomeService,
  {
    readonly get: () => Effect.Effect<HomeWithArrayKeywords, DatabaseError | NotFound>;
    readonly update: (data: UpdateHomeInput) => Effect.Effect<HomeWithArrayKeywords, DatabaseError>;
  }
>() {}

/** Convert DB keywords string to array */
const parseKeywords = (keywords: string | null): string[] =>
  keywords ? keywords.split(',').map((k) => k.trim()).filter(Boolean) : [];

/** Convert keywords array to DB string */
const serializeKeywords = (keywords: string[] | undefined): string | null =>
  keywords && keywords.length > 0 ? keywords.join(',') : null;

export const makeHomeService = Effect.gen(function* () {
  const { query } = yield* DbService;
  const webhookService = yield* WebhookService;

  // Helper to trigger deploy in background (fire-and-forget)
  const triggerDeploy = () =>
    webhookService.triggerDeploy().pipe(
      Effect.catchAll((error) =>
        Effect.logWarning(`Deploy webhook failed: ${error.message}`).pipe(Effect.andThen(() => Effect.void))
      ),
      Effect.fork,
      Effect.andThen(() => Effect.void)
    );

  const get = () =>
    query('get_home', (db) =>
      db.selectFrom('home').selectAll().where('id', '=', HOME_ID).executeTakeFirst()
    ).pipe(
      Effect.flatMap((home) =>
        home
          ? Effect.succeed({
              ...home,
              keywords: parseKeywords(home.keywords),
            })
          : Effect.fail(new NotFound({ resource: 'Home', id: HOME_ID }))
      )
    );

  const update = (data: UpdateHomeInput) =>
    Effect.gen(function* () {
      // Upsert pattern: update if exists, insert if not (with ID='singleton')
      // Kysely `onConflict` can be used.

      const updateData: HomeUpdate = {
        ...data,
        keywords: serializeKeywords(data.keywords),
        updated_at: new Date(),
      };

      const result = yield* query('update_home', (db) =>
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

      yield* triggerDeploy();

      return {
        ...result,
        keywords: parseKeywords(result.keywords),
      };
    });

  return { get, update };
});

export const HomeServiceLive = Layer.effect(HomeService, makeHomeService);
