import { describe, expect, it, mock } from 'bun:test';
import { Effect, Layer } from 'effect';

import type { GalleryWithCategory } from '../types';
import { DbService } from './db.service';
import { GalleryService, makeGalleryService } from './gallery.service';
import { MediaService } from './media.service';

const mockDbService = (queryFn: (op: string, fn: any) => Effect.Effect<any, any>) =>
  Layer.succeed(
    DbService,
    DbService.of({
      db: {} as any,
      query: queryFn,
      transaction: (fn) => fn({} as any) as any,
    })
  );

const mockMediaService = () =>
  Layer.succeed(
    MediaService,
    MediaService.of({
      initUpload: () => Effect.die('not implemented') as any,
      confirmUpload: () => Effect.die('not implemented') as any,
      update: () => Effect.die('not implemented') as any,
      delete: () => Effect.die('not implemented') as any,
      findById: () => Effect.die('not implemented') as any,
      findByIds: () => Effect.succeed([]),
      findAll: () => Effect.die('not implemented') as any,
      cleanupOrphanedUploads: () => Effect.succeed(0),
    })
  );

const mockGallery = (overrides: Partial<GalleryWithCategory> = {}): GalleryWithCategory => ({
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
  category: null,
  ...overrides,
});

describe('GalleryService', () => {
  it('should create a gallery', async () => {
    const gallery = mockGallery();
    // Mock raw DB result (string[] images)
    const dbResult = {
      id: '123',
      title: 'Test Gallery',
      slug: 'test-gallery',
      description: null,
      images: [] as string[],
      category_id: null,
      status: 'draft' as const,
      published_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const queryStub = mock((op: string) => {
      if (op === 'check_gallery_slug') return Effect.succeed(undefined);
      if (op === 'create_gallery') return Effect.succeed(dbResult);
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

    const program = Effect.gen(function* () {
      const service = yield* GalleryService;
      return yield* service.create({ title: 'Test Gallery', status: 'draft', images: [] });
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
    );

    expect(result.id).toBe(gallery.id);
    expect(result.title).toBe(gallery.title);
    expect(result.category).toBeNull();
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
      program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
    );

    expect(result.id).toBe('123');
    expect(result.category?.id).toBe('cat1');
  });
});
