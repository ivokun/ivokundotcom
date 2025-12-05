# Phase 1: Core Services & Database Layer

> **Duration:** 5-7 days  
> **Prerequisites:** Phase 0 complete, PostgreSQL running, Bun 1.1.38+  
> **PRD Reference:** NFR-4.4.2 (Effect TS), Section 5.1 (Architecture), Section 3.2 (Media)  
> **Goal:** Implement Effect TS services, database connectivity, schema validation, and image processing

---

## Overview

This phase builds the core service layer for the ivokun CMS. By the end of this phase, you will have:

- A working database service with Kysely and Effect TS
- Comprehensive Effect schemas for all entities with validation
- Storage service for Cloudflare R2 (with local filesystem mock)
- Image processing pipeline with Sharp (4 variants, WebP conversion)
- Auth service foundation (password hashing, session management)

### PRD Alignment

| PRD Section | Phase 1 Deliverable |
|-------------|---------------------|
| NFR-4.4.2 | Effect TS for all async operations |
| Section 5.1 | DbService, StorageService, ImageService, AuthService layers |
| Section 3.2 | Image processing pipeline (thumbnail, small, large, original) |
| SEC-9.1.1 | Argon2id password hashing |
| SEC-9.1.3 | Session management (7-day expiry) |

### Success Criteria

- [ ] Database queries work via Effect.runPromise
- [ ] All entity schemas validate correctly
- [ ] Images are processed into 4 WebP variants
- [ ] Password hashing/verification works
- [ ] Session create/validate/destroy works
- [ ] TypeScript compiles without errors
- [ ] All tests pass

---

## Task 1.1: Database Service

### Step 1.1.1: Create Database Configuration

Create `cms/src/config.ts`:

```typescript
/**
 * @fileoverview Configuration loading and validation
 * @see PRD Appendix 16.2 - Environment Variables
 */

import { Config, ConfigError, Effect, Layer, Redacted } from 'effect';

// =============================================================================
// CONFIGURATION SCHEMA
// =============================================================================

export class AppConfig extends Effect.Service<AppConfig>()('AppConfig', {
  effect: Effect.gen(function* () {
    const port = yield* Config.number('PORT').pipe(Config.withDefault(3000));
    const nodeEnv = yield* Config.string('NODE_ENV').pipe(Config.withDefault('development'));
    const databaseUrl = yield* Config.redacted('DATABASE_URL');
    const sessionSecret = yield* Config.redacted('SESSION_SECRET');

    // R2 Configuration
    const r2AccessKeyId = yield* Config.redacted('R2_ACCESS_KEY_ID');
    const r2AccessSecret = yield* Config.redacted('R2_ACCESS_SECRET');
    const r2Endpoint = yield* Config.string('R2_ENDPOINT');
    const r2Bucket = yield* Config.string('R2_BUCKET');
    const r2PublicUrl = yield* Config.string('R2_PUBLIC_URL');

    // CORS
    const corsOrigin = yield* Config.string('CORS_ORIGIN').pipe(Config.withDefault('*'));

    return {
      port,
      nodeEnv,
      databaseUrl,
      sessionSecret,
      r2: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2AccessSecret,
        endpoint: r2Endpoint,
        bucket: r2Bucket,
        publicUrl: r2PublicUrl,
      },
      corsOrigin,
      isDevelopment: nodeEnv === 'development',
      isProduction: nodeEnv === 'production',
    };
  }),
}) {}

export const AppConfigLive = AppConfig.Default;
```

---

### Step 1.1.2: Create Database Service

Create `cms/src/services/db.service.ts`:

