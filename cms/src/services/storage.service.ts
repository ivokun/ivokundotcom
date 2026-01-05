/**
 * @fileoverview Storage service for Cloudflare R2 with local filesystem fallback
 * @see PRD Section 3.2 - FR-3.2.4 Store images in Cloudflare R2
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Context, Effect, Layer, Redacted } from 'effect';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { StorageError } from '../errors';

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface StorageConfig {
  accessKeyId: Redacted.Redacted<string>;
  secretAccessKey: Redacted.Redacted<string>;
  endpoint: string;
  bucket: string;
  publicUrl: string;
}

export class StorageService extends Context.Tag('StorageService')<
  StorageService,
  {
    readonly upload: (
      key: string,
      data: Buffer,
      contentType: string
    ) => Effect.Effect<string, StorageError>;
    readonly delete: (key: string) => Effect.Effect<void, StorageError>;
    readonly getPublicUrl: (key: string) => string;
  }
>() {}

// =============================================================================
// R2 IMPLEMENTATION
// =============================================================================

export const makeR2StorageService = (config: StorageConfig) =>
  Effect.gen(function* () {
    const client = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: Redacted.value(config.accessKeyId),
        secretAccessKey: Redacted.value(config.secretAccessKey),
      },
    });

    const upload = (
      key: string,
      data: Buffer,
      contentType: string
    ): Effect.Effect<string, StorageError> =>
      Effect.tryPromise({
        try: async () => {
          await client.send(
            new PutObjectCommand({
              Bucket: config.bucket,
              Key: key,
              Body: data,
              ContentType: contentType,
            })
          );
          return `${config.publicUrl}/${key}`;
        },
        catch: (error) =>
          new StorageError({
            cause: error,
            operation: `upload:${key}`,
          }),
      });

    const del = (key: string): Effect.Effect<void, StorageError> =>
      Effect.tryPromise({
        try: async () => {
          await client.send(
            new DeleteObjectCommand({
              Bucket: config.bucket,
              Key: key,
            })
          );
        },
        catch: (error) =>
          new StorageError({
            cause: error,
            operation: `delete:${key}`,
          }),
      });

    const getPublicUrl = (key: string): string => `${config.publicUrl}/${key}`;

    return { upload, delete: del, getPublicUrl };
  });

// =============================================================================
// LOCAL FILESYSTEM IMPLEMENTATION (Development)
// =============================================================================

export const makeLocalStorageService = (basePath: string, baseUrl: string) =>
  Effect.sync(() => {
    // Ensure base directory exists
    if (!existsSync(basePath)) {
      mkdirSync(basePath, { recursive: true });
    }

    const upload = (
      key: string,
      data: Buffer,
      _contentType: string
    ): Effect.Effect<string, StorageError> =>
      Effect.try({
        try: () => {
          const filePath = join(basePath, key);
          const dir = filePath.substring(0, filePath.lastIndexOf('/'));
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
          writeFileSync(filePath, data);
          return `${baseUrl}/${key}`;
        },
        catch: (error) =>
          new StorageError({
            cause: error,
            operation: `upload:${key}`,
          }),
      });

    const del = (key: string): Effect.Effect<void, StorageError> =>
      Effect.try({
        try: () => {
          const filePath = join(basePath, key);
          if (existsSync(filePath)) {
            rmSync(filePath);
          }
        },
        catch: (error) =>
          new StorageError({
            cause: error,
            operation: `delete:${key}`,
          }),
      });

    const getPublicUrl = (key: string): string => `${baseUrl}/${key}`;

    return { upload, delete: del, getPublicUrl };
  });

// =============================================================================
// LAYERS
// =============================================================================

export const R2StorageServiceLive = (config: StorageConfig) =>
  Layer.effect(StorageService, makeR2StorageService(config));

export const LocalStorageServiceLive = (basePath: string, baseUrl: string) =>
  Layer.effect(StorageService, makeLocalStorageService(basePath, baseUrl));
