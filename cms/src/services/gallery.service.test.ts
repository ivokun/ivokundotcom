import { describe, expect, it, mock } from 'bun:test';
import { Effect, Layer } from 'effect';

import type { Gallery } from '../types';
import { DbService } from './db.service';
import { GalleryService, makeGalleryService } from './gallery.service';

const mockDbService = (queryFn: (op: string, fn: any) => Effect.Effect<any, any>) =>
  Layer.succeed(
    DbService,
    DbService.of({
      db: {} as any,
      query: queryFn,
      transaction: (fn) => fn({} as any) as any,
    })
  );

const mockGallery = (overrides: Partial<Gallery> = {}): Gallery => ({
  id: '123',
  title: 'Test Gallery',
  slug: 'test-gallery',
  description: null,
  images: [],
  category_id: null,
  status: 'draft',
  published_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('GalleryService', () => {
  it('should create a gallery', async () => {
    const gallery = mockGallery();
    const queryStub = mock((op: string) => {
      if (op === 'check_gallery_slug') return Effect.succeed(undefined);
      if (op === 'create_gallery') return Effect.succeed(gallery);
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

    const program = Effect.gen(function* () {
      const service = yield* GalleryService;
      return yield* service.create({ title: 'Test Gallery', status: 'draft', images: [] });
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer))
    );

    expect(result).toEqual(gallery);
    expect(queryStub).toHaveBeenCalledTimes(2);
  });

  it('should find gallery by id with category', async () => {
    const gallery = mockGallery();
    const resultFromDb = {
      ...gallery,
      cat_id: 'cat1',
      cat_name: 'Category 1',
      cat_slug: 'cat-1',
      cat_desc: null,
      cat_created_at: new Date(),
      cat_updated_at: new Date(),
    };

    const queryStub = mock((op: string) => {
      if (op === 'find_gallery_by_id') return Effect.succeed(resultFromDb);
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

    const program = Effect.gen(function* () {
      const service = yield* GalleryService;
      return yield* service.findById('123');
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer))
    );

    expect(result.id).toBe('123');
    expect(result.category?.id).toBe('cat1');
  });
});