```typescript
/**
 * @fileoverview Database service using Kysely with Effect TS
 * @see PRD Section 5.1 - DbService layer
 */

import { Context, Effect, Layer, Scope } from 'effect';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import { DatabaseError } from '../errors';
import type { Database } from '../types';

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export class DbService extends Context.Tag('DbService')<
  DbService,
  {
    readonly db: Kysely<Database>;
    readonly query: <T>(
      operation: string,
      fn: (db: Kysely<Database>) => Promise<T>
    ) => Effect.Effect<T, DatabaseError>;
    readonly transaction: <T, E>(
      fn: (trx: Kysely<Database>) => Effect.Effect<T, E>
    ) => Effect.Effect<T, E | DatabaseError>;
  }
>() {}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export const makeDbService = (connectionString: string) =>
  Effect.gen(function* () {
    const pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    const db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    });

    // Test connection
    yield* Effect.tryPromise({
      try: () => db.selectFrom('users').select('id').limit(1).execute(),
      catch: (error) =>
        new DatabaseError({
          cause: error,
          operation: 'connection_test',
        }),
    });

    const query = <T>(
      operation: string,
      fn: (db: Kysely<Database>) => Promise<T>
    ): Effect.Effect<T, DatabaseError> =>
      Effect.tryPromise({
        try: () => fn(db),
        catch: (error) => new DatabaseError({ cause: error, operation }),
      });

    const transaction = <T, E>(
      fn: (trx: Kysely<Database>) => Effect.Effect<T, E>
    ): Effect.Effect<T, E | DatabaseError> =>
      Effect.acquireUseRelease(
        Effect.tryPromise({
          try: () => db.transaction().execute(async (trx) => trx),
          catch: (error) =>
            new DatabaseError({ cause: error, operation: 'transaction_start' }),
        }),
        (trx) => fn(trx as Kysely<Database>),
        (trx, exit) =>
          Effect.sync(() => {
            // Kysely handles commit/rollback automatically
          })
      );

    // Register cleanup
    yield* Effect.addFinalizer(() =>
      Effect.promise(async () => {
        await db.destroy();
        await pool.end();
      })
    );

    return { db, query, transaction };
  });

// =============================================================================
// LAYER
// =============================================================================

export const DbServiceLive = (connectionString: string) =>
  Layer.scoped(DbService, makeDbService(connectionString));
```

---

### Step 1.1.3: Test Database Service

Create `cms/src/services/db.service.test.ts`:

```typescript
import { Effect, Layer, Scope } from 'effect';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { DbService, DbServiceLive } from './db.service';

const TEST_DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://cms_user:cms_password@localhost:5432/ivokun_cms';

describe('DbService', () => {
  test('connects to database successfully', async () => {
    const program = Effect.gen(function* () {
      const { query } = yield* DbService;
      const result = yield* query('test_query', (db) =>
        db.selectFrom('home').select('id').execute()
      );
      return result;
    });

    const scope = Effect.runSync(Scope.make());
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(DbServiceLive(TEST_DB_URL)), Effect.scoped)
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('singleton');
  });

  test('wraps database errors correctly', async () => {
    const program = Effect.gen(function* () {
      const { query } = yield* DbService;
      return yield* query('invalid_query', (db) =>
        db.selectFrom('nonexistent_table' as any).selectAll().execute()
      );
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(DbServiceLive(TEST_DB_URL)),
        Effect.scoped,
        Effect.either
      )
    );

    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('DatabaseError');
    }
  });
});
```

**Run tests:**
```bash
cd cms && bun test src/services/db.service.test.ts
```

---

## Task 1.2: Effect Schema Definitions

### Step 1.2.1: Create Schema Module

Create `cms/src/schemas.ts`:

