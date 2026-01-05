import { createId } from '@paralleldrive/cuid2';
import { Context, Effect, Layer } from 'effect';

import { DatabaseError, NotFound } from '../errors';
import type { Media, MediaUpdate, PaginatedResponse } from '../types';

import { DbService } from './db.service';
import { ImageService } from './image.service';

export interface FileUpload {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

export class MediaService extends Context.Tag('MediaService')<
  MediaService,
  {
    readonly create: (
      file: FileUpload,
      alt?: string
    ) => Effect.Effect<Media, DatabaseError | unknown>;
    readonly update: (
      id: string,
      data: MediaUpdate
    ) => Effect.Effect<Media, DatabaseError | NotFound>;
    readonly delete: (id: string) => Effect.Effect<void, DatabaseError | NotFound | unknown>;
    readonly findById: (id: string) => Effect.Effect<Media, DatabaseError | NotFound>;
    readonly findAll: (options?: {
      limit?: number;
      offset?: number;
    }) => Effect.Effect<PaginatedResponse<Media>, DatabaseError>;
  }
>() {}

export const makeMediaService = Effect.gen(function* () {
  const { query } = yield* DbService;
  const imageService = yield* ImageService;

  const findById = (id: string) =>
    query('find_media_by_id', (db) =>
      db.selectFrom('media').selectAll().where('id', '=', id).executeTakeFirst()
    ).pipe(
      Effect.flatMap((media) =>
        media ? Effect.succeed(media) : Effect.fail(new NotFound({ resource: 'Media', id }))
      )
    );

  const create = (file: FileUpload, alt?: string) =>
    Effect.gen(function* () {
      const id = createId();

      // Process image if it's an image
      if (!file.mimetype.startsWith('image/')) {
        // For now, only images are supported by ImageService
        return yield* Effect.die('Only image uploads are currently supported');
      }

      const processed = yield* imageService.process(id, file.buffer, file.filename);

      const newMedia = {
        id,
        filename: file.filename,
        mime_type: 'image/webp', // We convert to WebP
        size: processed.size,
        alt: alt ?? null,
        urls: processed.urls,
        width: processed.width,
        height: processed.height,
      };

      return yield* query('create_media', (db) =>
        db.insertInto('media').values(newMedia).returningAll().executeTakeFirstOrThrow()
      );
    });

  const update = (id: string, data: MediaUpdate) =>
    Effect.gen(function* () {
      yield* findById(id);

      const updateData: MediaUpdate = {
        ...data,
      };

      return yield* query('update_media', (db) =>
        db
          .updateTable('media')
          .set(updateData)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow()
      );
    });

  const delete_ = (id: string) =>
    Effect.gen(function* () {
      const media = yield* findById(id);

      // Delete from storage
      yield* imageService.deleteVariants(id);

      // Delete from DB
      const result = yield* query('delete_media', (db) =>
        db.deleteFrom('media').where('id', '=', id).executeTakeFirst()
      );

      if (Number(result.numDeletedRows) === 0) {
        return yield* Effect.fail(new NotFound({ resource: 'Media', id }));
      }
    });

  const findAll = (options?: { limit?: number; offset?: number }) =>
    Effect.gen(function* () {
      const limit = options?.limit ?? 10;
      const offset = options?.offset ?? 0;

      const [data, countResult] = yield* Effect.all([
        query('find_all_media', (db) =>
          db
            .selectFrom('media')
            .selectAll()
            .orderBy('created_at', 'desc')
            .limit(limit)
            .offset(offset)
            .execute()
        ),
        query('count_media', (db) =>
          db
            .selectFrom('media')
            .select((eb) => eb.fn.count<string>('id').as('count'))
            .executeTakeFirstOrThrow()
        ),
      ]);

      return {
        data,
        meta: {
          total: Number(countResult.count),
          limit,
          offset,
        },
      };
    });

  return {
    create,
    update,
    delete: delete_,
    findById,
    findAll,
  };
});

export const MediaServiceLive = Layer.effect(MediaService, makeMediaService);
