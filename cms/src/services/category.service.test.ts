import { describe, expect, it, mock } from 'bun:test';
import { Effect, Layer } from 'effect';

import type { Category } from '../types';
import { CategoryService, makeCategoryService } from './category.service';
import { DbService } from './db.service';
import { WebhookService } from './webhook.service';

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

const mockWebhookService = Layer.succeed(
  WebhookService,
  WebhookService.of({
    triggerDeploy: () => Effect.void,
  })
);

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
      program.pipe(
        Effect.provide(CategoryServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
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
      program.pipe(
        Effect.provide(CategoryServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
    );

    expect(result._tag).toBe('Failure');
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
      program.pipe(
        Effect.provide(CategoryServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
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
      program.pipe(
        Effect.provide(CategoryServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
    );

    expect(result._tag).toBe('Failure');
  });

  describe('update', () => {
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
        program.pipe(
          Effect.provide(CategoryServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result).toEqual(newCategory);
    });

    it('should update without changing slug when name is unchanged', async () => {
      const category = mockCategory({ name: 'Same Name', slug: 'same-name' });
      const updatedCategory = mockCategory({
        name: 'Same Name',
        slug: 'same-name',
        description: 'New description',
      });

      const queryStub = mock((op: string) => {
        if (op === 'find_category_by_id') return Effect.succeed(category);
        if (op === 'update_category') return Effect.succeed(updatedCategory);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const CategoryServiceLayer = Layer.effect(CategoryService, makeCategoryService);

      const program = Effect.gen(function* () {
        const service = yield* CategoryService;
        return yield* service.update('123', { description: 'New description' });
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(CategoryServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result.slug).toBe('same-name');
      expect(result.description).toBe('New description');
    });

    it('should fail update on slug conflict', async () => {
      const category = mockCategory({ name: 'Old', slug: 'old' });

      const queryStub = mock((op: string) => {
        if (op === 'find_category_by_id') return Effect.succeed(category);
        if (op === 'check_slug_update') return Effect.succeed({ id: 'other-cat' });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const CategoryServiceLayer = Layer.effect(CategoryService, makeCategoryService);

      const program = Effect.gen(function* () {
        const service = yield* CategoryService;
        return yield* service.update('123', { name: 'Conflicting', slug: 'existing-slug' });
      });

      const result = await Effect.runPromiseExit(
        program.pipe(
          Effect.provide(CategoryServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('findBySlug', () => {
    it('should find category by slug', async () => {
      const category = mockCategory();
      const queryStub = mock((op: string) => {
        if (op === 'find_category_by_slug') return Effect.succeed(category);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const CategoryServiceLayer = Layer.effect(CategoryService, makeCategoryService);

      const program = Effect.gen(function* () {
        const service = yield* CategoryService;
        return yield* service.findBySlug('test');
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(CategoryServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result).toEqual(category);
    });

    it('should fail findBySlug if not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'find_category_by_slug') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const CategoryServiceLayer = Layer.effect(CategoryService, makeCategoryService);

      const program = Effect.gen(function* () {
        const service = yield* CategoryService;
        return yield* service.findBySlug('non-existent');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(
          Effect.provide(CategoryServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('findAll', () => {
    it('should find all categories with pagination', async () => {
      const category = mockCategory();
      const queryStub = mock((op: string) => {
        if (op === 'find_all_categories') return Effect.succeed([category]);
        if (op === 'count_categories') return Effect.succeed({ count: '1' });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const CategoryServiceLayer = Layer.effect(CategoryService, makeCategoryService);

      const program = Effect.gen(function* () {
        const service = yield* CategoryService;
        return yield* service.findAll({ limit: 10, offset: 0 });
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(CategoryServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.offset).toBe(0);
    });

    it('should respect custom pagination params', async () => {
      const category = mockCategory();
      const queryStub = mock((op: string) => {
        if (op === 'find_all_categories') return Effect.succeed([category]);
        if (op === 'count_categories') return Effect.succeed({ count: '5' });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const CategoryServiceLayer = Layer.effect(CategoryService, makeCategoryService);

      const program = Effect.gen(function* () {
        const service = yield* CategoryService;
        return yield* service.findAll({ limit: 5, offset: 10 });
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(CategoryServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result.meta.limit).toBe(5);
      expect(result.meta.offset).toBe(10);
    });
  });

  describe('delete', () => {
    it('should delete a category', async () => {
      const category = mockCategory();
      const queryStub = mock((op: string) => {
        if (op === 'find_category_by_id') return Effect.succeed(category);
        if (op === 'check_category_usage') return Effect.succeed({ count: '0' });
        if (op === 'delete_category') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const CategoryServiceLayer = Layer.effect(CategoryService, makeCategoryService);

      const program = Effect.gen(function* () {
        const service = yield* CategoryService;
        return yield* service.delete('123');
      });

      await Effect.runPromise(
        program.pipe(
          Effect.provide(CategoryServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(true).toBe(true);
    });

    it('should fail delete if category not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'find_category_by_id') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const CategoryServiceLayer = Layer.effect(CategoryService, makeCategoryService);

      const program = Effect.gen(function* () {
        const service = yield* CategoryService;
        return yield* service.delete('non-existent');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(
          Effect.provide(CategoryServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result._tag).toBe('Failure');
    });

    it('should fail delete if category is in use', async () => {
      const category = mockCategory();
      const queryStub = mock((op: string) => {
        if (op === 'find_category_by_id') return Effect.succeed(category);
        if (op === 'check_category_usage') return Effect.succeed({ count: '3' });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const CategoryServiceLayer = Layer.effect(CategoryService, makeCategoryService);

      const program = Effect.gen(function* () {
        const service = yield* CategoryService;
        return yield* service.delete('123');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(
          Effect.provide(CategoryServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result._tag).toBe('Failure');
    });
  });
});
