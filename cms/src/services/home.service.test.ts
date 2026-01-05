import { describe, expect, it, mock } from 'bun:test';
import { Effect, Layer } from 'effect';

import type { Home } from '../types';

import { DbService } from './db.service';
import { HomeService, makeHomeService } from './home.service';

const mockDbService = (queryFn: (op: string, fn: any) => Effect.Effect<any, any>) =>
  Layer.succeed(
    DbService,
    DbService.of({
      db: {} as any,
      query: queryFn,
      transaction: (fn) => fn({} as any) as any,
    })
  );

const mockHome = (overrides: Partial<Home> = {}): Home => ({
  id: 'singleton',
  title: 'Home',
  short_description: null,
  description: null,
  hero: null,
  keywords: null,
  updated_at: new Date(),
  ...overrides,
});

describe('HomeService', () => {
  it('should get home', async () => {
    const home = mockHome();
    const queryStub = mock((op: string) => {
      if (op === 'get_home') return Effect.succeed(home);
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const HomeServiceLayer = Layer.effect(HomeService, makeHomeService);

    const program = Effect.gen(function* () {
      const service = yield* HomeService;
      return yield* service.get();
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(HomeServiceLayer), Effect.provide(layer))
    );

    expect(result).toEqual(home);
  });

  it('should update home', async () => {
    const home = mockHome({ title: 'Updated' });
    const queryStub = mock((op: string) => {
      if (op === 'update_home') return Effect.succeed(home);
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const HomeServiceLayer = Layer.effect(HomeService, makeHomeService);

    const program = Effect.gen(function* () {
      const service = yield* HomeService;
      return yield* service.update({ title: 'Updated' });
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(HomeServiceLayer), Effect.provide(layer))
    );

    expect(result).toEqual(home);
  });
});
