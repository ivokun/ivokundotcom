/**
 * @fileoverview Storage service for Cloudflare R2 (S3-compatible)
 * Always uses R2 — dev bucket in development, prod bucket in production.
 * Supports presigned URLs for direct browser-to-bucket uploads.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Context, Effect, Layer, Redacted } from 'effect';

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
    readonly getObject: (key: string) => Effect.Effect<Buffer, StorageError>;
    readonly getPresignedUploadUrl: (
      key: string,
      contentType: string,
      expiresIn?: number
    ) => Effect.Effect<string, StorageError>;
    readonly getPublicUrl: (key: string) => string;
  }
>() {}

// =============================================================================
// R2 IMPLEMENTATION (used for both dev and prod)
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

    const getObject = (key: string): Effect.Effect<Buffer, StorageError> =>
      Effect.tryPromise({
        try: async () => {
          const response = await client.send(
            new GetObjectCommand({
              Bucket: config.bucket,
              Key: key,
            })
          );
          if (!response.Body) {
            throw new Error(`Empty response body for key: ${key}`);
          }
          const bytes = await response.Body.transformToByteArray();
          return Buffer.from(bytes);
        },
        catch: (error) =>
          new StorageError({
            cause: error,
            operation: `getObject:${key}`,
          }),
      });

    const getPresignedUploadUrl = (
      key: string,
      contentType: string,
      expiresIn = 600
    ): Effect.Effect<string, StorageError> =>
      Effect.tryPromise({
        try: async () => {
          const command = new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            ContentType: contentType,
          });
          return await getSignedUrl(client, command, {
            expiresIn,
            signableHeaders: new Set(['content-type']),
          });
        },
        catch: (error) =>
          new StorageError({
            cause: error,
            operation: `presign:${key}`,
          }),
      });

    const getPublicUrl = (key: string): string => `${config.publicUrl}/${key}`;

    return { upload, delete: del, getObject, getPresignedUploadUrl, getPublicUrl };
  });

// =============================================================================
// LAYER
// =============================================================================

export const R2StorageServiceLive = (config: StorageConfig) =>
  Layer.effect(StorageService, makeR2StorageService(config));