```typescript
/**
 * @fileoverview Effect Schema definitions for all CMS entities
 * @see PRD Section 6 - Data Model
 * @see PRD Section 7 - API Specification
 */

import { Schema } from 'effect';

// =============================================================================
// PRIMITIVES & ENUMS
// =============================================================================

/** Content locale - PRD Section 3.1.1.9 */
export const Locale = Schema.Literal('en', 'id');
export type Locale = typeof Locale.Type;

/** Content status - PRD FR-3.1.1.4, FR-3.1.1.5 */
export const Status = Schema.Literal('draft', 'published');
export type Status = typeof Status.Type;

/** CUID2 identifier pattern */
export const Cuid2 = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9]{24,}$/),
  Schema.brand('Cuid2')
);
export type Cuid2 = typeof Cuid2.Type;

/** URL-safe slug */
export const Slug = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  Schema.minLength(1),
  Schema.maxLength(200),
  Schema.brand('Slug')
);
export type Slug = typeof Slug.Type;

/** Email address */
export const Email = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.brand('Email')
);
export type Email = typeof Email.Type;

/** Non-empty string */
export const NonEmptyString = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(10000)
);

/** Positive integer */
export const PositiveInt = Schema.Number.pipe(
  Schema.int(),
  Schema.positive()
);

// =============================================================================
// MEDIA SCHEMAS - PRD Section 3.2
// =============================================================================

/** Media URLs for image variants */
export const MediaUrls = Schema.Struct({
  original: Schema.String,
  thumbnail: Schema.String,
  small: Schema.String,
  large: Schema.String,
});
export type MediaUrls = typeof MediaUrls.Type;

/** Media entity - PRD Section 6.2.6 */
export const Media = Schema.Struct({
  id: Cuid2,
  filename: NonEmptyString,
  mime_type: Schema.String,
  size: PositiveInt,
  alt: Schema.NullOr(Schema.String),
  urls: MediaUrls,
  width: Schema.NullOr(PositiveInt),
  height: Schema.NullOr(PositiveInt),
  created_at: Schema.Date,
});
export type Media = typeof Media.Type;

// =============================================================================
// CATEGORY SCHEMAS - PRD Section 6.2.3
// =============================================================================

export const Category = Schema.Struct({
  id: Cuid2,
  name: NonEmptyString,
  slug: Slug,
  description: Schema.NullOr(Schema.String),
  created_at: Schema.Date,
  updated_at: Schema.Date,
});
export type Category = typeof Category.Type;

export const CreateCategoryInput = Schema.Struct({
  name: NonEmptyString,
  slug: Slug,
  description: Schema.optional(Schema.String),
});
export type CreateCategoryInput = typeof CreateCategoryInput.Type;

export const UpdateCategoryInput = Schema.Struct({
  name: Schema.optional(NonEmptyString),
  slug: Schema.optional(Slug),
  description: Schema.optional(Schema.NullOr(Schema.String)),
});
export type UpdateCategoryInput = typeof UpdateCategoryInput.Type;

// =============================================================================
// TIPTAP DOCUMENT - PRD FR-3.3.9
// =============================================================================

export const TipTapMark: Schema.Schema<TipTapMarkType> = Schema.Struct({
  type: Schema.String,
  attrs: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});
type TipTapMarkType = {
  type: string;
  attrs?: Record<string, unknown>;
};

export const TipTapNode: Schema.Schema<TipTapNodeType> = Schema.Struct({
  type: Schema.String,
  attrs: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  content: Schema.optional(Schema.Array(Schema.suspend(() => TipTapNode))),
  marks: Schema.optional(Schema.Array(TipTapMark)),
  text: Schema.optional(Schema.String),
});
type TipTapNodeType = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNodeType[];
  marks?: TipTapMarkType[];
  text?: string;
};

export const TipTapDocument = Schema.Struct({
  type: Schema.Literal('doc'),
  content: Schema.Array(TipTapNode),
});
export type TipTapDocument = typeof TipTapDocument.Type;

// =============================================================================
// POST SCHEMAS - PRD Section 6.2.4
// =============================================================================

export const Post = Schema.Struct({
  id: Cuid2,
  title: NonEmptyString,
  slug: Slug,
  excerpt: Schema.NullOr(Schema.String),
  content: Schema.NullOr(TipTapDocument),
  featured_image: Schema.NullOr(Cuid2),
  read_time_minute: Schema.NullOr(PositiveInt),
  category_id: Schema.NullOr(Cuid2),
  locale: Locale,
  status: Status,
  published_at: Schema.NullOr(Schema.Date),
  created_at: Schema.Date,
  updated_at: Schema.Date,
});
export type Post = typeof Post.Type;

export const CreatePostInput = Schema.Struct({
  title: NonEmptyString,
  slug: Slug,
  excerpt: Schema.optional(Schema.String),
  content: Schema.optional(TipTapDocument),
  featured_image: Schema.optional(Cuid2),
  category_id: Schema.optional(Cuid2),
  locale: Schema.optional(Locale).pipe(Schema.withDefault(() => 'en' as const)),
});
export type CreatePostInput = typeof CreatePostInput.Type;

export const UpdatePostInput = Schema.Struct({
  title: Schema.optional(NonEmptyString),
  slug: Schema.optional(Slug),
  excerpt: Schema.optional(Schema.NullOr(Schema.String)),
  content: Schema.optional(Schema.NullOr(TipTapDocument)),
  featured_image: Schema.optional(Schema.NullOr(Cuid2)),
  category_id: Schema.optional(Schema.NullOr(Cuid2)),
  locale: Schema.optional(Locale),
});
export type UpdatePostInput = typeof UpdatePostInput.Type;

// =============================================================================
// GALLERY SCHEMAS - PRD Section 6.2.5
// =============================================================================

export const Gallery = Schema.Struct({
  id: Cuid2,
  title: NonEmptyString,
  slug: Slug,
  description: Schema.NullOr(Schema.String),
  images: Schema.Array(Cuid2),
  category_id: Schema.NullOr(Cuid2),
  status: Status,
  published_at: Schema.NullOr(Schema.Date),
  created_at: Schema.Date,
  updated_at: Schema.Date,
});
export type Gallery = typeof Gallery.Type;

export const CreateGalleryInput = Schema.Struct({
  title: NonEmptyString,
  slug: Slug,
  description: Schema.optional(Schema.String),
  images: Schema.optional(Schema.Array(Cuid2)),
  category_id: Schema.optional(Cuid2),
});
export type CreateGalleryInput = typeof CreateGalleryInput.Type;

export const UpdateGalleryInput = Schema.Struct({
  title: Schema.optional(NonEmptyString),
  slug: Schema.optional(Slug),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  images: Schema.optional(Schema.Array(Cuid2)),
  category_id: Schema.optional(Schema.NullOr(Cuid2)),
});
export type UpdateGalleryInput = typeof UpdateGalleryInput.Type;

// =============================================================================
// HOME SCHEMAS - PRD Section 6.2.7
// =============================================================================

export const Home = Schema.Struct({
  id: Schema.Literal('singleton'),
  title: Schema.NullOr(Schema.String),
  short_description: Schema.NullOr(Schema.String),
  description: Schema.NullOr(TipTapDocument),
  hero: Schema.NullOr(Cuid2),
  keywords: Schema.NullOr(Schema.String),
  updated_at: Schema.Date,
});
export type Home = typeof Home.Type;

export const UpdateHomeInput = Schema.Struct({
  title: Schema.optional(Schema.NullOr(Schema.String)),
  short_description: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(TipTapDocument)),
  hero: Schema.optional(Schema.NullOr(Cuid2)),
  keywords: Schema.optional(Schema.NullOr(Schema.String)),
});
export type UpdateHomeInput = typeof UpdateHomeInput.Type;

// =============================================================================
// API KEY SCHEMAS - PRD Section 6.2.8
// =============================================================================

export const ApiKey = Schema.Struct({
  id: Cuid2,
  name: NonEmptyString,
  prefix: Schema.String.pipe(Schema.length(8)),
  last_used_at: Schema.NullOr(Schema.Date),
  created_at: Schema.Date,
});
export type ApiKey = typeof ApiKey.Type;

export const CreateApiKeyInput = Schema.Struct({
  name: NonEmptyString,
});
export type CreateApiKeyInput = typeof CreateApiKeyInput.Type;

// =============================================================================
// USER SCHEMAS - PRD Section 6.2.1
// =============================================================================

export const User = Schema.Struct({
  id: Cuid2,
  email: Email,
  name: Schema.NullOr(Schema.String),
  created_at: Schema.Date,
});
export type User = typeof User.Type;

// =============================================================================
// SESSION SCHEMAS - PRD Section 6.2.2
// =============================================================================

export const Session = Schema.Struct({
  id: Cuid2,
  user_id: Cuid2,
  expires_at: Schema.Date,
});
export type Session = typeof Session.Type;

// =============================================================================
// API RESPONSE SCHEMAS - PRD Section 7.1
// =============================================================================

export const PaginationMeta = Schema.Struct({
  total: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  limit: PositiveInt,
  offset: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
});
export type PaginationMeta = typeof PaginationMeta.Type;

export const PaginatedResponse = <T extends Schema.Schema.Any>(itemSchema: T) =>
  Schema.Struct({
    data: Schema.Array(itemSchema),
    meta: PaginationMeta,
  });

export const ListQueryParams = Schema.Struct({
  limit: Schema.optional(PositiveInt).pipe(Schema.withDefault(() => 20)),
  offset: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())).pipe(
    Schema.withDefault(() => 0)
  ),
});
export type ListQueryParams = typeof ListQueryParams.Type;

export const PostListQueryParams = Schema.Struct({
  ...ListQueryParams.fields,
  locale: Schema.optional(Locale),
  status: Schema.optional(Status),
  category_id: Schema.optional(Cuid2),
});
export type PostListQueryParams = typeof PostListQueryParams.Type;

// =============================================================================
// AUTH SCHEMAS
// =============================================================================

export const LoginInput = Schema.Struct({
  email: Email,
  password: Schema.String.pipe(Schema.minLength(8)),
});
export type LoginInput = typeof LoginInput.Type;

export const LoginResponse = Schema.Struct({
  user: User,
  session_id: Cuid2,
});
export type LoginResponse = typeof LoginResponse.Type;
```

