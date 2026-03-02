import { createId } from '@paralleldrive/cuid2';
import { Context, Effect, Layer } from 'effect';

import { DatabaseError, NotFound, StorageError, ValidationError } from '../errors';
import type { Media, MediaStatus, MediaUpdate, PaginatedResponse } from '../types';
import { DbService } from './db.service';
import { ImageService } from './image.service';
import { MediaProcessorQueue } from './media-processor';
import { StorageService } from './storage.service';

// =============================================================================
// CONSTANTS
// =============================================================================

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// =============================================================================
// HELPERS
// =============================================================================

/** Sanitize filename to prevent path traversal and hidden files */
const sanitizeFilename = (filename: string): string => {
  // Remove path separators and traversal sequences
  const safe = filename.replace(/[/\\]/g, '-').replace(/^\.+/, '');
  // Limit length and provide fallback
  return safe.slice(0, 255) || 'unnamed';
};

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
    readonly confirmUpload: (mediaId: string) => Effect.Effect<Media, DatabaseError | NotFound | ValidationError>;
    readonly update: (
      id: string,
      data: MediaUpdate
    ) => Effect.Effect<Media, DatabaseError | NotFound>;
    readonly delete: (id: string) => Effect.Effect<void, DatabaseError | NotFound | StorageError>;
    readonly findById: (id: string) => Effect.Effect<Media, DatabaseError | NotFound>;
    readonly findByIds: (ids: string[]) => Effect.Effect<Media[], DatabaseError>;
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

  const findByIds = (ids: string[]) =>
    ids.length === 0
      ? Effect.succeed([])
      : query('find_media_by_ids', (db) =>
          db.selectFrom('media').selectAll().where('id', 'in', ids).execute()
        );

  const initUpload = (params: {
    filename: string;
    contentType: string;
    size: number;
    alt?: string;
  }) =>
    Effect.gen(function* () {
      // Validate MIME type against allowlist
      if (!ALLOWED_MIME_TYPES.includes(params.contentType.toLowerCase())) {
        return yield* Effect.fail(
          new ValidationError({
            errors: [{ path: 'contentType', message: `Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` }],
          })
        );
      }

      // Validate file size
      if (params.size > MAX_FILE_SIZE) {
        return yield* Effect.fail(
          new ValidationError({
            errors: [{ path: 'size', message: 'Maximum file size is 50MB' }],
          })
        );
      }

      const id = createId();
      const uploadKey = `uploads/${id}/${sanitizeFilename(params.filename)}`;

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
      // Atomically transition from 'uploading' to 'processing' in a single UPDATE.
      // This prevents a race condition where two concurrent confirmUpload calls
      // both pass a status check and both enqueue processing jobs.
      const updated = yield* query('confirm_upload_atomic', (db) =>
        db
          .updateTable('media')
          .set({ status: 'processing' as MediaStatus })
          .where('id', '=', mediaId)
          .where('status', '=', 'uploading' as MediaStatus)
          .returningAll()
          .executeTakeFirst()
      );

      if (!updated) {
        // Either media doesn't exist or it's not in 'uploading' state
        const media = yield* findById(mediaId); // will throw NotFound if missing
        return yield* Effect.fail(
          new ValidationError({
            errors: [{ path: 'status', message: `Media is in '${media.status}' state, expected 'uploading'` }],
          })
        );
      }

      if (!updated.upload_key) {
        return yield* Effect.fail(
          new NotFound({ resource: 'Media upload_key', id: mediaId })
        );
      }

      // Enqueue background image processing
      yield* processorQueue.enqueue({
        mediaId,
        uploadKey: updated.upload_key,
        filename: updated.filename,
        mimeType: updated.mime_type,
      });

      return updated;
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
      yield* imageService.deleteVariants(id).pipe(
        Effect.catchAll((error) => Effect.logWarning(`Failed to delete image variants for media ${id}: ${error}`))
      );

      // Delete original upload
      if (media.upload_key) {
        yield* storage.delete(media.upload_key).pipe(
          Effect.catchAll((error) => Effect.logWarning(`Failed to delete upload for media ${id}: ${error}`))
        );
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
    findByIds,
    findAll,
  };
});

export const MediaServiceLive = Layer.effect(MediaService, makeMediaService);
