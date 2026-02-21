/**
 * @fileoverview Image processing service using Sharp
 * @see PRD Section 3.2 - Image Processing Requirements
 */

import { Context, Effect, Layer } from 'effect';
import sharp from 'sharp';

import { ImageProcessingError } from '../errors';
import type { MediaUrls } from '../types';
import { StorageService } from './storage.service';

// =============================================================================
// IMAGE VARIANT CONFIGURATION - PRD Section 3.2
// =============================================================================

interface ImageVariant {
  name: keyof MediaUrls;
  width: number | null; // null = original size
  quality: number;
}

const IMAGE_VARIANTS: ImageVariant[] = [
  { name: 'original', width: null, quality: 90 },
  { name: 'thumbnail', width: 200, quality: 80 },
  { name: 'small', width: 800, quality: 85 },
  { name: 'large', width: 1920, quality: 85 },
];

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface ProcessedImage {
  urls: MediaUrls;
  width: number;
  height: number;
  size: number;
}

export class ImageService extends Context.Tag('ImageService')<
  ImageService,
  {
    readonly process: (
      id: string,
      buffer: Buffer,
      filename: string
    ) => Effect.Effect<ProcessedImage, ImageProcessingError>;
    readonly deleteVariants: (id: string) => Effect.Effect<void, ImageProcessingError>;
  }
>() {}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export const makeImageService = Effect.gen(function* () {
  const storage = yield* StorageService;

  const processVariant = (
    image: sharp.Sharp,
    variant: ImageVariant,
    id: string
  ): Effect.Effect<{ name: keyof MediaUrls; url: string; buffer: Buffer }, ImageProcessingError> =>
    Effect.gen(function* () {
      let pipeline = image.clone().webp({ quality: variant.quality });

      if (variant.width !== null) {
        pipeline = pipeline.resize(variant.width, null, {
          withoutEnlargement: true,
          fit: 'inside',
        });
      }

      const buffer = yield* Effect.tryPromise({
        try: () => pipeline.toBuffer(),
        catch: (error) =>
          new ImageProcessingError({
            cause: error,
          }),
      });

      const key = `media/${id}/${variant.name}.webp`;
      const url = yield* storage.upload(key, buffer, 'image/webp').pipe(
        Effect.mapError(
          (e) =>
            new ImageProcessingError({
              cause: e,
            })
        )
      );

      return { name: variant.name, url, buffer };
    });

  const process = (
    id: string,
    buffer: Buffer,
    _filename: string
  ): Effect.Effect<ProcessedImage, ImageProcessingError> =>
    Effect.gen(function* () {
      const image = sharp(buffer);

      // Get original metadata
      const metadata = yield* Effect.tryPromise({
        try: () => image.metadata(),
        catch: (error) =>
          new ImageProcessingError({
            cause: error,
          }),
      });

      // Process all variants in parallel
      const results = yield* Effect.all(
        IMAGE_VARIANTS.map((variant) => processVariant(image, variant, id)),
        { concurrency: 4 }
      );

      // Build URLs object
      const urls = results.reduce(
        (acc, { name, url }) => {
          acc[name] = url;
          return acc;
        },
        {} as Record<keyof MediaUrls, string>
      ) as MediaUrls;

      // Calculate original size from the original variant
      const originalResult = results.find((r) => r.name === 'original');
      const size = originalResult?.buffer.length ?? buffer.length;

      return {
        urls,
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
        size,
      };
    });

  const deleteVariants = (id: string): Effect.Effect<void, ImageProcessingError> =>
    Effect.gen(function* () {
      yield* Effect.all(
        IMAGE_VARIANTS.map((variant) =>
          storage.delete(`media/${id}/${variant.name}.webp`).pipe(
            Effect.mapError(
              (e) =>
                new ImageProcessingError({
                  cause: e,
                })
            )
          )
        ),
        { concurrency: 4 }
      );
    });

  return { process, deleteVariants };
});

// =============================================================================
// LAYER
// =============================================================================

export const ImageServiceLive = Layer.effect(ImageService, makeImageService);