---

### Step 1.2.2: Test Schemas

Create `cms/src/schemas.test.ts`:

```typescript
import { Schema } from 'effect';
import { describe, expect, test } from 'bun:test';

import * as S from './schemas';

describe('Schema Validation', () => {
  describe('Primitives', () => {
    test('Slug validates correctly', () => {
      const decode = Schema.decodeUnknownSync(S.Slug);
      
      expect(decode('hello-world')).toBe('hello-world');
      expect(decode('my-post-123')).toBe('my-post-123');
      expect(() => decode('Hello World')).toThrow(); // spaces/caps
      expect(() => decode('')).toThrow(); // empty
      expect(() => decode('--double')).toThrow(); // double dash
    });

    test('Email validates correctly', () => {
      const decode = Schema.decodeUnknownSync(S.Email);
      
      expect(decode('test@example.com')).toBe('test@example.com');
      expect(() => decode('invalid')).toThrow();
      expect(() => decode('no@domain')).toThrow();
    });

    test('Locale only accepts en/id', () => {
      const decode = Schema.decodeUnknownSync(S.Locale);
      
      expect(decode('en')).toBe('en');
      expect(decode('id')).toBe('id');
      expect(() => decode('fr')).toThrow();
    });

    test('Status only accepts draft/published', () => {
      const decode = Schema.decodeUnknownSync(S.Status);
      
      expect(decode('draft')).toBe('draft');
      expect(decode('published')).toBe('published');
      expect(() => decode('pending')).toThrow();
    });
  });

  describe('Category', () => {
    test('CreateCategoryInput validates', () => {
      const decode = Schema.decodeUnknownSync(S.CreateCategoryInput);
      
      const valid = decode({
        name: 'Technology',
        slug: 'technology',
        description: 'Tech posts',
      });
      
      expect(valid.name).toBe('Technology');
      expect(valid.slug).toBe('technology');
    });

    test('CreateCategoryInput rejects invalid slug', () => {
      const decode = Schema.decodeUnknownSync(S.CreateCategoryInput);
      
      expect(() =>
        decode({
          name: 'Technology',
          slug: 'Invalid Slug',
        })
      ).toThrow();
    });
  });

  describe('Post', () => {
    test('CreatePostInput with defaults', () => {
      const decode = Schema.decodeUnknownSync(S.CreatePostInput);
      
      const result = decode({
        title: 'My Post',
        slug: 'my-post',
      });
      
      expect(result.title).toBe('My Post');
      expect(result.locale).toBe('en'); // default
    });

    test('PostListQueryParams with defaults', () => {
      const decode = Schema.decodeUnknownSync(S.PostListQueryParams);
      
      const result = decode({});
      
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });
  });

  describe('TipTap Document', () => {
    test('validates basic document', () => {
      const decode = Schema.decodeUnknownSync(S.TipTapDocument);
      
      const doc = decode({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello world' }],
          },
        ],
      });
      
      expect(doc.type).toBe('doc');
      expect(doc.content).toHaveLength(1);
    });
  });
});
```

