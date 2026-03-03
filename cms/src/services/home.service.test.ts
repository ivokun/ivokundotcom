import { describe, expect, it, mock } from 'bun:test';
import { Effect, Layer } from 'effect';

import type { Home } from '../types';
import { DbService } from './db.service';
import { HomeService, type HomeWithArrayKeywords,makeHomeService } from './home.service';
import { WebhookServiceLive } from './webhook.service';

const mockDbService = (queryFn: (op: string, fn: any) => Effect.Effect<any, any>) =>
  Layer.succeed(
    DbService,
    DbService.of({
      db: {} as any,
      query: queryFn,
      transaction: (fn) => fn({} as any) as any,
    })
  );

/** Mock raw DB home (keywords as string | null) */
const mockDbHome = (overrides: Partial<Home> = {}): Home => ({
  id: 'singleton',
  title: 'Home',
  short_description: null,
  description: null,
  hero: null,
  keywords: null,
  updated_at: new Date(),
  ...overrides,
});

/** Expected service response (keywords as string[]) */
const mockHomeResponse = (overrides: Partial<HomeWithArrayKeywords> = {}): HomeWithArrayKeywords => ({
  id: 'singleton',
  title: 'Home',
  short_description: null,
  description: null,
  hero: null,
  keywords: [],
  updated_at: new Date(),
  ...overrides,
});

describe('HomeService', () => {
  it('should get home', async () => {
    const dbHome = mockDbHome();
    const expectedResponse = mockHomeResponse();
    const queryStub = mock((op: string) => {
      if (op === 'get_home') return Effect.succeed(dbHome);
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const HomeServiceLayer = Layer.effect(HomeService, makeHomeService).pipe(
      Layer.provide(WebhookServiceLive)
    );

    const program = Effect.gen(function* () {
      const service = yield* HomeService;
      return yield* service.get();
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(HomeServiceLayer), Effect.provide(layer))
    );

    expect(result).toEqual(expectedResponse);
  });

  it('should update home', async () => {
    const dbHome = mockDbHome({ title: 'Updated', keywords: 'Updated' });
    const expectedResponse = mockHomeResponse({ title: 'Updated', keywords: ['Updated'] });
    const queryStub = mock((op: string) => {
      if (op === 'update_home') return Effect.succeed(dbHome);
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const HomeServiceLayer = Layer.effect(HomeService, makeHomeService).pipe(
      Layer.provide(WebhookServiceLive)
    );

    const program = Effect.gen(function* () {
      const service = yield* HomeService;
      return yield* service.update({ title: 'Updated' });
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(HomeServiceLayer), Effect.provide(layer))
    );

    expect(result).toEqual(expectedResponse);
  });
});
