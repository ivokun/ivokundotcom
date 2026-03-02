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
  describe('create', () => {
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

    it('should fail create when media not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'check_gallery_slug') return Effect.succeed(undefined);
        if (op === 'check_media_exists') return Effect.succeed([]);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.create({
          title: 'Test Gallery',
          status: 'draft',
          images: ['non-existent-media'],
        });
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      expect(result._tag).toBe('Failure');
    });

    it('should fail create on slug conflict', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'check_gallery_slug') return Effect.succeed({ id: 'existing' });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.create({ title: 'Test Gallery', status: 'draft', images: [] });
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('findById', () => {
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

    it('should fail findById if not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'find_gallery_by_id') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.findById('non-existent');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('findBySlug', () => {
    it('should find gallery by slug', async () => {
      const gallery = mockGallery();
      const resultFromDb = {
        ...gallery,
        cat_id: null,
      };

      const queryStub = mock((op: string) => {
        if (op === 'find_gallery_by_slug') return Effect.succeed(resultFromDb);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.findBySlug('test-gallery');
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      expect(result.id).toBe('123');
      expect(result.slug).toBe('test-gallery');
    });

    it('should fail findBySlug if not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'find_gallery_by_slug') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.findBySlug('non-existent');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('findAll', () => {
    it('should find all galleries with pagination', async () => {
      const gallery = mockGallery();
      const resultFromDb = {
        ...gallery,
        cat_id: null,
      };

      const queryStub = mock((op: string) => {
        if (op === 'find_all_galleries') return Effect.succeed([resultFromDb]);
        if (op === 'count_galleries') return Effect.succeed({ count: '1' });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.findAll({ limit: 10, offset: 0 });
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.offset).toBe(0);
    });

    it('should find all galleries with status filter', async () => {
      const gallery = mockGallery({ status: 'published' });
      const resultFromDb = {
        ...gallery,
        cat_id: null,
      };

      const queryStub = mock((op: string) => {
        if (op === 'find_all_galleries') return Effect.succeed([resultFromDb]);
        if (op === 'count_galleries') return Effect.succeed({ count: '1' });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.findAll({ filter: { status: 'published' } });
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      const first = result.data[0];
      expect(first?.status).toBe('published');
    });

    it('should find all galleries with category filter', async () => {
      const gallery = mockGallery({ category_id: 'cat-123' });
      const resultFromDb = {
        ...gallery,
        cat_id: 'cat-123',
        cat_name: 'Test Category',
        cat_slug: 'test-cat',
        cat_desc: null,
        cat_created_at: new Date(),
        cat_updated_at: new Date(),
      };

      const queryStub = mock((op: string) => {
        if (op === 'find_all_galleries') return Effect.succeed([resultFromDb]);
        if (op === 'count_galleries') return Effect.succeed({ count: '1' });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.findAll({ filter: { categoryId: 'cat-123' } });
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      const first = result.data[0];
      expect(first?.category_id).toBe('cat-123');
      expect(first?.category?.id).toBe('cat-123');
    });
  });

  describe('update', () => {
    it('should update a gallery', async () => {
      const currentGallery = {
        id: '123',
        title: 'Old Title',
        slug: 'old-title',
        description: null,
        images: [] as string[],
        category_id: null,
        status: 'draft' as const,
        published_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const updatedGallery = {
        id: '123',
        title: 'New Title',
        slug: 'new-title',
        description: null,
        images: [] as string[],
        category_id: null,
        status: 'draft' as const,
        published_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const queryStub = mock((op: string) => {
        if (op === 'get_gallery_for_update') return Effect.succeed(currentGallery);
        if (op === 'check_gallery_slug_update') return Effect.succeed(undefined);
        if (op === 'update_gallery') return Effect.succeed(updatedGallery);
        if (op === 'get_category_for_gallery') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.update('123', { title: 'New Title' });
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      expect(result.title).toBe('New Title');
      expect(result.slug).toBe('new-title');
    });

    it('should update gallery with images', async () => {
      const currentGallery = {
        id: '123',
        title: 'Test Gallery',
        slug: 'test-gallery',
        description: null,
        images: ['media-1'] as string[],
        category_id: null,
        status: 'draft' as const,
        published_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const updatedGallery = {
        id: '123',
        title: 'Test Gallery',
        slug: 'test-gallery',
        description: null,
        images: ['media-1', 'media-2'] as string[],
        category_id: null,
        status: 'draft' as const,
        published_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const queryStub = mock((op: string) => {
        if (op === 'get_gallery_for_update') return Effect.succeed(currentGallery);
        if (op === 'check_media_exists_update')
          return Effect.succeed([{ id: 'media-1', status: 'ready' }, { id: 'media-2', status: 'ready' }]);
        if (op === 'update_gallery') return Effect.succeed(updatedGallery);
        if (op === 'get_category_for_gallery') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.update('123', { images: ['media-1', 'media-2'] });
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      expect(result.images).toHaveLength(2);
      expect(result.images[0]?.mediaId).toBe('media-1');
      expect(result.images[1]?.mediaId).toBe('media-2');
    });

    it('should fail update if gallery not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'get_gallery_for_update') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.update('non-existent', { title: 'New Title' });
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      expect(result._tag).toBe('Failure');
    });

    it('should fail update on slug conflict', async () => {
      const currentGallery = {
        id: '123',
        title: 'Old Title',
        slug: 'old-title',
        description: null,
        images: [] as string[],
        category_id: null,
        status: 'draft' as const,
        published_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const queryStub = mock((op: string) => {
        if (op === 'get_gallery_for_update') return Effect.succeed(currentGallery);
        if (op === 'check_gallery_slug_update') return Effect.succeed({ id: 'other-gallery' });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.update('123', { title: 'Conflicting Title', slug: 'existing-slug' });
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      expect(result._tag).toBe('Failure');
    });

    it('should fail update when media not found', async () => {
      const currentGallery = {
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
        if (op === 'get_gallery_for_update') return Effect.succeed(currentGallery);
        if (op === 'check_media_exists_update') return Effect.succeed([]);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.update('123', { images: ['non-existent-media'] });
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('delete', () => {
    it('should delete a gallery', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'delete_gallery') return Effect.succeed({ numDeletedRows: 1n });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.delete('123');
      });

      await Effect.runPromise(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      expect(true).toBe(true);
    });

    it('should fail delete if gallery not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'delete_gallery') return Effect.succeed({ numDeletedRows: 0n });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const GalleryServiceLayer = Layer.effect(GalleryService, makeGalleryService);

      const program = Effect.gen(function* () {
        const service = yield* GalleryService;
        return yield* service.delete('non-existent');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(GalleryServiceLayer), Effect.provide(layer), Effect.provide(mockMediaService()))
      );

      expect(result._tag).toBe('Failure');
    });
  });
});