**Run tests:**
```bash
cd cms && bun test src/schemas.test.ts
```

---

## Task 1.3: Storage Service

### Step 1.3.1: Create Storage Service

Create `cms/src/services/storage.service.ts`:

```typescript
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
```

---

## Task 1.4: Image Service

### Step 1.4.1: Create Image Processing Service

Create `cms/src/services/image.service.ts`:

```typescript
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
```

---

## Task 1.5: Auth Service

### Step 1.5.1: Create Auth Service

Create `cms/src/services/auth.service.ts`:

```typescript
/**
 * @fileoverview Authentication service with Argon2 password hashing
 * @see PRD SEC-9.1.1 - Argon2id password hashing
 * @see PRD SEC-9.1.3 - 7-day session expiry
 */

import { hash, verify } from '@node-rs/argon2';
import { createId } from '@paralleldrive/cuid2';
import { Context, Effect, Layer } from 'effect';

import { InvalidCredentials, SessionExpired } from '../errors';
import type { NewSession, NewUser, Session, User } from '../types';

import { DbService } from './db.service';

// =============================================================================
// CONSTANTS
// =============================================================================

const SESSION_EXPIRY_DAYS = 7;

// Argon2 configuration (OWASP recommended)
const ARGON2_OPTIONS = {
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
};

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export class AuthService extends Context.Tag('AuthService')<
  AuthService,
  {
    readonly hashPassword: (password: string) => Effect.Effect<string>;
    readonly verifyPassword: (hash: string, password: string) => Effect.Effect<boolean>;
    readonly createSession: (userId: string) => Effect.Effect<Session>;
    readonly validateSession: (sessionId: string) => Effect.Effect<Session, SessionExpired>;
    readonly destroySession: (sessionId: string) => Effect.Effect<void>;
    readonly validateCredentials: (
      email: string,
      password: string
    ) => Effect.Effect<User, InvalidCredentials>;
    readonly generateApiKey: () => { key: string; prefix: string; hash: Effect.Effect<string> };
    readonly verifyApiKey: (
      prefix: string,
      key: string
    ) => Effect.Effect<boolean, InvalidCredentials>;
  }
>() {}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export const makeAuthService = Effect.gen(function* () {
  const { db, query } = yield* DbService;

  const hashPassword = (password: string): Effect.Effect<string> =>
    Effect.promise(() => hash(password, ARGON2_OPTIONS));

  const verifyPassword = (passwordHash: string, password: string): Effect.Effect<boolean> =>
    Effect.promise(() => verify(passwordHash, password, ARGON2_OPTIONS));

  const createSession = (userId: string): Effect.Effect<Session> =>
    Effect.gen(function* () {
      const session: NewSession = {
        id: createId(),
        user_id: userId,
        expires_at: new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      };

      yield* query('create_session', (db) =>
        db.insertInto('sessions').values(session).execute()
      );

      return session as Session;
    });

  const validateSession = (sessionId: string): Effect.Effect<Session, SessionExpired> =>
    Effect.gen(function* () {
      const session = yield* query('get_session', (db) =>
        db
          .selectFrom('sessions')
          .selectAll()
          .where('id', '=', sessionId)
          .where('expires_at', '>', new Date())
          .executeTakeFirst()
      );

      if (!session) {
        return yield* Effect.fail(
          new SessionExpired({ message: 'Session expired or invalid' })
        );
      }

      return session;
    });

  const destroySession = (sessionId: string): Effect.Effect<void> =>
    query('destroy_session', (db) =>
      db.deleteFrom('sessions').where('id', '=', sessionId).execute()
    ).pipe(Effect.map(() => undefined));

  const validateCredentials = (
    email: string,
    password: string
  ): Effect.Effect<User, InvalidCredentials> =>
    Effect.gen(function* () {
      const user = yield* query('get_user_by_email', (db) =>
        db
          .selectFrom('users')
          .selectAll()
          .where('email', '=', email.toLowerCase())
          .executeTakeFirst()
      );

      if (!user) {
        return yield* Effect.fail(
          new InvalidCredentials({ message: 'Invalid email or password' })
        );
      }

      const valid = yield* verifyPassword(user.password_hash, password);

      if (!valid) {
        return yield* Effect.fail(
          new InvalidCredentials({ message: 'Invalid email or password' })
        );
      }

      // Return user without password_hash
      const { password_hash: _, ...safeUser } = user;
      return safeUser as User;
    });

  const generateApiKey = () => {
    const key = `cms_${createId()}${createId()}`;
    const prefix = key.substring(0, 12);
    return {
      key,
      prefix,
      hash: hashPassword(key),
    };
  };

  const verifyApiKey = (
    prefix: string,
    providedKey: string
  ): Effect.Effect<boolean, InvalidCredentials> =>
    Effect.gen(function* () {
      const apiKey = yield* query('get_api_key_by_prefix', (db) =>
        db
          .selectFrom('api_keys')
          .select(['key_hash', 'id'])
          .where('prefix', '=', prefix)
          .executeTakeFirst()
      );

      if (!apiKey) {
        return yield* Effect.fail(
          new InvalidCredentials({ message: 'Invalid API key' })
        );
      }

      const valid = yield* verifyPassword(apiKey.key_hash, providedKey);

      if (!valid) {
        return yield* Effect.fail(
          new InvalidCredentials({ message: 'Invalid API key' })
        );
      }

      // Update last_used_at
      yield* query('update_api_key_usage', (db) =>
        db
          .updateTable('api_keys')
          .set({ last_used_at: new Date() })
          .where('id', '=', apiKey.id)
          .execute()
      );

      return true;
    });

  return {
    hashPassword,
    verifyPassword,
    createSession,
    validateSession,
    destroySession,
    validateCredentials,
    generateApiKey,
    verifyApiKey,
  };
});

// =============================================================================
// LAYER
// =============================================================================

export const AuthServiceLive = Layer.effect(AuthService, makeAuthService);
```

