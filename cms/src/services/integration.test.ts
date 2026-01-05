import { Effect, Layer } from 'effect';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

import {
  AuthService,
  AuthServiceLive,
  DbService,
  DbServiceLive,
  ImageService,
  ImageServiceLive,
  LocalStorageServiceLive,
  StorageService,
} from './index';

const TEST_DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://cms_user:cms_password@localhost:5432/ivokun_cms';
const TEST_STORAGE_PATH = join(import.meta.dir, '../../.test-storage');

describe('Service Integration', () => {
  const DbLayer = DbServiceLive(TEST_DB_URL);
  const StorageLayer = LocalStorageServiceLive(TEST_STORAGE_PATH, 'http://localhost:3000/storage');
  const AuthLayer = AuthServiceLive.pipe(Layer.provide(DbLayer));
  const ImageLayer = ImageServiceLive.pipe(Layer.provide(StorageLayer));

  const AllLayers = Layer.mergeAll(DbLayer, StorageLayer, AuthLayer, ImageLayer);

  afterAll(() => {
    // Cleanup test storage
    try {
      rmSync(TEST_STORAGE_PATH, { recursive: true, force: true });
    } catch {}
  });

  test('AuthService hashes and verifies passwords', async () => {
    const program = Effect.gen(function* () {
      const auth = yield* AuthService;
      const hash = yield* auth.hashPassword('mypassword123');
      const valid = yield* auth.verifyPassword(hash, 'mypassword123');
      const invalid = yield* auth.verifyPassword(hash, 'wrongpassword');
      return { hash, valid, invalid };
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(AllLayers), Effect.scoped));

    expect(result.hash).toMatch(/^\$argon2/);
    expect(result.valid).toBe(true);
    expect(result.invalid).toBe(false);
  });

  test('ImageService processes images into variants', async () => {
    const program = Effect.gen(function* () {
      const image = yield* ImageService;

      // Create a simple test image (1x1 red pixel PNG)
      const testImage = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      );

      const result = yield* image.process('test-image-id', testImage, 'test.png');
      return result;
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(AllLayers), Effect.scoped));

    expect(result.urls.original).toContain('original.webp');
    expect(result.urls.thumbnail).toContain('thumbnail.webp');
    expect(result.urls.small).toContain('small.webp');
    expect(result.urls.large).toContain('large.webp');
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });

  test('StorageService uploads and deletes files', async () => {
    const program = Effect.gen(function* () {
      const storage = yield* StorageService;

      const testData = Buffer.from('Hello, World!');
      const url = yield* storage.upload('test/hello.txt', testData, 'text/plain');

      yield* storage.delete('test/hello.txt');

      return url;
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(AllLayers), Effect.scoped));

    expect(result).toContain('test/hello.txt');
  });
});
