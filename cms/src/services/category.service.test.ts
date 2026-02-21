import { describe, expect, it, mock } from 'bun:test';
import { Effect, Layer } from 'effect';

import type { Category } from '../types';
import { CategoryService, makeCategoryService } from './category.service';
import { DbService } from './db.service';

const mockDbService = (queryFn: (op: string, fn: any) => Effect.Effect<any, any>) =>
  Layer.succeed(
    DbService,
    DbService.of({
      db: {} as any,
      query: queryFn,
      transaction: (fn) => fn({} as any) as any,
    })
  );

const mockCategory = (overrides: Partial<Category> = {}): Category => ({
  id: '123',
  name: 'Test',
  slug: 'test',
  description: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('CategoryService', () => {
  it('should create a category', async () => {
    const category = mockCategory();
    const queryStub = mock((op: string) => {
      if (op === 'check_slug') return Effect.succeed(undefined);
      if (op === 'create_category') return Effect.succeed(category);
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const CategoryServiceLayer = Layer.effect(CategoryService, makeCategoryService);
    
    const program = Effect.gen(function* () {
      const service = yield* CategoryService;
      return yield* service.create({ name: 'Test' });
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(CategoryServiceLayer), Effect.provide(layer))
    );

    expect(result).toEqual(category);
    expect(queryStub).toHaveBeenCalledTimes(2);
  });

  it('should fail create on slug conflict', async () => {
    const queryStub = mock((op: string) => {
      if (op === 'check_slug') return Effect.succeed({ id: 'existing' });
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const CategoryServiceLayer = Layer.effect(CategoryService, makeCategoryService);

    const program = Effect.gen(function* () {
      const service = yield* CategoryService;
      return yield* service.create({ name: 'Test' });
    });

    const result = await Effect.runPromiseExit(
      program.pipe(Effect.provide(CategoryServiceLayer), Effect.provide(layer))
    );

    expect(result._tag).toBe('Failure');
    if (result._tag === 'Failure') {
      // @ts-ignore
      expect(result.cause.error._tag).toBe('SlugConflict');
    }
  });

  it('should find category by id', async () => {
    const category = mockCategory();
    const queryStub = mock((op: string) => {
      if (op === 'find_category_by_id') return Effect.succeed(category);
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const CategoryServiceLayer = Layer.effect(CategoryService, makeCategoryService);

    const program = Effect.gen(function* () {
      const service = yield* CategoryService;
      return yield* service.findById('123');
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(CategoryServiceLayer), Effect.provide(layer))
    );

    expect(result).toEqual(category);
  });

  it('should fail findById if not found', async () => {
    const queryStub = mock((op: string) => {
      if (op === 'find_category_by_id') return Effect.succeed(undefined);
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const CategoryServiceLayer = Layer.effect(CategoryService, makeCategoryService);

    const program = Effect.gen(function* () {
      const service = yield* CategoryService;
      return yield* service.findById('123');
    });

    const result = await Effect.runPromiseExit(
      program.pipe(Effect.provide(CategoryServiceLayer), Effect.provide(layer))
    );

    expect(result._tag).toBe('Failure');
    if (result._tag === 'Failure') {
      // @ts-ignore
      expect(result.cause.error._tag).toBe('NotFound');
    }
  });

  it('should update category', async () => {
    const oldCategory = mockCategory({ name: 'Old', slug: 'old' });
    const newCategory = mockCategory({ name: 'New', slug: 'new' });
    
    const queryStub = mock((op: string) => {
      if (op === 'find_category_by_id') return Effect.succeed(oldCategory);
      if (op === 'check_slug_update') return Effect.succeed(undefined);
      if (op === 'update_category') return Effect.succeed(newCategory);
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const CategoryServiceLayer = Layer.effect(CategoryService, makeCategoryService);

    const program = Effect.gen(function* () {
      const service = yield* CategoryService;
      return yield* service.update('123', { name: 'New' });
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(CategoryServiceLayer), Effect.provide(layer))
    );

    expect(result).toEqual(newCategory);
  });
});