---

### Step 1.5.2: Create Seed Admin Script

Create `cms/scripts/seed-admin.ts`:

```typescript
#!/usr/bin/env bun
/**
 * @fileoverview Seed initial admin user
 * @see PRD Appendix 16.2 - ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 */

import { createId } from '@paralleldrive/cuid2';
import { Effect, Layer } from 'effect';

import { AuthService, AuthServiceLive } from '../src/services/auth.service';
import { DbService, DbServiceLive } from '../src/services/db.service';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgres://cms_user:cms_password@localhost:5432/ivokun_cms';
const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] ?? 'admin@ivokun.com';
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? 'changeme123';
const ADMIN_NAME = process.env['ADMIN_NAME'] ?? 'Administrator';

const program = Effect.gen(function* () {
  const { db, query } = yield* DbService;
  const { hashPassword } = yield* AuthService;

  // Check if admin already exists
  const existing = yield* query('check_admin', (db) =>
    db
      .selectFrom('users')
      .select('id')
      .where('email', '=', ADMIN_EMAIL.toLowerCase())
      .executeTakeFirst()
  );

  if (existing) {
    console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
    return;
  }

  // Hash password and create user
  const passwordHash = yield* hashPassword(ADMIN_PASSWORD);

  yield* query('create_admin', (db) =>
    db
      .insertInto('users')
      .values({
        id: createId(),
        email: ADMIN_EMAIL.toLowerCase(),
        password_hash: passwordHash,
        name: ADMIN_NAME,
      })
      .execute()
  );

  console.log(`Admin user created successfully!`);
  console.log(`  Email: ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`\n⚠️  Change the password after first login!`);
});

