import { describe, expect, it, mock } from 'bun:test';
import { Effect, Layer } from 'effect';

import { ImageProcessingError } from '../errors';
import type { Media, MediaUrls } from '../types';

import { DbService } from './db.service';
import { ImageService } from './image.service';
import { MediaService, makeMediaService } from './media.service';

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
  processFn: (id: string, buf: Buffer, name: string) => Effect.Effect<any, any> = () =>
    Effect.die('Unused'),
  deleteFn: (id: string) => Effect.Effect<void, any> = () => Effect.die('Unused')
) =>
  Layer.succeed(
    ImageService,
    ImageService.of({
      process: processFn,
      deleteVariants: deleteFn,
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
  created_at: new Date(),
  ...overrides,
});

describe('MediaService', () => {
  it('should create media', async () => {
    const media = mockMedia();
    const queryStub = mock((op: string) => {
      if (op === 'create_media') return Effect.succeed(media);
      return Effect.die(`Unexpected op: ${op}`);
    });

    const processStub = mock((id, buf, name) =>
      Effect.succeed({
        urls: media.urls,
        width: 100,
        height: 100,
        size: 1024,
      })
    );

    const dbLayer = mockDbService(queryStub);
    const imageLayer = mockImageService(processStub);
    const MediaServiceLayer = Layer.effect(MediaService, makeMediaService);

    const program = Effect.gen(function* () {
      const service = yield* MediaService;
      return yield* service.create({
        buffer: Buffer.from('test'),
        filename: 'test.jpg',
        mimetype: 'image/jpeg',
      });
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(MediaServiceLayer),
        Effect.provide(dbLayer),
        Effect.provide(imageLayer)
      )
    );

    expect(result).toEqual(media);
    expect(processStub).toHaveBeenCalled();
  });

  it('should fail create if not image', async () => {
    const dbLayer = mockDbService(() => Effect.die('Unused'));
    const imageLayer = mockImageService();
    const MediaServiceLayer = Layer.effect(MediaService, makeMediaService);

    const program = Effect.gen(function* () {
      const service = yield* MediaService;
      return yield* service.create({
        buffer: Buffer.from('test'),
        filename: 'test.txt',
        mimetype: 'text/plain',
      });
    });

    const result = await Effect.runPromiseExit(
      program.pipe(
        Effect.provide(MediaServiceLayer),
        Effect.provide(dbLayer),
        Effect.provide(imageLayer)
      )
    );

    expect(result._tag).toBe('Failure');
  });

  it('should delete media', async () => {
    const media = mockMedia();
    const queryStub = mock((op: string) => {
      if (op === 'find_media_by_id') return Effect.succeed(media);
      if (op === 'delete_media') return Effect.succeed({ numDeletedRows: 1n });
      return Effect.die(`Unexpected op: ${op}`);
    });

    const deleteStub = mock((id) => Effect.succeed(undefined));

    const dbLayer = mockDbService(queryStub);
    const imageLayer = mockImageService(undefined, deleteStub);
    const MediaServiceLayer = Layer.effect(MediaService, makeMediaService);

    const program = Effect.gen(function* () {
      const service = yield* MediaService;
      return yield* service.delete('123');
    });

    await Effect.runPromise(
      program.pipe(
        Effect.provide(MediaServiceLayer),
        Effect.provide(dbLayer),
        Effect.provide(imageLayer)
      )
    );

    expect(deleteStub).toHaveBeenCalled();
  });
});
