import { createId } from '@paralleldrive/cuid2';
import { Context, Duration, Effect, Layer, Schedule } from 'effect';

import { DatabaseError, NotFound, StorageError, ValidationError } from '../errors';
import type { Media, MediaStatus, MediaUpdate, PaginatedResponse } from '../types';
import { DbService } from './db.service';
import { ImageService } from './image.service';
import { MediaProcessorQueue } from './media-processor';
import { StorageService } from './storage.service';

// =============================================================================
// CONSTANTS
// =============================================================================

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'application/pdf',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// =============================================================================
// MAGIC BYTES VALIDATION - SEC-006
// =============================================================================

/**
 * Validates file magic bytes against declared MIME type.
 * Returns true if the bytes match the expected type, false otherwise.
 */
export const validateMagicBytes = (mimeType: string, bytes: Uint8Array): boolean => {
  if (bytes.length === 0) return false;

  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
      // First 3 bytes: FF D8 FF
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

    case 'image/png':
      // First 8 bytes: 89 50 4E 47 0D 0A 1A 0A
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );

    case 'image/gif':
      // First 6 bytes: GIF87a or GIF89a
      if (bytes.length < 6) return false;
      // "GIF" header
      if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) return false;
      // "87" or "89"
      if (bytes[3] !== 0x38) return false;
      if (bytes[4] !== 0x37 && bytes[4] !== 0x39) return false;
      // "a"
      return bytes[5] === 0x61;

    case 'image/webp': {
      // RIFF....WEBP format
      // Bytes 0-3: "RIFF" (52 49 46 46)
      // Bytes 8-11: "WEBP" (57 45 42 50)
      if (bytes.length < 12) return false;
      const isRiff =
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
      const isWebp =
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
      return isRiff && isWebp;
    }

    case 'image/svg+xml': {
      // Text-based format - check for SVG/XML signature in first 256 bytes
      if (bytes.length === 0) return false;
      // Decode as UTF-8 text
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const text = decoder.decode(bytes.slice(0, Math.min(bytes.length, 256)));
      const trimmed = text.trim().toLowerCase();
      // Check for XML declaration or SVG tag
      return trimmed.includes('<svg') || trimmed.includes('<?xml');
    }

    case 'video/mp4':
      // MP4 uses ftyp box: bytes 4-7 = "ftyp" (66 74 79 70)
      if (bytes.length < 8) return false;
      // Skip first 4 bytes (box size), check for "ftyp"
      return (
        bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
      );

    case 'video/webm':
      // First 4 bytes: 1A 45 DF A3 (EBML header for Matroska/WebM)
      return (
        bytes.length >= 4 &&
        bytes[0] === 0x1a &&
        bytes[1] === 0x45 &&
        bytes[2] === 0xdf &&
        bytes[3] === 0xa3
      );

    case 'application/pdf':
      // First 4 bytes: %PDF (25 50 44 46)
      return (
        bytes.length >= 4 &&
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46
      );

    default:
      // Unknown MIME type - reject for security
      return false;
  }
};

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
    /** Clean up orphaned uploads (status='uploading' older than 1 hour) */
    readonly cleanupOrphanedUploads: () => Effect.Effect<number, DatabaseError | StorageError>;
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

  const cleanupOrphanedUploads = (): Effect.Effect<number, DatabaseError | StorageError> =>
    Effect.gen(function* () {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Query for orphaned uploads (status='uploading' and older than 1 hour)
      const orphaned = yield* query('find_orphaned_uploads', (db) =>
        db
          .selectFrom('media')
          .select(['id', 'upload_key'])
          .where('status', '=', 'uploading')
          .where('created_at', '<', oneHourAgo)
          .execute()
      );

      if (orphaned.length === 0) {
        return 0;
      }

      // Delete each orphaned upload from storage and DB
      yield* Effect.forEach(
        orphaned,
        (media) =>
          Effect.gen(function* () {
            // Delete from R2 storage if upload_key exists
            if (media.upload_key) {
              yield* storage.delete(media.upload_key).pipe(
                Effect.catchAll((error) =>
                  Effect.logWarning(
                    `Failed to delete orphaned upload ${media.id} from storage: ${error}`
                  )
                )
              );
            }

            // Delete from DB
            yield* query('delete_orphaned_media', (db) =>
              db.deleteFrom('media').where('id', '=', media.id).execute()
            );
          }),
        { concurrency: 5 }
      );

      yield* Effect.log(`Cleaned up ${orphaned.length} orphaned uploads`);

      return orphaned.length;
    });

  return {
    initUpload,
    confirmUpload,
    update,
    delete: delete_,
    findById,
    findByIds,
    findAll,
    cleanupOrphanedUploads,
  };
});

export const MediaServiceLive = Layer.effect(MediaService, makeMediaService);