const MainLayer = Layer.mergeAll(
  DbServiceLive(DATABASE_URL),
  AuthServiceLive.pipe(Layer.provide(DbServiceLive(DATABASE_URL)))
);

Effect.runPromise(program.pipe(Effect.provide(MainLayer), Effect.scoped))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed admin:', error);
    process.exit(1);
  });
```

Add to `cms/package.json` scripts:
```json
{
  "scripts": {
    "seed:admin": "bun run scripts/seed-admin.ts"
  }
}
```

---

## Task 1.6: Service Index & Exports

### Step 1.6.1: Create Service Index

Create `cms/src/services/index.ts`:

```typescript
/**
 * @fileoverview Service exports and composite layers
 */

export { AuthService, AuthServiceLive, makeAuthService } from './auth.service';
export { DbService, DbServiceLive, makeDbService } from './db.service';
export {
  ImageService,
  ImageServiceLive,
  makeImageService,
  type ProcessedImage,
} from './image.service';
export {
  LocalStorageServiceLive,
  makeLocalStorageService,
  makeR2StorageService,
  R2StorageServiceLive,
  StorageService,
  type StorageConfig,
} from './storage.service';
```

---

## Task 1.7: Verification & Testing

### Step 1.7.1: Create Integration Test

Create `cms/src/services/integration.test.ts`:

```typescript
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

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(AllLayers), Effect.scoped)
    );

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

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(AllLayers), Effect.scoped)
    );

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

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(AllLayers), Effect.scoped)
    );

    expect(result).toContain('test/hello.txt');
  });
});
```

### Step 1.7.2: Run All Tests

```bash
cd cms && bun test
```

**Expected output:**
```
bun test v1.x.x

