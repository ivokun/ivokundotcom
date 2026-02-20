import { createId } from '@paralleldrive/cuid2';
import { Context, Effect, Layer } from 'effect';

import { DatabaseError, NotFound, StorageError, ValidationError } from '../errors';
import type { Media, MediaStatus, MediaUpdate, PaginatedResponse } from '../types';

import { DbService } from './db.service';
import { ImageService } from './image.service';
import { MediaProcessorQueue } from './media-processor';
import { StorageService } from './storage.service';

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface PresignedUploadResult {
  mediaId: string;
  uploadUrl: string;
  uploadKey: string;
}

export class MediaService extends Context.Tag('MediaService')<
  MediaService,
  {
    /** Generate a presigned URL for direct browser-to-bucket upload */
    readonly initUpload: (params: {
      filename: string;
      contentType: string;
      size: number;
      alt?: string;
    }) => Effect.Effect<PresignedUploadResult, DatabaseError | StorageError | ValidationError>;
    /** Called after the browser finishes uploading — enqueues image processing */
    readonly confirmUpload: (mediaId: string) => Effect.Effect<Media, DatabaseError | NotFound>;
    readonly update: (
      id: string,
      data: MediaUpdate
    ) => Effect.Effect<Media, DatabaseError | NotFound>;
    readonly delete: (id: string) => Effect.Effect<void, DatabaseError | NotFound | StorageError>;
    readonly findById: (id: string) => Effect.Effect<Media, DatabaseError | NotFound>;
    readonly findAll: (options?: {
      limit?: number;
      offset?: number;
    }) => Effect.Effect<PaginatedResponse<Media>, DatabaseError>;
  }
>() {}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export const makeMediaService = Effect.gen(function* () {
  const { query } = yield* DbService;
  const storage = yield* StorageService;
  const imageService = yield* ImageService;
  const processorQueue = yield* MediaProcessorQueue;

  const findById = (id: string) =>
    query('find_media_by_id', (db) =>
      db.selectFrom('media').selectAll().where('id', '=', id).executeTakeFirst()
    ).pipe(
      Effect.flatMap((media) =>
        media ? Effect.succeed(media) : Effect.fail(new NotFound({ resource: 'Media', id }))
      )
    );

  const initUpload = (params: {
    filename: string;
    contentType: string;
    size: number;
    alt?: string;
  }) =>
    Effect.gen(function* () {
      if (!params.contentType.startsWith('image/')) {
        return yield* Effect.fail(
          new ValidationError({
            errors: [{ path: 'contentType', message: 'Only image uploads are supported' }],
          })
        );
      }

      const id = createId();
      const uploadKey = `uploads/${id}/${params.filename}`;

      // Generate presigned PUT URL
      const uploadUrl = yield* storage.getPresignedUploadUrl(uploadKey, params.contentType);

      // Create media record in DB with 'uploading' status
      yield* query('create_media', (db) =>
        db
          .insertInto('media')
          .values({
            id,
            filename: params.filename,
            mime_type: params.contentType,
            size: params.size,
            alt: params.alt ?? null,
            urls: null,
            width: null,
            height: null,
            status: 'uploading' as MediaStatus,
            upload_key: uploadKey,
          })
          .execute()
      );

      return { mediaId: id, uploadUrl, uploadKey } satisfies PresignedUploadResult;
    });

  const confirmUpload = (mediaId: string) =>
    Effect.gen(function* () {
      const media = yield* findById(mediaId);

      if (media.status !== 'uploading') {
        return yield* Effect.fail(
          new NotFound({ resource: 'Media', id: mediaId })
        );
      }

      if (!media.upload_key) {
        return yield* Effect.fail(
          new NotFound({ resource: 'Media upload_key', id: mediaId })
        );
      }

      // Mark as processing
      yield* query('update_media_status', (db) =>
        db
          .updateTable('media')
          .set({ status: 'processing' as MediaStatus })
          .where('id', '=', mediaId)
          .execute()
      );

      // Enqueue background image processing
      yield* processorQueue.enqueue({
        mediaId,
        uploadKey: media.upload_key,
        filename: media.filename,
        mimeType: media.mime_type,
      });

      // Return the current media record (status = processing)
      return yield* findById(mediaId);
    });

  const update = (id: string, data: MediaUpdate) =>
    Effect.gen(function* () {
      yield* findById(id);
      return yield* query('update_media', (db) =>
        db
          .updateTable('media')
          .set(data)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow()
      );
    });

  const delete_ = (id: string) =>
    Effect.gen(function* () {
      const media = yield* findById(id);

      // Delete processed variants
      yield* imageService.deleteVariants(id).pipe(Effect.catchAll(() => Effect.void));

      // Delete original upload
      if (media.upload_key) {
        yield* storage.delete(media.upload_key).pipe(Effect.catchAll(() => Effect.void));
      }

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
      const limit = options?.limit ?? 50;
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
    initUpload,
    confirmUpload,
    update,
    delete: delete_,
    findById,
    findAll,
  };
});

export const MediaServiceLive = Layer.effect(MediaService, makeMediaService);
