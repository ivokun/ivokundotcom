import { describe, expect, it, mock } from 'bun:test';
import { Effect, Layer } from 'effect';

import type { Media } from '../types';
import { DbService } from './db.service';
import { ImageService } from './image.service';
import { makeMediaService,MediaService } from './media.service';
import { MediaProcessorQueue } from './media-processor';
import { StorageService } from './storage.service';

const mockDbService = (queryFn: (op: string, fn: any) => Effect.Effect<any, any>) =>
  Layer.succeed(
    DbService,
    DbService.of({
      db: {} as any,
      query: queryFn,
      transaction: (fn) => fn({} as any) as any,
    })
  );

const mockImageService = (
  deleteFn: (id: string) => Effect.Effect<void, any> = () => Effect.void
) =>
  Layer.succeed(
    ImageService,
    ImageService.of({
      process: () => Effect.die('Unused in presigned flow'),
      deleteVariants: deleteFn,
    })
  );

const mockStorageService = () =>
  Layer.succeed(
    StorageService,
    StorageService.of({
      upload: () => Effect.succeed('https://r2.example.com/test'),
      delete: () => Effect.void,
      getObject: () => Effect.succeed(Buffer.from('test')),
      getPresignedUploadUrl: () => Effect.succeed('https://r2.example.com/presigned?token=abc'),
      getPublicUrl: (key) => `https://r2.example.com/${key}`,
    })
  );

const mockProcessorQueue = () =>
  Layer.succeed(
    MediaProcessorQueue,
    MediaProcessorQueue.of({
      enqueue: () => Effect.void,
    })
  );

const mockMedia = (overrides: Partial<Media> = {}): Media => ({
  id: '123',
  filename: 'test.jpg',
  mime_type: 'image/webp',
  size: 1024,
  alt: null,
  urls: {
    original: 'url/orig',
    thumbnail: 'url/thumb',
    small: 'url/small',
    large: 'url/large',
  },
  width: 100,
  height: 100,
  status: 'ready',
  upload_key: null,
  created_at: new Date(),
  ...overrides,
});

const allMockLayers = (queryFn: (op: string, fn: any) => Effect.Effect<any, any>) => {
  const MediaServiceLayer = Layer.effect(MediaService, makeMediaService);
  return Layer.mergeAll(
    mockDbService(queryFn),
    mockImageService(),
    mockStorageService(),
    mockProcessorQueue()
  ).pipe((deps) => Layer.provide(MediaServiceLayer, deps));
};