src/errors.test.ts:
✓ Error System > NotFound generates correct message
✓ Error System > SlugConflict includes locale when provided
... (10 tests)

src/schemas.test.ts:
✓ Schema Validation > Primitives > Slug validates correctly
✓ Schema Validation > Primitives > Email validates correctly
... (10+ tests)

src/services/db.service.test.ts:
✓ DbService > connects to database successfully
✓ DbService > wraps database errors correctly

src/services/integration.test.ts:
✓ Service Integration > AuthService hashes and verifies passwords
✓ Service Integration > ImageService processes images into variants
✓ Service Integration > StorageService uploads and deletes files

 25+ pass
 0 fail
```

---

## Final Checklist

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | DbService connects and queries | `bun test db.service.test.ts` |
| 2 | All schemas validate correctly | `bun test schemas.test.ts` |
| 3 | StorageService uploads/deletes | `bun test integration.test.ts` |
| 4 | ImageService creates 4 variants | `bun test integration.test.ts` |
| 5 | AuthService hashes passwords | `bun test integration.test.ts` |
| 6 | TypeScript compiles | `bun run typecheck` |
| 7 | All tests pass | `bun test` |

---

## Directory Structure After Phase 1

```
cms/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── .prettierrc
├── eslint.config.js
├── docker-compose.yml
├── db/
│   └── migrations/
│       └── 20251204164209_initial_schema.sql
├── scripts/
│   ├── verify-phase0.ts
│   └── seed-admin.ts
└── src/
    ├── types.ts              (~250 LOC)
    ├── errors.ts             (~220 LOC)
    ├── errors.test.ts
    ├── schemas.ts            (~350 LOC) ← NEW
    ├── schemas.test.ts                  ← NEW
    ├── config.ts             (~50 LOC)  ← NEW
    └── services/
        ├── index.ts                     ← NEW
        ├── db.service.ts     (~100 LOC) ← NEW
        ├── db.service.test.ts           ← NEW
        ├── storage.service.ts (~150 LOC) ← NEW
        ├── image.service.ts  (~150 LOC) ← NEW
        ├── auth.service.ts   (~200 LOC) ← NEW
        └── integration.test.ts          ← NEW
```

**Total New Code:** ~1000 LOC

---

## Next Steps

Phase 1 establishes the service layer. **Phase 2: Business Logic Services** will build:

1. **CategoryService** - CRUD operations for categories
2. **MediaService** - Upload, list, delete media
3. **PostService** - CRUD with publish/unpublish workflow
4. **GalleryService** - Gallery management
5. **HomeService** - Singleton home page content

**Estimated duration:** 3-5 days

---

## Document Information

| Field | Value |
|-------|-------|
| Phase | 1 - Core Services & Database Layer |
| PRD Version | 1.0.0 |
| Last Updated | December 2024 |
| Status | Ready for Implementation |
