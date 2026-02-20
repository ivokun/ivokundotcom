/**
 * @fileoverview Media processing queue using Effect Queue
 * Downloads uploaded originals from R2, processes image variants, updates DB.
 */

import { Context, Effect, Layer, Queue } from 'effect';

import { DatabaseError, ImageProcessingError, StorageError } from '../errors';
import type { MediaUrls } from '../types';

import { DbService } from './db.service';
import { ImageService } from './image.service';
import { StorageService } from './storage.service';

// =============================================================================
// PROCESSING JOB TYPE
// =============================================================================

export interface MediaProcessingJob {
  readonly mediaId: string;
  readonly uploadKey: string;
  readonly filename: string;
  readonly mimeType: string;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export class MediaProcessorQueue extends Context.Tag('MediaProcessorQueue')<
  MediaProcessorQueue,
  {
    readonly enqueue: (job: MediaProcessingJob) => Effect.Effect<void>;
  }
>() {}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export const makeMediaProcessorQueue = Effect.gen(function* () {
  const { query } = yield* DbService;
  const imageService = yield* ImageService;
  const storage = yield* StorageService;

  const queue = yield* Queue.unbounded<MediaProcessingJob>();

  const updateStatus = (
    mediaId: string,
    status: 'processing' | 'ready' | 'failed',
    extra?: { urls?: MediaUrls; width?: number; height?: number; size?: number }
  ) =>
    query('update_media_status', (db) => {
      let q = db
        .updateTable('media')
        .set({ status, ...extra })
        .where('id', '=', mediaId);
      return q.execute();
    });

  const processJob = (job: MediaProcessingJob) =>
    Effect.gen(function* () {
      yield* updateStatus(job.mediaId, 'processing');

      // Download original from bucket
      const buffer = yield* storage.getObject(job.uploadKey);

      // Process image variants (creates webp variants and uploads them)
      const processed = yield* imageService.process(job.mediaId, buffer, job.filename);

      // Update media record with processed URLs and metadata
      yield* query('finalize_media', (db) =>
        db
          .updateTable('media')
          .set({
            status: 'ready' as const,
            urls: processed.urls,
            width: processed.width,
            height: processed.height,
            size: processed.size,
            mime_type: 'image/webp',
          })
          .where('id', '=', job.mediaId)
          .execute()
      );

      yield* Effect.logInfo(`Media processed: ${job.mediaId} (${job.filename})`);
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError(`Media processing failed for ${job.mediaId}: ${error}`);
          yield* updateStatus(job.mediaId, 'failed').pipe(Effect.catchAll(() => Effect.void));
        })
      )
    );

  // Worker fiber: continuously takes jobs from the queue and processes them
  const worker = Effect.gen(function* () {
    yield* Effect.logInfo('Media processor worker started');
    while (true) {
      const job = yield* Queue.take(queue);
      // Process each job without crashing the worker loop
      yield* processJob(job);
    }
  });

  // Fork the worker as a daemon fiber so it runs in the background
  yield* Effect.forkDaemon(worker);

  const enqueue = (job: MediaProcessingJob) =>
    Queue.offer(queue, job).pipe(Effect.asVoid);

  return { enqueue };
});

export const MediaProcessorQueueLive = Layer.effect(
  MediaProcessorQueue,
  makeMediaProcessorQueue
);