describe('MediaService', () => {
  describe('initUpload', () => {
    it('should init upload and return presigned URL', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'create_media') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const program = Effect.gen(function* () {
        const service = yield* MediaService;
        return yield* service.initUpload({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
          size: 1024,
        });
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(allMockLayers(queryStub)))
      );

      expect(result.uploadUrl).toContain('presigned');
      expect(result.mediaId).toBeDefined();
      expect(result.uploadKey).toContain('uploads/');
    });

    it('should reject non-image content types', async () => {
      const queryStub = mock(() => Effect.die('Unused'));

      const program = Effect.gen(function* () {
        const service = yield* MediaService;
        return yield* service.initUpload({
          filename: 'test.txt',
          contentType: 'text/plain',
          size: 1024,
        });
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(allMockLayers(queryStub)))
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('confirmUpload', () => {
    it('should confirm upload and enqueue processing', async () => {
      const media = mockMedia({ status: 'uploading', upload_key: 'uploads/123/test.jpg' });
      const queryStub = mock((op: string) => {
        if (op === 'confirm_upload_atomic') return Effect.succeed(media);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const program = Effect.gen(function* () {
        const service = yield* MediaService;
        return yield* service.confirmUpload('123');
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(allMockLayers(queryStub)))
      );

      expect(result.id).toBe('123');
    });

    it('should fail if media already confirmed', async () => {
      const media = mockMedia({ status: 'ready' });
      const queryStub = mock((op: string) => {
        if (op === 'confirm_upload_atomic') return Effect.succeed(undefined);
        if (op === 'find_media_by_id') return Effect.succeed(media);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const program = Effect.gen(function* () {
        const service = yield* MediaService;
        return yield* service.confirmUpload('123');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(allMockLayers(queryStub)))
      );

      expect(result._tag).toBe('Failure');
    });

    it('should fail confirm if media not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'confirm_upload_atomic') return Effect.succeed(undefined);
        if (op === 'find_media_by_id') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const program = Effect.gen(function* () {
        const service = yield* MediaService;
        return yield* service.confirmUpload('non-existent');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(allMockLayers(queryStub)))
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('delete', () => {
    it('should delete media', async () => {
      const media = mockMedia();
      const queryStub = mock((op: string) => {
        if (op === 'find_media_by_id') return Effect.succeed(media);
        if (op === 'delete_media') return Effect.succeed({ numDeletedRows: 1n });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const program = Effect.gen(function* () {
        const service = yield* MediaService;
        return yield* service.delete('123');
      });

      await Effect.runPromise(
        program.pipe(Effect.provide(allMockLayers(queryStub)))
      );

      // If it didn't throw, delete succeeded
      expect(true).toBe(true);
    });

    it('should fail delete if media not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'find_media_by_id') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const program = Effect.gen(function* () {
        const service = yield* MediaService;
        return yield* service.delete('non-existent');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(allMockLayers(queryStub)))
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('findAll', () => {
    it('should find all media with pagination', async () => {
      const media = mockMedia();
      const queryStub = mock((op: string) => {
        if (op === 'find_all_media') return Effect.succeed([media]);
        if (op === 'count_media') return Effect.succeed({ count: '1' });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const program = Effect.gen(function* () {
        const service = yield* MediaService;
        return yield* service.findAll({ limit: 10, offset: 0 });
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(allMockLayers(queryStub)))
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.offset).toBe(0);
    });

    it('should respect custom pagination params', async () => {
      const media = mockMedia();
      const queryStub = mock((op: string) => {
        if (op === 'find_all_media') return Effect.succeed([media]);
        if (op === 'count_media') return Effect.succeed({ count: '5' });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const program = Effect.gen(function* () {
        const service = yield* MediaService;
        return yield* service.findAll({ limit: 5, offset: 10 });
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(allMockLayers(queryStub)))
      );

      expect(result.meta.limit).toBe(5);
      expect(result.meta.offset).toBe(10);
    });
  });

  describe('findByIds', () => {
    it('should return empty array for empty ids', async () => {
      const queryStub = mock(() => Effect.die('Should not be called'));

      const program = Effect.gen(function* () {
        const service = yield* MediaService;
        return yield* service.findByIds([]);
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(allMockLayers(queryStub)))
      );

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update media', async () => {
      const media = mockMedia();
      const updatedMedia = { ...media, alt: 'Updated alt text' };
      const queryStub = mock((op: string) => {
        if (op === 'find_media_by_id') return Effect.succeed(media);
        if (op === 'update_media') return Effect.succeed(updatedMedia);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const program = Effect.gen(function* () {
        const service = yield* MediaService;
        return yield* service.update('123', { alt: 'Updated alt text' });
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(allMockLayers(queryStub)))
      );

      expect(result.alt).toBe('Updated alt text');
    });

    it('should fail update if media not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'find_media_by_id') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const program = Effect.gen(function* () {
        const service = yield* MediaService;
        return yield* service.update('non-existent', { alt: 'Updated' });
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(allMockLayers(queryStub)))
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('cleanupOrphanedUploads', () => {
    it('should clean up orphaned uploads', async () => {
      const orphanedMedia = [
        { id: 'orphan-1', upload_key: 'uploads/orphan-1/file.jpg' },
        { id: 'orphan-2', upload_key: 'uploads/orphan-2/file.jpg' },
      ];
      const queryStub = mock((op: string) => {
        if (op === 'find_orphaned_uploads') return Effect.succeed(orphanedMedia);
        if (op === 'delete_orphaned_media') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const program = Effect.gen(function* () {
        const service = yield* MediaService;
        return yield* service.cleanupOrphanedUploads();
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(allMockLayers(queryStub)))
      );

      expect(result).toBe(2);
    });

    it('should return 0 when no orphaned uploads', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'find_orphaned_uploads') return Effect.succeed([]);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const program = Effect.gen(function* () {
        const service = yield* MediaService;
        return yield* service.cleanupOrphanedUploads();
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(allMockLayers(queryStub)))
      );

      expect(result).toBe(0);
    });
  });
});
