# ivokun CMS Specification

> Custom headless CMS replacing Strapi - single binary, Effect TS, Kysely, NixOS deployment

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Development Rules](#development-rules)
6. [Database Schema](#database-schema)
7. [Core Files Specification](#core-files-specification)
8. [API Endpoints](#api-endpoints)
9. [Image Processing Pipeline](#image-processing-pipeline)
10. [Admin SPA](#admin-spa)
11. [Authentication](#authentication)
12. [NixOS Deployment](#nixos-deployment)
13. [Migration from Strapi](#migration-from-strapi)
14. [Environment Variables](#environment-variables)

---

## Overview

### Purpose

Replace Strapi CMS with a lightweight, custom-built CMS that:

- Compiles to a **single binary** using Bun
- Uses **functional programming** patterns with Effect TS
- Deploys to **NixOS** via clan.lol
- Provides a **thin REST API** for blog consumption
- Includes a **fetch-based admin SPA** for content management

### Key Features

- Draft/Publish workflow
- Internationalization (en, id locales)
- Rich text editing with inline images (TipTap)
- Automatic image processing (3 sizes + WebP compression)
- API key authentication for public API
- Session-based authentication for admin

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                   Single Binary (Bun)                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Effect TS Runtime                       │  │
│  │  ┌─────────┐  ┌─────────┐  ┌───────────────────┐     │  │
│  │  │ HttpApi │  │Services │  │  Image Pipeline   │     │  │
│  │  │ (routes)│─▶│ (logic) │─▶│  (sharp + R2)     │     │  │
│  │  └─────────┘  └─────────┘  └───────────────────┘     │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                 │
│         ┌────────────────┼────────────────┐                │
│         ▼                ▼                ▼                │
│  ┌───────────┐    ┌───────────┐    ┌─────────────┐         │
│  │ PostgreSQL│    │Cloudflare │    │ Static SPA  │         │
│  │  (Kysely) │    │    R2     │    │  /admin     │         │
│  └───────────┘    └───────────┘    └─────────────┘         │
└────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Blog (Cloudflare Pages)          Admin SPA
         │                           │
         │ GET /api/* (API Key)      │ /admin/api/* (Session)
         ▼                           ▼
    ┌─────────────────────────────────────┐
    │         Effect HTTP Server          │
    │  ┌───────────┐  ┌────────────────┐  │
    │  │ Public API│  │   Admin API    │  │
    │  │ (readonly)│  │ (CRUD + auth)  │  │
    │  └─────┬─────┘  └───────┬────────┘  │
    │        └────────┬───────┘           │
    │                 ▼                   │
    │  ┌──────────────────────────────┐   │
    │  │      Service Layer           │   │
    │  │  PostService, AuthService,   │   │
    │  │  ImageService, etc.          │   │
    │  └──────────────┬───────────────┘   │
    │                 ▼                   │
    │  ┌──────────────────────────────┐   │
    │  │     Kysely Query Builder     │   │
    │  └──────────────┬───────────────┘   │
    └─────────────────┼───────────────────┘
                      ▼
              ┌───────────────┐
              │  PostgreSQL   │
              └───────────────┘
```

---

## Technology Stack

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Runtime | Bun | 1.1+ | Single binary compile, fast, TypeScript native |
| HTTP Server | @effect/platform | latest | Effect-native, type-safe routing |
| FP Framework | Effect TS | 3.x | Pipes, services, typed errors |
| Query Builder | Kysely | 0.27+ | SQL-like syntax, no ORM magic, type-safe |
| Migrations | dbmate | latest | Simple, database-agnostic migration tool |
| Validation | @effect/schema | latest | Runtime validation, type inference |
| Admin SPA | SolidJS | 1.8+ | Small bundle, fine-grained reactivity |
| Rich Editor | TipTap | 2.x | ProseMirror-based, extensible |
| Image Processing | sharp | 0.33+ | Fast, WebP support, resize |
| Password Hashing | @node-rs/argon2 | latest | Secure, fast native binding |
| ID Generation | @paralleldrive/cuid2 | latest | Collision-resistant, URL-safe |
| Database | PostgreSQL | 16 | Existing infrastructure |
| Storage | Cloudflare R2 | - | S3-compatible, existing setup |
| Deploy | NixOS + clan.lol | - | Declarative, reproducible |

### Dependencies

```json
{
  "dependencies": {
    "effect": "^3.0.0",
    "@effect/platform": "^0.58.0",
    "@effect/platform-bun": "^0.37.0",
    "@effect/schema": "^0.68.0",
    "kysely": "^0.27.0",
    "pg": "^8.11.0",
    "@aws-sdk/client-s3": "^3.500.0",
    "sharp": "^0.33.0",
    "@node-rs/argon2": "^1.7.0",
    "@paralleldrive/cuid2": "^2.2.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "solid-js": "^1.8.0",
    "@solidjs/router": "^0.13.0",
    "solid-tiptap": "^0.7.0",
    "@tiptap/starter-kit": "^2.4.0",
    "@tiptap/extension-image": "^2.4.0",
    "@tiptap/extension-link": "^2.4.0",
    "vite": "^5.2.0",
    "vite-plugin-solid": "^2.10.0"
  }
}
```

---

## Project Structure

```
cms/
├── src/
│   ├── server.ts      # Bun entry, Effect runtime, HTTP routes
│   ├── index.tsx      # SolidJS admin SPA entry
│   ├── schemas.ts     # Effect Schema definitions (DB + API)
│   ├── services.ts    # All business logic (DB, R2, Auth, Image)
│   ├── errors.ts      # Domain error hierarchy
│   └── types.ts       # TypeScript types, Kysely DB interface
├── db/
│   └── migrations/           # dbmate migration files
│       └── 20240101000000_initial.sql
├── public/            # Built SPA assets (generated)
├── scripts/
│   └── migrate-strapi.ts
├── flake.nix          # Nix flake for building
├── module.nix         # NixOS service module
├── package.json
├── tsconfig.json
├── vite.config.ts     # SPA build config
└── README.md
```

---

## Development Rules

### Core Principles

1. **Flat structure** — All source code in `src/`, no nested directories
2. **6 files maximum to start** — Only expand when a file exceeds ~500 lines
3. **Effect everywhere** — All async operations return `Effect<A, E, R>`
4. **Kysely raw SQL style** — Use query builder methods, no ORM relations
5. **Schema-first** — Define Effect Schemas, derive TypeScript types
6. **Explicit errors** — Tagged union errors, no thrown exceptions

### File Responsibilities

| File | Responsibility | Max Lines (soft) |
|------|----------------|------------------|
| `types.ts` | Kysely DB interface, Config type, utility types | 200 |
| `errors.ts` | Tagged error classes using `Data.TaggedError` | 100 |
| `schemas.ts` | Effect Schema definitions for validation | 300 |
| `services.ts` | Business logic, DB queries, external integrations | 800 |
| `server.ts` | HTTP routes, middleware, Effect runtime | 500 |
| `index.tsx` | Admin SPA (components, pages, API client) | 1000 |

### When to Split Files

- `services.ts` > 800 lines → Extract to `services/*.ts` (still flat in services/)
- `index.tsx` > 1000 lines → Extract components to `components.tsx`, pages to `pages.tsx`
- New domain emerges → Add new service file only if clearly bounded

### Code Style

```typescript
// ✅ Good: Effect pipe style
const getPost = (id: string) =>
  pipe(
    DbService,
    Effect.flatMap((db) =>
      Effect.tryPromise({
        try: () => db.selectFrom('posts').selectAll().where('id', '=', id).executeTakeFirst(),
        catch: (e) => new DatabaseError({ message: 'Query failed', cause: e }),
      })
    ),
    Effect.flatMap((post) =>
      post ? Effect.succeed(post) : Effect.fail(new NotFound({ resource: 'Post', id }))
    )
  );

// ✅ Good: Effect generator style for complex flows
const createPost = (data: CreatePostInput) =>
  Effect.gen(function* () {
    const db = yield* DbService;
    
    const existing = yield* Effect.tryPromise({
      try: () => db.selectFrom('posts').select('id').where('slug', '=', data.slug).executeTakeFirst(),
      catch: (e) => new DatabaseError({ message: 'Query failed', cause: e }),
    });
    
    if (existing) {
      return yield* Effect.fail(new SlugConflict({ slug: data.slug }));
    }
    
    const post = yield* Effect.tryPromise({
      try: () => db.insertInto('posts').values({ ...data, id: createId() }).returningAll().executeTakeFirstOrThrow(),
      catch: (e) => new DatabaseError({ message: 'Insert failed', cause: e }),
    });
    
    return post;
  });

// ❌ Bad: Thrown exceptions
const getPostBad = async (id: string) => {
  const post = await db.selectFrom('posts').where('id', '=', id).executeTakeFirst();
  if (!post) throw new Error('Not found'); // Don't do this
  return post;
};
```

---

## Database Schema

### Migration Tool

This project uses **[dbmate](https://github.com/amacneil/dbmate)** for database migrations. Dbmate is a database-agnostic migration tool that:

- Works with PostgreSQL, MySQL, SQLite, and more
- Uses plain SQL for migrations (no DSL to learn)
- Supports up/down migrations
- Is distributed as a single binary
- Integrates well with NixOS deployments

**Commands:**
```bash
# Create a new migration
dbmate new migration_name

# Apply pending migrations
dbmate up

# Rollback the last migration
dbmate down

# Check migration status
dbmate status
```

**Configuration:**
Set `DATABASE_URL` environment variable or create a `.env` file:
```
DATABASE_URL=postgres://user:pass@localhost:5432/cms?sslmode=disable
```

### SQL Migrations

Migration files are stored in `migrations/` directory and follow the naming pattern: `YYYYMMDDHHMMSS_description.sql`.

#### 20240101000000_initial.sql

```sql
-- migrate:up

-- Enums
CREATE TYPE status AS ENUM ('draft', 'published');
CREATE TYPE locale AS ENUM ('en', 'id');

-- Users (admin only)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX sessions_user_id ON sessions(user_id);
CREATE INDEX sessions_expires_at ON sessions(expires_at);

-- Categories
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Media
CREATE TABLE media (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  alt TEXT,
  urls JSONB NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Posts
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  content JSONB,
  featured_image TEXT REFERENCES media(id) ON DELETE SET NULL,
  read_time_minute INTEGER,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  locale locale NOT NULL DEFAULT 'en',
  status status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX posts_slug_locale ON posts(slug, locale);
CREATE INDEX posts_status ON posts(status);
CREATE INDEX posts_locale ON posts(locale);
CREATE INDEX posts_category_id ON posts(category_id);
CREATE INDEX posts_published_at ON posts(published_at DESC);

-- Galleries
CREATE TABLE galleries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  images JSONB NOT NULL DEFAULT '[]',
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  status status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX galleries_status ON galleries(status);
CREATE INDEX galleries_category_id ON galleries(category_id);

-- Home (singleton)
CREATE TABLE home (
  id TEXT PRIMARY KEY DEFAULT 'singleton' CHECK (id = 'singleton'),
  title TEXT,
  short_description TEXT,
  description JSONB,
  hero TEXT REFERENCES media(id) ON DELETE SET NULL,
  keywords TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO home (id) VALUES ('singleton');

-- API Keys
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX api_keys_prefix ON api_keys(prefix);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER galleries_updated_at BEFORE UPDATE ON galleries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER home_updated_at BEFORE UPDATE ON home
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- migrate:down

DROP TRIGGER IF EXISTS home_updated_at ON home;
DROP TRIGGER IF EXISTS galleries_updated_at ON galleries;
DROP TRIGGER IF EXISTS categories_updated_at ON categories;
DROP TRIGGER IF EXISTS posts_updated_at ON posts;
DROP FUNCTION IF EXISTS update_updated_at();

DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS home;
DROP TABLE IF EXISTS galleries;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS locale;
DROP TYPE IF EXISTS status;
```

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CONTENT TYPES                                │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│      POST       │         │    CATEGORY     │         │     GALLERY     │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ id          PK  │         │ id          PK  │         │ id          PK  │
│ title           │         │ name            │         │ title           │
│ slug            │         │ slug        UK  │         │ slug        UK  │
│ excerpt         │         │ description     │         │ description     │
│ content (JSON)  │         │ created_at      │         │ images (JSON[]) │
│ featured_image ─┼────┐    │ updated_at      │    ┌────┼─ category_id FK │
│ read_time_minute│    │    └────────┬────────┘    │    │ status          │
│ category_id  ───┼────┼─────────────┘             │    │ published_at    │
│ locale          │    │                           │    │ created_at      │
│ status          │    │                           │    │ updated_at      │
│ published_at    │    │    ┌─────────────────┐    │    └─────────────────┘
│ created_at      │    │    │      MEDIA      │    │
│ updated_at      │    │    ├─────────────────┤    │
└─────────────────┘    │    │ id          PK  │    │
                       └───▶│ filename        │◀───┘
┌─────────────────┐         │ mime_type       │
│      HOME       │         │ size            │
├─────────────────┤         │ alt             │
│ id='singleton'  │         │ urls (JSON)     │
│ title           │         │ width           │
│ short_description         │ height          │
│ description(JSON)│        │ created_at      │
│ hero ───────────┼────────▶└─────────────────┘
│ keywords        │
│ updated_at      │         ┌─────────────────┐
└─────────────────┘         │      USER       │
                            ├─────────────────┤
┌─────────────────┐         │ id          PK  │
│    API_KEYS     │         │ email       UK  │
├─────────────────┤         │ password_hash   │
│ id          PK  │         │ name            │
│ name            │         │ created_at      │
│ key_hash        │         └────────┬────────┘
│ prefix          │                  │
│ last_used_at    │         ┌────────┴────────┐
│ created_at      │         │    SESSION      │
└─────────────────┘         ├─────────────────┤
                            │ id          PK  │
                            │ user_id     FK  │
                            │ expires_at      │
                            └─────────────────┘
```

---

## Core Files Specification

### types.ts

```typescript
import type { Generated, ColumnType } from 'kysely';

// ============================================================================
// Kysely Database Interface
// ============================================================================

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  categories: CategoriesTable;
  posts: PostsTable;
  galleries: GalleriesTable;
  home: HomeTable;
  media: MediaTable;
  api_keys: ApiKeysTable;
}

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: Generated<Date>;
}

export interface SessionsTable {
  id: string;
  user_id: string;
  expires_at: Date;
}

export interface CategoriesTable {
  id: Generated<string>;
  name: string;
  slug: string;
  description: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface PostsTable {
  id: Generated<string>;
  title: string;
  slug: string;
  excerpt: string | null;
  content: unknown | null;
  featured_image: string | null;
  read_time_minute: number | null;
  category_id: string | null;
  locale: 'en' | 'id';
  status: 'draft' | 'published';
  published_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface GalleriesTable {
  id: Generated<string>;
  title: string;
  slug: string;
  description: string | null;
  images: string[];
  category_id: string | null;
  status: 'draft' | 'published';
  published_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface HomeTable {
  id: string;
  title: string | null;
  short_description: string | null;
  description: unknown | null;
  hero: string | null;
  keywords: string | null;
  updated_at: Generated<Date>;
}

export interface MediaTable {
  id: Generated<string>;
  filename: string;
  mime_type: string;
  size: number;
  alt: string | null;
  urls: MediaUrls;
  width: number | null;
  height: number | null;
  created_at: Generated<Date>;
}

export interface ApiKeysTable {
  id: Generated<string>;
  name: string;
  key_hash: string;
  prefix: string;
  last_used_at: Date | null;
  created_at: Generated<Date>;
}

// ============================================================================
// Shared Types
// ============================================================================

export interface MediaUrls {
  original: string;
  thumbnail: string;
  small: string;
  large: string;
}

export interface Config {
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  r2: {
    accessKeyId: string;
    secretAccessKey: string;
    endpoint: string;
    bucket: string;
    publicUrl: string;
  };
}

export type Locale = 'en' | 'id';
export type Status = 'draft' | 'published';
```

### errors.ts

```typescript
import { Data } from 'effect';

// ============================================================================
// Authentication Errors
// ============================================================================

export class InvalidCredentials extends Data.TaggedError('InvalidCredentials')<{
  message: string;
}> {}

export class SessionExpired extends Data.TaggedError('SessionExpired')<{
  message: string;
}> {}

export class InvalidApiKey extends Data.TaggedError('InvalidApiKey')<{
  message: string;
}> {}

export class Unauthorized extends Data.TaggedError('Unauthorized')<{
  message: string;
}> {}

// ============================================================================
// Resource Errors
// ============================================================================

export class NotFound extends Data.TaggedError('NotFound')<{
  resource: string;
  id: string;
}> {}

export class SlugConflict extends Data.TaggedError('SlugConflict')<{
  slug: string;
  locale?: string;
}> {}

export class ValidationError extends Data.TaggedError('ValidationError')<{
  message: string;
  errors: Array<{ path: string; message: string }>;
}> {}

// ============================================================================
// Infrastructure Errors
// ============================================================================

export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  message: string;
  cause?: unknown;
}> {}

export class StorageError extends Data.TaggedError('StorageError')<{
  message: string;
  cause?: unknown;
}> {}

export class ImageProcessingError extends Data.TaggedError('ImageProcessingError')<{
  message: string;
  cause?: unknown;
}> {}

// ============================================================================
// Error Union Types
// ============================================================================

export type AuthError = InvalidCredentials | SessionExpired | InvalidApiKey | Unauthorized;

export type ResourceError = NotFound | SlugConflict | ValidationError;

export type InfraError = DatabaseError | StorageError | ImageProcessingError;

export type ApiError = AuthError | ResourceError | InfraError;
```

### schemas.ts

```typescript
import { Schema as S } from '@effect/schema';

// ============================================================================
// Enums
// ============================================================================

export const Locale = S.Literal('en', 'id');
export type Locale = S.Schema.Type<typeof Locale>;

export const Status = S.Literal('draft', 'published');
export type Status = S.Schema.Type<typeof Status>;

// ============================================================================
// Common Schemas
// ============================================================================

export const MediaUrls = S.Struct({
  original: S.String,
  thumbnail: S.String,
  small: S.String,
  large: S.String,
});

export const TipTapContent = S.Unknown;

export const Slug = S.String.pipe(
  S.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  S.brand('Slug')
);

export const Email = S.String.pipe(S.pattern(/@/), S.brand('Email'));

// ============================================================================
// Entity Schemas
// ============================================================================

export const Category = S.Struct({
  id: S.String,
  name: S.String,
  slug: S.String,
  description: S.NullOr(S.String),
  created_at: S.Date,
  updated_at: S.Date,
});
export type Category = S.Schema.Type<typeof Category>;

export const Post = S.Struct({
  id: S.String,
  title: S.String,
  slug: S.String,
  excerpt: S.NullOr(S.String),
  content: S.NullOr(TipTapContent),
  featured_image: S.NullOr(S.String),
  read_time_minute: S.NullOr(S.Number),
  category_id: S.NullOr(S.String),
  locale: Locale,
  status: Status,
  published_at: S.NullOr(S.Date),
  created_at: S.Date,
  updated_at: S.Date,
});
export type Post = S.Schema.Type<typeof Post>;

export const Gallery = S.Struct({
  id: S.String,
  title: S.String,
  slug: S.String,
  description: S.NullOr(S.String),
  images: S.Array(S.String),
  category_id: S.NullOr(S.String),
  status: Status,
  published_at: S.NullOr(S.Date),
  created_at: S.Date,
  updated_at: S.Date,
});
export type Gallery = S.Schema.Type<typeof Gallery>;

export const Home = S.Struct({
  id: S.String,
  title: S.NullOr(S.String),
  short_description: S.NullOr(S.String),
  description: S.NullOr(TipTapContent),
  hero: S.NullOr(S.String),
  keywords: S.NullOr(S.String),
  updated_at: S.Date,
});
export type Home = S.Schema.Type<typeof Home>;

export const Media = S.Struct({
  id: S.String,
  filename: S.String,
  mime_type: S.String,
  size: S.Number,
  alt: S.NullOr(S.String),
  urls: MediaUrls,
  width: S.NullOr(S.Number),
  height: S.NullOr(S.Number),
  created_at: S.Date,
});
export type Media = S.Schema.Type<typeof Media>;

export const User = S.Struct({
  id: S.String,
  email: S.String,
  name: S.NullOr(S.String),
  created_at: S.Date,
});
export type User = S.Schema.Type<typeof User>;

// ============================================================================
// API Request Schemas
// ============================================================================

export const LoginRequest = S.Struct({
  email: Email,
  password: S.String.pipe(S.minLength(8)),
});

export const CreateCategory = S.Struct({
  name: S.String.pipe(S.minLength(1)),
  slug: Slug,
  description: S.optional(S.String),
});

export const UpdateCategory = S.partial(CreateCategory);

export const CreatePost = S.Struct({
  title: S.String.pipe(S.minLength(1)),
  slug: Slug,
  excerpt: S.optional(S.String),
  content: S.optional(TipTapContent),
  featured_image: S.optional(S.String),
  read_time_minute: S.optional(S.Number),
  category_id: S.optional(S.String),
  locale: S.optional(Locale, { default: () => 'en' as const }),
  status: S.optional(Status, { default: () => 'draft' as const }),
});

export const UpdatePost = S.partial(CreatePost);

export const CreateGallery = S.Struct({
  title: S.String.pipe(S.minLength(1)),
  slug: Slug,
  description: S.optional(S.String),
  images: S.optional(S.Array(S.String), { default: () => [] }),
  category_id: S.optional(S.String),
  status: S.optional(Status, { default: () => 'draft' as const }),
});

export const UpdateGallery = S.partial(CreateGallery);

export const UpdateHome = S.Struct({
  title: S.optional(S.String),
  short_description: S.optional(S.String),
  description: S.optional(TipTapContent),
  hero: S.optional(S.String),
  keywords: S.optional(S.String),
});

export const CreateApiKey = S.Struct({
  name: S.String.pipe(S.minLength(1)),
});

// ============================================================================
// Query Params
// ============================================================================

export const PaginationParams = S.Struct({
  limit: S.optional(S.NumberFromString.pipe(S.clamp(1, 100)), { default: () => 25 }),
  offset: S.optional(S.NumberFromString, { default: () => 0 }),
});

export const PostsQuery = S.Struct({
  ...PaginationParams.fields,
  locale: S.optional(Locale),
  category: S.optional(S.String),
  status: S.optional(Status),
});

// ============================================================================
// API Response Schemas
// ============================================================================

export const PostWithCategory = S.Struct({
  ...Post.fields,
  category: S.NullOr(Category),
});

export const GalleryWithCategory = S.Struct({
  ...Gallery.fields,
  category: S.NullOr(Category),
});

export const PostWithMedia = S.Struct({
  ...Post.fields,
  category: S.NullOr(Category),
  featured_media: S.NullOr(Media),
});

export const Paginated = <A extends S.Schema.Any>(item: A) =>
  S.Struct({
    data: S.Array(item),
    meta: S.Struct({
      total: S.Number,
      limit: S.Number,
      offset: S.Number,
    }),
  });
```

### services.ts

```typescript
import { Effect, Layer, Context, pipe } from 'effect';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { hash, verify } from '@node-rs/argon2';
import { createId } from '@paralleldrive/cuid2';
import type { Database, Config, MediaUrls } from './types';
import * as Errors from './errors';

// ============================================================================
// Database Service
// ============================================================================

export class DbService extends Context.Tag('DbService')<DbService, Kysely<Database>>() {}

export const makeDbService = (databaseUrl: string) =>
  Layer.succeed(
    DbService,
    new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: databaseUrl }),
      }),
    })
  );

// ============================================================================
// Storage Service
// ============================================================================

export class StorageService extends Context.Tag('StorageService')<
  StorageService,
  {
    upload: (key: string, body: Buffer, contentType: string) => Effect.Effect<string, Errors.StorageError>;
    delete: (key: string) => Effect.Effect<void, Errors.StorageError>;
    publicUrl: (key: string) => string;
  }
>() {}

export const makeStorageService = (r2Config: Config['r2']) => {
  const client = new S3Client({
    region: 'auto',
    endpoint: r2Config.endpoint,
    credentials: {
      accessKeyId: r2Config.accessKeyId,
      secretAccessKey: r2Config.secretAccessKey,
    },
  });

  return Layer.succeed(StorageService, {
    upload: (key, body, contentType) =>
      Effect.tryPromise({
        try: () =>
          client.send(
            new PutObjectCommand({
              Bucket: r2Config.bucket,
              Key: key,
              Body: body,
              ContentType: contentType,
            })
          ),
        catch: (e) => new Errors.StorageError({ message: 'Upload failed', cause: e }),
      }).pipe(Effect.map(() => `${r2Config.publicUrl}/${key}`)),

    delete: (key) =>
      Effect.tryPromise({
        try: () => client.send(new DeleteObjectCommand({ Bucket: r2Config.bucket, Key: key })),
        catch: (e) => new Errors.StorageError({ message: 'Delete failed', cause: e }),
      }).pipe(Effect.asVoid),

    publicUrl: (key) => `${r2Config.publicUrl}/${key}`,
  });
};

// ============================================================================
// Image Service
// ============================================================================

const IMAGE_VARIANTS = [
  { suffix: 'thumbnail', width: 200, quality: 80 },
  { suffix: 'small', width: 800, quality: 85 },
  { suffix: 'large', width: 1920, quality: 85 },
] as const;

export class ImageService extends Context.Tag('ImageService')<
  ImageService,
  {
    process: (
      file: Buffer,
      filename: string
    ) => Effect.Effect<
      { urls: MediaUrls; width: number; height: number },
      Errors.ImageProcessingError | Errors.StorageError,
      StorageService
    >;
  }
>() {}

export const ImageServiceLive = Layer.succeed(ImageService, {
  process: (file, filename) =>
    Effect.gen(function* () {
      const storage = yield* StorageService;
      const baseName = filename.replace(/\.[^.]+$/, '');
      const id = createId();
      const urls: Record<string, string> = {};

      const metadata = yield* Effect.tryPromise({
        try: () => sharp(file).metadata(),
        catch: (e) => new Errors.ImageProcessingError({ message: 'Failed to read metadata', cause: e }),
      });

      // Original (compressed WebP)
      const original = yield* Effect.tryPromise({
        try: () => sharp(file).webp({ quality: 90 }).toBuffer(),
        catch: (e) => new Errors.ImageProcessingError({ message: 'Failed to process original', cause: e }),
      });
      urls.original = yield* storage.upload(`${id}/${baseName}.webp`, original, 'image/webp');

      // Variants
      for (const variant of IMAGE_VARIANTS) {
        const resized = yield* Effect.tryPromise({
          try: () =>
            sharp(file)
              .resize(variant.width, null, { withoutEnlargement: true })
              .webp({ quality: variant.quality })
              .toBuffer(),
          catch: (e) =>
            new Errors.ImageProcessingError({ message: `Failed to create ${variant.suffix}`, cause: e }),
        });
        urls[variant.suffix] = yield* storage.upload(
          `${id}/${baseName}_${variant.suffix}.webp`,
          resized,
          'image/webp'
        );
      }

      return {
        urls: urls as MediaUrls,
        width: metadata.width!,
        height: metadata.height!,
      };
    }),
});

// ============================================================================
// Auth Service
// ============================================================================

export class AuthService extends Context.Tag('AuthService')<
  AuthService,
  {
    hashPassword: (password: string) => Effect.Effect<string>;
    verifyPassword: (hash: string, password: string) => Effect.Effect<boolean>;
    createSession: (userId: string) => Effect.Effect<string, Errors.DatabaseError, DbService>;
    validateSession: (
      sessionId: string
    ) => Effect.Effect<{ userId: string }, Errors.SessionExpired | Errors.DatabaseError, DbService>;
    destroySession: (sessionId: string) => Effect.Effect<void, Errors.DatabaseError, DbService>;
    validateApiKey: (key: string) => Effect.Effect<void, Errors.InvalidApiKey | Errors.DatabaseError, DbService>;
    generateApiKey: () => Effect.Effect<{ key: string; keyHash: string; prefix: string }>;
  }
>() {}

export const AuthServiceLive = Layer.succeed(AuthService, {
  hashPassword: (password) => Effect.promise(() => hash(password)),

  verifyPassword: (hashStr, password) => Effect.promise(() => verify(hashStr, password)),

  createSession: (userId) =>
    Effect.gen(function* () {
      const db = yield* DbService;
      const sessionId = createId();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      yield* Effect.tryPromise({
        try: () =>
          db.insertInto('sessions').values({ id: sessionId, user_id: userId, expires_at: expiresAt }).execute(),
        catch: (e) => new Errors.DatabaseError({ message: 'Failed to create session', cause: e }),
      });

      return sessionId;
    }),

  validateSession: (sessionId) =>
    Effect.gen(function* () {
      const db = yield* DbService;

      const session = yield* Effect.tryPromise({
        try: () =>
          db.selectFrom('sessions').select(['user_id', 'expires_at']).where('id', '=', sessionId).executeTakeFirst(),
        catch: (e) => new Errors.DatabaseError({ message: 'Failed to query session', cause: e }),
      });

      if (!session || session.expires_at < new Date()) {
        return yield* Effect.fail(new Errors.SessionExpired({ message: 'Session expired or invalid' }));
      }

      return { userId: session.user_id };
    }),

  destroySession: (sessionId) =>
    Effect.gen(function* () {
      const db = yield* DbService;
      yield* Effect.tryPromise({
        try: () => db.deleteFrom('sessions').where('id', '=', sessionId).execute(),
        catch: (e) => new Errors.DatabaseError({ message: 'Failed to destroy session', cause: e }),
      });
    }),

  validateApiKey: (key) =>
    Effect.gen(function* () {
      const db = yield* DbService;
      const prefix = key.slice(0, 8);

      const apiKey = yield* Effect.tryPromise({
        try: () =>
          db.selectFrom('api_keys').select(['id', 'key_hash']).where('prefix', '=', prefix).executeTakeFirst(),
        catch: (e) => new Errors.DatabaseError({ message: 'Failed to query API key', cause: e }),
      });

      if (!apiKey) {
        return yield* Effect.fail(new Errors.InvalidApiKey({ message: 'Invalid API key' }));
      }

      const valid = yield* Effect.promise(() => verify(apiKey.key_hash, key));
      if (!valid) {
        return yield* Effect.fail(new Errors.InvalidApiKey({ message: 'Invalid API key' }));
      }

      yield* Effect.tryPromise({
        try: () =>
          db.updateTable('api_keys').set({ last_used_at: new Date() }).where('id', '=', apiKey.id).execute(),
        catch: () => new Errors.DatabaseError({ message: 'Failed to update API key' }),
      });
    }),

  generateApiKey: () =>
    Effect.gen(function* () {
      const key = `cms_${createId()}${createId()}`;
      const keyHash = yield* Effect.promise(() => hash(key));
      return { key, keyHash, prefix: key.slice(0, 8) };
    }),
});

// ============================================================================
// Post Service
// ============================================================================

export class PostService extends Context.Tag('PostService')<
  PostService,
  {
    findMany: (params: {
      limit: number;
      offset: number;
      locale?: string;
      category?: string;
      status?: string;
    }) => Effect.Effect<{ data: unknown[]; total: number }, Errors.DatabaseError, DbService>;
    findBySlug: (
      slug: string,
      locale: string
    ) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
    findById: (id: string) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
    create: (data: unknown) => Effect.Effect<unknown, Errors.SlugConflict | Errors.DatabaseError, DbService>;
    update: (id: string, data: unknown) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
    delete: (id: string) => Effect.Effect<void, Errors.NotFound | Errors.DatabaseError, DbService>;
    publish: (id: string) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
    unpublish: (id: string) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
  }
>() {}

export const PostServiceLive = Layer.succeed(PostService, {
  findMany: ({ limit, offset, locale, category, status }) =>
    Effect.gen(function* () {
      const db = yield* DbService;

      let query = db
        .selectFrom('posts')
        .leftJoin('categories', 'posts.category_id', 'categories.id')
        .selectAll('posts')
        .select(['categories.name as category_name', 'categories.slug as category_slug']);

      if (locale) query = query.where('posts.locale', '=', locale as any);
      if (category) query = query.where('categories.slug', '=', category);
      if (status) query = query.where('posts.status', '=', status as any);

      const [data, countResult] = yield* Effect.all([
        Effect.tryPromise({
          try: () => query.orderBy('posts.created_at', 'desc').limit(limit).offset(offset).execute(),
          catch: (e) => new Errors.DatabaseError({ message: 'Failed to query posts', cause: e }),
        }),
        Effect.tryPromise({
          try: () => db.selectFrom('posts').select(db.fn.countAll().as('count')).executeTakeFirst(),
          catch: (e) => new Errors.DatabaseError({ message: 'Failed to count posts', cause: e }),
        }),
      ]);

      return { data, total: Number(countResult?.count ?? 0) };
    }),

  findBySlug: (slug, locale) =>
    Effect.gen(function* () {
      const db = yield* DbService;

      const post = yield* Effect.tryPromise({
        try: () =>
          db
            .selectFrom('posts')
            .leftJoin('categories', 'posts.category_id', 'categories.id')
            .leftJoin('media', 'posts.featured_image', 'media.id')
            .selectAll('posts')
            .select([
              'categories.id as cat_id',
              'categories.name as category_name',
              'categories.slug as category_slug',
              'media.urls as featured_media_urls',
              'media.alt as featured_media_alt',
            ])
            .where('posts.slug', '=', slug)
            .where('posts.locale', '=', locale as any)
            .where('posts.status', '=', 'published')
            .executeTakeFirst(),
        catch: (e) => new Errors.DatabaseError({ message: 'Failed to query post', cause: e }),
      });

      if (!post) {
        return yield* Effect.fail(new Errors.NotFound({ resource: 'Post', id: slug }));
      }

      return post;
    }),

  findById: (id) =>
    Effect.gen(function* () {
      const db = yield* DbService;

      const post = yield* Effect.tryPromise({
        try: () => db.selectFrom('posts').selectAll().where('id', '=', id).executeTakeFirst(),
        catch: (e) => new Errors.DatabaseError({ message: 'Failed to query post', cause: e }),
      });

      if (!post) {
        return yield* Effect.fail(new Errors.NotFound({ resource: 'Post', id }));
      }

      return post;
    }),

  create: (data: any) =>
    Effect.gen(function* () {
      const db = yield* DbService;
      const id = createId();

      const existing = yield* Effect.tryPromise({
        try: () =>
          db
            .selectFrom('posts')
            .select('id')
            .where('slug', '=', data.slug)
            .where('locale', '=', data.locale ?? 'en')
            .executeTakeFirst(),
        catch: (e) => new Errors.DatabaseError({ message: 'Failed to check slug', cause: e }),
      });

      if (existing) {
        return yield* Effect.fail(new Errors.SlugConflict({ slug: data.slug, locale: data.locale }));
      }

      const post = yield* Effect.tryPromise({
        try: () =>
          db
            .insertInto('posts')
            .values({ id, ...data, created_at: new Date(), updated_at: new Date() })
            .returningAll()
            .executeTakeFirstOrThrow(),
        catch: (e) => new Errors.DatabaseError({ message: 'Failed to create post', cause: e }),
      });

      return post;
    }),

  update: (id, data: any) =>
    Effect.gen(function* () {
      const db = yield* DbService;

      const post = yield* Effect.tryPromise({
        try: () =>
          db
            .updateTable('posts')
            .set({ ...data, updated_at: new Date() })
            .where('id', '=', id)
            .returningAll()
            .executeTakeFirst(),
        catch: (e) => new Errors.DatabaseError({ message: 'Failed to update post', cause: e }),
      });

      if (!post) {
        return yield* Effect.fail(new Errors.NotFound({ resource: 'Post', id }));
      }

      return post;
    }),

  delete: (id) =>
    Effect.gen(function* () {
      const db = yield* DbService;

      const result = yield* Effect.tryPromise({
        try: () => db.deleteFrom('posts').where('id', '=', id).executeTakeFirst(),
        catch: (e) => new Errors.DatabaseError({ message: 'Failed to delete post', cause: e }),
      });

      if (result.numDeletedRows === 0n) {
        return yield* Effect.fail(new Errors.NotFound({ resource: 'Post', id }));
      }
    }),

  publish: (id) =>
    Effect.gen(function* () {
      const db = yield* DbService;

      const post = yield* Effect.tryPromise({
        try: () =>
          db
            .updateTable('posts')
            .set({ status: 'published', published_at: new Date(), updated_at: new Date() })
            .where('id', '=', id)
            .returningAll()
            .executeTakeFirst(),
        catch: (e) => new Errors.DatabaseError({ message: 'Failed to publish post', cause: e }),
      });

      if (!post) {
        return yield* Effect.fail(new Errors.NotFound({ resource: 'Post', id }));
      }

      return post;
    }),

  unpublish: (id) =>
    Effect.gen(function* () {
      const db = yield* DbService;

      const post = yield* Effect.tryPromise({
        try: () =>
          db
            .updateTable('posts')
            .set({ status: 'draft', published_at: null, updated_at: new Date() })
            .where('id', '=', id)
            .returningAll()
            .executeTakeFirst(),
        catch: (e) => new Errors.DatabaseError({ message: 'Failed to unpublish post', cause: e }),
      });

      if (!post) {
        return yield* Effect.fail(new Errors.NotFound({ resource: 'Post', id }));
      }

      return post;
    }),
});

// ============================================================================
// Category Service (same pattern as PostService)
// ============================================================================

export class CategoryService extends Context.Tag('CategoryService')<
  CategoryService,
  {
    findMany: () => Effect.Effect<unknown[], Errors.DatabaseError, DbService>;
    findBySlug: (slug: string) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
    findById: (id: string) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
    create: (data: unknown) => Effect.Effect<unknown, Errors.SlugConflict | Errors.DatabaseError, DbService>;
    update: (id: string, data: unknown) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
    delete: (id: string) => Effect.Effect<void, Errors.NotFound | Errors.DatabaseError, DbService>;
  }
>() {}

// CategoryServiceLive implementation follows same pattern...

// ============================================================================
// Gallery Service (same pattern)
// ============================================================================

export class GalleryService extends Context.Tag('GalleryService')<
  GalleryService,
  {
    findMany: () => Effect.Effect<unknown[], Errors.DatabaseError, DbService>;
    findBySlug: (slug: string) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
    findById: (id: string) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
    create: (data: unknown) => Effect.Effect<unknown, Errors.SlugConflict | Errors.DatabaseError, DbService>;
    update: (id: string, data: unknown) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
    delete: (id: string) => Effect.Effect<void, Errors.NotFound | Errors.DatabaseError, DbService>;
    publish: (id: string) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
    unpublish: (id: string) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
  }
>() {}

// GalleryServiceLive implementation follows same pattern...

// ============================================================================
// Home Service
// ============================================================================

export class HomeService extends Context.Tag('HomeService')<
  HomeService,
  {
    get: () => Effect.Effect<unknown, Errors.DatabaseError, DbService>;
    update: (data: unknown) => Effect.Effect<unknown, Errors.DatabaseError, DbService>;
  }
>() {}

// HomeServiceLive implementation...

// ============================================================================
// Media Service
// ============================================================================

export class MediaService extends Context.Tag('MediaService')<
  MediaService,
  {
    findMany: () => Effect.Effect<unknown[], Errors.DatabaseError, DbService>;
    findById: (id: string) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
    upload: (
      file: Buffer,
      filename: string,
      mimeType: string
    ) => Effect.Effect<
      unknown,
      Errors.ImageProcessingError | Errors.StorageError | Errors.DatabaseError,
      DbService | ImageService | StorageService
    >;
    delete: (id: string) => Effect.Effect<void, Errors.NotFound | Errors.StorageError | Errors.DatabaseError, DbService | StorageService>;
    updateAlt: (id: string, alt: string) => Effect.Effect<unknown, Errors.NotFound | Errors.DatabaseError, DbService>;
  }
>() {}

// MediaServiceLive implementation...
```

### server.ts

```typescript
import { Effect, Layer, pipe } from 'effect';
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpMiddleware,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform';
import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import { Schema as S } from '@effect/schema';
import * as Schemas from './schemas';
import * as Services from './services';
import * as Errors from './errors';
import type { Config } from './types';

// ============================================================================
// Configuration
// ============================================================================

const config: Config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL!,
  sessionSecret: process.env.SESSION_SECRET!,
  r2: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_ACCESS_SECRET!,
    endpoint: process.env.R2_ENDPOINT!,
    bucket: process.env.R2_BUCKET!,
    publicUrl: process.env.R2_PUBLIC_URL!,
  },
};

// ============================================================================
// API Definition
// ============================================================================

// Public API (consumed by blog, requires API key)
const PublicApi = HttpApiGroup.make('public').pipe(
  HttpApiGroup.add(
    HttpApiEndpoint.get('getPosts', '/posts').pipe(
      HttpApiEndpoint.setUrlParams(Schemas.PostsQuery),
      HttpApiEndpoint.setSuccess(Schemas.Paginated(Schemas.PostWithCategory))
    )
  ),
  HttpApiGroup.add(
    HttpApiEndpoint.get('getPost', '/posts/:slug').pipe(
      HttpApiEndpoint.setPath(S.Struct({ slug: S.String })),
      HttpApiEndpoint.setUrlParams(S.Struct({ locale: S.optional(Schemas.Locale) })),
      HttpApiEndpoint.setSuccess(Schemas.PostWithMedia),
      HttpApiEndpoint.addError(Errors.NotFound)
    )
  ),
  HttpApiGroup.add(
    HttpApiEndpoint.get('getCategories', '/categories').pipe(
      HttpApiEndpoint.setSuccess(S.Array(Schemas.Category))
    )
  ),
  HttpApiGroup.add(
    HttpApiEndpoint.get('getCategory', '/categories/:slug').pipe(
      HttpApiEndpoint.setPath(S.Struct({ slug: S.String })),
      HttpApiEndpoint.setSuccess(Schemas.Category),
      HttpApiEndpoint.addError(Errors.NotFound)
    )
  ),
  HttpApiGroup.add(
    HttpApiEndpoint.get('getGalleries', '/galleries').pipe(
      HttpApiEndpoint.setSuccess(S.Array(Schemas.Gallery))
    )
  ),
  HttpApiGroup.add(
    HttpApiEndpoint.get('getGallery', '/galleries/:slug').pipe(
      HttpApiEndpoint.setPath(S.Struct({ slug: S.String })),
      HttpApiEndpoint.setSuccess(Schemas.GalleryWithCategory),
      HttpApiEndpoint.addError(Errors.NotFound)
    )
  ),
  HttpApiGroup.add(
    HttpApiEndpoint.get('getHome', '/home').pipe(HttpApiEndpoint.setSuccess(Schemas.Home))
  ),
  HttpApiGroup.prefix('/api')
);

// Admin API (session-based auth)
const AdminApi = HttpApiGroup.make('admin').pipe(
  // Auth endpoints
  HttpApiGroup.add(
    HttpApiEndpoint.post('login', '/login').pipe(
      HttpApiEndpoint.setPayload(Schemas.LoginRequest),
      HttpApiEndpoint.setSuccess(S.Struct({ user: Schemas.User })),
      HttpApiEndpoint.addError(Errors.InvalidCredentials)
    )
  ),
  HttpApiGroup.add(HttpApiEndpoint.post('logout', '/logout')),
  HttpApiGroup.add(
    HttpApiEndpoint.get('me', '/me').pipe(
      HttpApiEndpoint.setSuccess(Schemas.User),
      HttpApiEndpoint.addError(Errors.Unauthorized)
    )
  ),

  // Posts CRUD
  HttpApiGroup.add(
    HttpApiEndpoint.get('listPosts', '/posts').pipe(
      HttpApiEndpoint.setUrlParams(Schemas.PostsQuery),
      HttpApiEndpoint.setSuccess(Schemas.Paginated(Schemas.Post))
    )
  ),
  HttpApiGroup.add(
    HttpApiEndpoint.post('createPost', '/posts').pipe(
      HttpApiEndpoint.setPayload(Schemas.CreatePost),
      HttpApiEndpoint.setSuccess(Schemas.Post),
      HttpApiEndpoint.addError(Errors.SlugConflict)
    )
  ),
  HttpApiGroup.add(
    HttpApiEndpoint.get('getPostById', '/posts/:id').pipe(
      HttpApiEndpoint.setPath(S.Struct({ id: S.String })),
      HttpApiEndpoint.setSuccess(Schemas.Post),
      HttpApiEndpoint.addError(Errors.NotFound)
    )
  ),
  HttpApiGroup.add(
    HttpApiEndpoint.put('updatePost', '/posts/:id').pipe(
      HttpApiEndpoint.setPath(S.Struct({ id: S.String })),
      HttpApiEndpoint.setPayload(Schemas.UpdatePost),
      HttpApiEndpoint.setSuccess(Schemas.Post),
      HttpApiEndpoint.addError(Errors.NotFound)
    )
  ),
  HttpApiGroup.add(
    HttpApiEndpoint.del('deletePost', '/posts/:id').pipe(
      HttpApiEndpoint.setPath(S.Struct({ id: S.String })),
      HttpApiEndpoint.addError(Errors.NotFound)
    )
  ),
  HttpApiGroup.add(
    HttpApiEndpoint.post('publishPost', '/posts/:id/publish').pipe(
      HttpApiEndpoint.setPath(S.Struct({ id: S.String })),
      HttpApiEndpoint.setSuccess(Schemas.Post),
      HttpApiEndpoint.addError(Errors.NotFound)
    )
  ),
  HttpApiGroup.add(
    HttpApiEndpoint.post('unpublishPost', '/posts/:id/unpublish').pipe(
      HttpApiEndpoint.setPath(S.Struct({ id: S.String })),
      HttpApiEndpoint.setSuccess(Schemas.Post),
      HttpApiEndpoint.addError(Errors.NotFound)
    )
  ),

  // Categories CRUD (same pattern)
  // Galleries CRUD (same pattern)
  // Home update
  // Media endpoints
  // API Keys management

  HttpApiGroup.prefix('/admin/api')
);

const Api = HttpApi.make('cms').pipe(HttpApi.addGroup(PublicApi), HttpApi.addGroup(AdminApi));

// ============================================================================
// Handlers
// ============================================================================

const PublicApiLive = HttpApiBuilder.group(Api, 'public', (handlers) =>
  handlers.pipe(
    HttpApiBuilder.handle('getPosts', ({ urlParams }) =>
      pipe(
        Services.PostService,
        Effect.flatMap((svc) =>
          svc.findMany({
            limit: urlParams.limit,
            offset: urlParams.offset,
            locale: urlParams.locale,
            category: urlParams.category,
            status: 'published',
          })
        ),
        Effect.map(({ data, total }) => ({
          data,
          meta: { total, limit: urlParams.limit, offset: urlParams.offset },
        }))
      )
    ),
    HttpApiBuilder.handle('getPost', ({ path, urlParams }) =>
      pipe(
        Services.PostService,
        Effect.flatMap((svc) => svc.findBySlug(path.slug, urlParams.locale ?? 'en'))
      )
    ),
    HttpApiBuilder.handle('getCategories', () =>
      pipe(
        Services.CategoryService,
        Effect.flatMap((svc) => svc.findMany())
      )
    ),
    HttpApiBuilder.handle('getCategory', ({ path }) =>
      pipe(
        Services.CategoryService,
        Effect.flatMap((svc) => svc.findBySlug(path.slug))
      )
    ),
    HttpApiBuilder.handle('getGalleries', () =>
      pipe(
        Services.GalleryService,
        Effect.flatMap((svc) => svc.findMany())
      )
    ),
    HttpApiBuilder.handle('getGallery', ({ path }) =>
      pipe(
        Services.GalleryService,
        Effect.flatMap((svc) => svc.findBySlug(path.slug))
      )
    ),
    HttpApiBuilder.handle('getHome', () =>
      pipe(
        Services.HomeService,
        Effect.flatMap((svc) => svc.get())
      )
    )
  )
);

const AdminApiLive = HttpApiBuilder.group(Api, 'admin', (handlers) =>
  handlers.pipe(
    HttpApiBuilder.handle('login', ({ payload }) =>
      Effect.gen(function* () {
        const db = yield* Services.DbService;
        const auth = yield* Services.AuthService;

        const user = yield* Effect.tryPromise({
          try: () => db.selectFrom('users').selectAll().where('email', '=', payload.email).executeTakeFirst(),
          catch: (e) => new Errors.DatabaseError({ message: 'Failed to query user', cause: e }),
        });

        if (!user) {
          return yield* Effect.fail(new Errors.InvalidCredentials({ message: 'Invalid credentials' }));
        }

        const valid = yield* auth.verifyPassword(user.password_hash, payload.password);
        if (!valid) {
          return yield* Effect.fail(new Errors.InvalidCredentials({ message: 'Invalid credentials' }));
        }

        const sessionId = yield* auth.createSession(user.id);

        // TODO: Set session cookie in response
        return {
          user: { id: user.id, email: user.email, name: user.name, created_at: user.created_at },
        };
      })
    ),
    HttpApiBuilder.handle('logout', () =>
      Effect.gen(function* () {
        // TODO: Get session from cookie, destroy it
        return {};
      })
    ),
    HttpApiBuilder.handle('me', () =>
      Effect.gen(function* () {
        // TODO: Get session from cookie, return user
        return yield* Effect.fail(new Errors.Unauthorized({ message: 'Not authenticated' }));
      })
    ),
    HttpApiBuilder.handle('listPosts', ({ urlParams }) =>
      pipe(
        Services.PostService,
        Effect.flatMap((svc) =>
          svc.findMany({
            limit: urlParams.limit,
            offset: urlParams.offset,
            locale: urlParams.locale,
            category: urlParams.category,
            status: urlParams.status,
          })
        ),
        Effect.map(({ data, total }) => ({
          data,
          meta: { total, limit: urlParams.limit, offset: urlParams.offset },
        }))
      )
    ),
    HttpApiBuilder.handle('createPost', ({ payload }) =>
      pipe(
        Services.PostService,
        Effect.flatMap((svc) => svc.create(payload))
      )
    ),
    HttpApiBuilder.handle('getPostById', ({ path }) =>
      pipe(
        Services.PostService,
        Effect.flatMap((svc) => svc.findById(path.id))
      )
    ),
    HttpApiBuilder.handle('updatePost', ({ path, payload }) =>
      pipe(
        Services.PostService,
        Effect.flatMap((svc) => svc.update(path.id, payload))
      )
    ),
    HttpApiBuilder.handle('deletePost', ({ path }) =>
      pipe(
        Services.PostService,
        Effect.flatMap((svc) => svc.delete(path.id))
      )
    ),
    HttpApiBuilder.handle('publishPost', ({ path }) =>
      pipe(
        Services.PostService,
        Effect.flatMap((svc) => svc.publish(path.id))
      )
    ),
    HttpApiBuilder.handle('unpublishPost', ({ path }) =>
      pipe(
        Services.PostService,
        Effect.flatMap((svc) => svc.unpublish(path.id))
      )
    )
    // ... other handlers
  )
);

// ============================================================================
// Middleware
// ============================================================================

const apiKeyMiddleware = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      return yield* Effect.fail(new Errors.InvalidApiKey({ message: 'Missing API key' }));
    }

    const auth = yield* Services.AuthService;
    yield* auth.validateApiKey(apiKey);

    return yield* app;
  })
);

// ============================================================================
// Static File Serving (Admin SPA)
// ============================================================================

const serveStatic = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    
    if (request.url.startsWith('/admin') && !request.url.startsWith('/admin/api')) {
      // Serve index.html for SPA routes
      const file = Bun.file('./public/index.html');
      if (await file.exists()) {
        return HttpServerResponse.html(await file.text());
      }
    }
    
    return yield* app;
  })
);

// ============================================================================
// Main
// ============================================================================

const MainLive = pipe(
  HttpApiBuilder.serve(HttpMiddleware.logger),
  Layer.provide(PublicApiLive),
  Layer.provide(AdminApiLive),
  Layer.provide(Services.PostServiceLive),
  Layer.provide(Services.CategoryServiceLive),
  Layer.provide(Services.GalleryServiceLive),
  Layer.provide(Services.HomeServiceLive),
  Layer.provide(Services.MediaServiceLive),
  Layer.provide(Services.AuthServiceLive),
  Layer.provide(Services.ImageServiceLive),
  Layer.provide(Services.makeStorageService(config.r2)),
  Layer.provide(Services.makeDbService(config.databaseUrl)),
  Layer.provide(BunHttpServer.layer({ port: config.port }))
);

BunRuntime.runMain(Layer.launch(MainLive));

console.log(`🚀 CMS running at http://localhost:${config.port}`);
console.log(`📝 Admin panel: http://localhost:${config.port}/admin`);
console.log(`🔌 API: http://localhost:${config.port}/api`);
```

### index.tsx

```tsx
/* @refresh reload */
import { render } from 'solid-js/web';
import { Router, Route, A, useParams, useNavigate } from '@solidjs/router';
import { createSignal, createResource, createEffect, Show, For, onMount } from 'solid-js';
import { createTiptapEditor } from 'solid-tiptap';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

// ============================================================================
// API Client
// ============================================================================

const api = {
  get: <T,>(path: string): Promise<T> =>
    fetch(`/admin/api${path}`, { credentials: 'include' }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    }),

  post: <T,>(path: string, body?: unknown): Promise<T> =>
    fetch(`/admin/api${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    }),

  put: <T,>(path: string, body: unknown): Promise<T> =>
    fetch(`/admin/api${path}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    }),

  del: (path: string): Promise<void> =>
    fetch(`/admin/api${path}`, { method: 'DELETE', credentials: 'include' }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
    }),

  upload: (file: File): Promise<{ id: string; urls: any }> => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch('/admin/api/media', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then((r) => r.json());
  },
};

// ============================================================================
// Auth Store
// ============================================================================

const [user, setUser] = createSignal<{ id: string; email: string; name: string | null } | null>(null);
const [authLoading, setAuthLoading] = createSignal(true);

// ============================================================================
// Components
// ============================================================================

function Layout(props: { children: any }) {
  const navigate = useNavigate();

  const logout = async () => {
    await api.post('/logout');
    setUser(null);
    navigate('/admin/login');
  };

  return (
    <div class="flex h-screen bg-gray-100">
      <nav class="w-64 bg-gray-900 text-white flex flex-col">
        <div class="p-4 border-b border-gray-700">
          <h1 class="text-xl font-bold">ivokun CMS</h1>
        </div>
        <ul class="flex-1 p-4 space-y-2">
          <li>
            <A href="/admin/posts" class="block px-3 py-2 rounded hover:bg-gray-800">
              Posts
            </A>
          </li>
          <li>
            <A href="/admin/categories" class="block px-3 py-2 rounded hover:bg-gray-800">
              Categories
            </A>
          </li>
          <li>
            <A href="/admin/galleries" class="block px-3 py-2 rounded hover:bg-gray-800">
              Galleries
            </A>
          </li>
          <li>
            <A href="/admin/home" class="block px-3 py-2 rounded hover:bg-gray-800">
              Home
            </A>
          </li>
          <li>
            <A href="/admin/media" class="block px-3 py-2 rounded hover:bg-gray-800">
              Media
            </A>
          </li>
          <li>
            <A href="/admin/settings" class="block px-3 py-2 rounded hover:bg-gray-800">
              Settings
            </A>
          </li>
        </ul>
        <div class="p-4 border-t border-gray-700">
          <p class="text-sm text-gray-400 mb-2">{user()?.email}</p>
          <button onClick={logout} class="text-sm text-red-400 hover:text-red-300">
            Logout
          </button>
        </div>
      </nav>
      <main class="flex-1 p-8 overflow-auto">{props.children}</main>
    </div>
  );
}

function Editor(props: { content: any; onChange: (json: any) => void; onImageUpload?: () => void }) {
  let ref: HTMLDivElement;

  const editor = createTiptapEditor(() => ({
    element: ref!,
    extensions: [
      StarterKit,
      Image.configure({ inline: true, allowBase64: false }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
    ],
    content: props.content || { type: 'doc', content: [] },
    onUpdate: ({ editor }) => props.onChange(editor.getJSON()),
  }));

  const insertImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const result = await api.upload(file);
        editor()?.chain().focus().setImage({ src: result.urls.large }).run();
      }
    };
    input.click();
  };

  return (
    <div class="border rounded-lg overflow-hidden">
      <div class="flex gap-1 p-2 bg-gray-50 border-b">
        <button
          type="button"
          onClick={() => editor()?.chain().focus().toggleBold().run()}
          class="px-2 py-1 rounded hover:bg-gray-200 font-bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor()?.chain().focus().toggleItalic().run()}
          class="px-2 py-1 rounded hover:bg-gray-200 italic"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor()?.chain().focus().toggleHeading({ level: 2 }).run()}
          class="px-2 py-1 rounded hover:bg-gray-200"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor()?.chain().focus().toggleHeading({ level: 3 }).run()}
          class="px-2 py-1 rounded hover:bg-gray-200"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => editor()?.chain().focus().toggleBulletList().run()}
          class="px-2 py-1 rounded hover:bg-gray-200"
        >
          •
        </button>
        <button
          type="button"
          onClick={() => editor()?.chain().focus().toggleOrderedList().run()}
          class="px-2 py-1 rounded hover:bg-gray-200"
        >
          1.
        </button>
        <button
          type="button"
          onClick={() => editor()?.chain().focus().toggleBlockquote().run()}
          class="px-2 py-1 rounded hover:bg-gray-200"
        >
          "
        </button>
        <button
          type="button"
          onClick={() => editor()?.chain().focus().toggleCodeBlock().run()}
          class="px-2 py-1 rounded hover:bg-gray-200 font-mono"
        >
          {'</>'}
        </button>
        <button type="button" onClick={insertImage} class="px-2 py-1 rounded hover:bg-gray-200">
          🖼
        </button>
      </div>
      <div ref={ref!} class="prose max-w-none min-h-[400px] p-4" />
    </div>
  );
}

// ============================================================================
// Pages
// ============================================================================

function Login() {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const navigate = useNavigate();

  const submit = async (e: Event) => {
    e.preventDefault();
    setError('');
    try {
      const { user: u } = await api.post<{ user: any }>('/login', {
        email: email(),
        password: password(),
      });
      setUser(u);
      navigate('/admin/posts');
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div class="flex items-center justify-center h-screen bg-gray-100">
      <form onSubmit={submit} class="w-96 p-8 bg-white rounded-lg shadow">
        <h1 class="text-2xl font-bold mb-6">Login to CMS</h1>
        <Show when={error()}>
          <p class="text-red-500 mb-4">{error()}</p>
        </Show>
        <input
          type="email"
          value={email()}
          onInput={(e) => setEmail(e.target.value)}
          placeholder="Email"
          class="w-full p-3 border rounded mb-4"
          required
        />
        <input
          type="password"
          value={password()}
          onInput={(e) => setPassword(e.target.value)}
          placeholder="Password"
          class="w-full p-3 border rounded mb-6"
          required
        />
        <button type="submit" class="w-full p-3 bg-blue-600 text-white rounded hover:bg-blue-700">
          Login
        </button>
      </form>
    </div>
  );
}

function PostList() {
  const [posts] = createResource(() => api.get<{ data: any[]; meta: any }>('/posts'));

  return (
    <Layout>
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Posts</h1>
        <A href="/admin/posts/new" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          New Post
        </A>
      </div>
      <Show when={posts()} fallback={<p>Loading...</p>}>
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left">Title</th>
                <th class="px-4 py-3 text-left">Slug</th>
                <th class="px-4 py-3 text-left">Status</th>
                <th class="px-4 py-3 text-left">Locale</th>
                <th class="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              <For each={posts()!.data}>
                {(post) => (
                  <tr class="border-t">
                    <td class="px-4 py-3">{post.title}</td>
                    <td class="px-4 py-3 text-gray-500">{post.slug}</td>
                    <td class="px-4 py-3">
                      <span
                        class={`px-2 py-1 rounded text-xs ${
                          post.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td class="px-4 py-3">{post.locale}</td>
                    <td class="px-4 py-3">
                      <A href={`/admin/posts/${post.id}`} class="text-blue-600 hover:underline">
                        Edit
                      </A>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </Layout>
  );
}

function PostEdit() {
  const params = useParams();
  const navigate = useNavigate();
  const isNew = params.id === 'new';

  const [post, { mutate }] = createResource(
    () => (isNew ? null : params.id),
    (id) => api.get(`/posts/${id}`)
  );

  const [form, setForm] = createSignal<any>(
    isNew ? { title: '', slug: '', excerpt: '', locale: 'en', status: 'draft', content: null } : null
  );

  const [categories] = createResource(() => api.get<any[]>('/categories'));

  createEffect(() => {
    if (post()) setForm(post());
  });

  const updateField = (field: string, value: any) => {
    setForm((f: any) => ({ ...f, [field]: value }));
  };

  const generateSlug = () => {
    const title = form()?.title || '';
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    updateField('slug', slug);
  };

  const save = async () => {
    const data = form();
    if (isNew) {
      const newPost = await api.post('/posts', data);
      navigate(`/admin/posts/${newPost.id}`);
    } else {
      await api.put(`/posts/${params.id}`, data);
    }
  };

  const publish = async () => {
    await api.post(`/posts/${params.id}/publish`);
    mutate((p: any) => ({ ...p, status: 'published' }));
  };

  const unpublish = async () => {
    await api.post(`/posts/${params.id}/unpublish`);
    mutate((p: any) => ({ ...p, status: 'draft' }));
  };

  const deletePost = async () => {
    if (confirm('Are you sure?')) {
      await api.del(`/posts/${params.id}`);
      navigate('/admin/posts');
    }
  };

  return (
    <Layout>
      <Show when={form()} fallback={<p>Loading...</p>}>
        {(f) => (
          <div>
            <div class="flex justify-between items-center mb-6">
              <h1 class="text-2xl font-bold">{isNew ? 'New Post' : 'Edit Post'}</h1>
              <div class="flex gap-2">
                <Show when={!isNew}>
                  <Show when={f().status === 'draft'}>
                    <button onClick={publish} class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                      Publish
                    </button>
                  </Show>
                  <Show when={f().status === 'published'}>
                    <button onClick={unpublish} class="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
                      Unpublish
                    </button>
                  </Show>
                  <button onClick={deletePost} class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                    Delete
                  </button>
                </Show>
                <button onClick={save} class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Save
                </button>
              </div>
            </div>

            <div class="bg-white rounded-lg shadow p-6 space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">Title</label>
                <input
                  value={f().title}
                  onInput={(e) => updateField('title', e.target.value)}
                  onBlur={() => isNew && !f().slug && generateSlug()}
                  class="w-full p-2 border rounded"
                />
              </div>

              <div class="flex gap-4">
                <div class="flex-1">
                  <label class="block text-sm font-medium mb-1">Slug</label>
                  <input
                    value={f().slug}
                    onInput={(e) => updateField('slug', e.target.value)}
                    class="w-full p-2 border rounded"
                  />
                </div>
                <div class="w-32">
                  <label class="block text-sm font-medium mb-1">Locale</label>
                  <select
                    value={f().locale}
                    onChange={(e) => updateField('locale', e.target.value)}
                    class="w-full p-2 border rounded"
                  >
                    <option value="en">English</option>
                    <option value="id">Indonesian</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium mb-1">Excerpt</label>
                <textarea
                  value={f().excerpt || ''}
                  onInput={(e) => updateField('excerpt', e.target.value)}
                  rows={2}
                  class="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label class="block text-sm font-medium mb-1">Category</label>
                <select
                  value={f().category_id || ''}
                  onChange={(e) => updateField('category_id', e.target.value || null)}
                  class="w-full p-2 border rounded"
                >
                  <option value="">No category</option>
                  <For each={categories() || []}>
                    {(cat) => <option value={cat.id}>{cat.name}</option>}
                  </For>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium mb-1">Content</label>
                <Editor content={f().content} onChange={(c) => updateField('content', c)} />
              </div>
            </div>
          </div>
        )}
      </Show>
    </Layout>
  );
}

// Similar pages for Categories, Galleries, Home, Media, Settings...

// ============================================================================
// App
// ============================================================================

function App() {
  onMount(async () => {
    try {
      const u = await api.get<any>('/me');
      setUser(u);
    } catch {
      // Not authenticated
    }
    setAuthLoading(false);
  });

  return (
    <Show when={!authLoading()} fallback={<div class="flex items-center justify-center h-screen">Loading...</div>}>
      <Router>
        <Route path="/admin/login" component={Login} />
        <Route path="/admin/posts" component={PostList} />
        <Route path="/admin/posts/:id" component={PostEdit} />
        {/* Other routes */}
        <Route path="/admin" component={() => <Navigate href="/admin/posts" />} />
        <Route path="*" component={() => <Navigate href="/admin/posts" />} />
      </Router>
    </Show>
  );
}

// Redirect helper
function Navigate(props: { href: string }) {
  const navigate = useNavigate();
  onMount(() => navigate(props.href));
  return null;
}

render(() => <App />, document.getElementById('root')!);
```

---

## API Endpoints

### Public API (Blog Consumption)

Base path: `/api`

Authentication: `X-Api-Key` header

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/posts` | List published posts | `limit`, `offset`, `locale`, `category` |
| GET | `/posts/:slug` | Get post by slug | `locale` |
| GET | `/categories` | List all categories | - |
| GET | `/categories/:slug` | Get category | - |
| GET | `/galleries` | List published galleries | - |
| GET | `/galleries/:slug` | Get gallery | - |
| GET | `/home` | Get homepage content | - |

### Admin API

Base path: `/admin/api`

Authentication: Session cookie

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | Authenticate |
| POST | `/logout` | End session |
| GET | `/me` | Current user |
| GET | `/posts` | List all posts (inc. drafts) |
| POST | `/posts` | Create post |
| GET | `/posts/:id` | Get post by ID |
| PUT | `/posts/:id` | Update post |
| DELETE | `/posts/:id` | Delete post |
| POST | `/posts/:id/publish` | Publish post |
| POST | `/posts/:id/unpublish` | Unpublish post |
| GET | `/categories` | List categories |
| POST | `/categories` | Create category |
| GET | `/categories/:id` | Get category |
| PUT | `/categories/:id` | Update category |
| DELETE | `/categories/:id` | Delete category |
| GET | `/galleries` | List galleries |
| POST | `/galleries` | Create gallery |
| GET | `/galleries/:id` | Get gallery |
| PUT | `/galleries/:id` | Update gallery |
| DELETE | `/galleries/:id` | Delete gallery |
| POST | `/galleries/:id/publish` | Publish gallery |
| POST | `/galleries/:id/unpublish` | Unpublish gallery |
| GET | `/home` | Get home content |
| PUT | `/home` | Update home content |
| GET | `/media` | List media |
| POST | `/media` | Upload media (multipart) |
| DELETE | `/media/:id` | Delete media |
| PUT | `/media/:id` | Update alt text |
| GET | `/api-keys` | List API keys |
| POST | `/api-keys` | Create API key |
| DELETE | `/api-keys/:id` | Revoke API key |

---

## Image Processing Pipeline

### Variants

| Name | Width | Quality | Use Case |
|------|-------|---------|----------|
| `original` | Unchanged | 90% | Full-size view |
| `thumbnail` | 200px | 80% | Admin lists, thumbnails |
| `small` | 800px | 85% | Mobile devices |
| `large` | 1920px | 85% | Desktop, featured images |

### Process Flow

```
Upload (PNG/JPG/WebP)
        │
        ▼
   sharp.metadata()
        │
        ▼
┌───────┴───────┐
│ For each size │
│   1. Resize   │
│   2. WebP     │
│   3. Upload   │
└───────┬───────┘
        │
        ▼
  Save to DB with URLs
```

### Storage Structure

```
R2 Bucket: ivokun-prod
├── {cuid2}/
│   ├── filename.webp           (original)
│   ├── filename_thumbnail.webp (200px)
│   ├── filename_small.webp     (800px)
│   └── filename_large.webp     (1920px)
```

---

## Admin SPA

### Tech Stack

- **Framework**: SolidJS 1.8+
- **Router**: @solidjs/router
- **Editor**: TipTap 2.x with solid-tiptap
- **Styling**: Tailwind CSS
- **Build**: Vite

### TipTap Extensions

```typescript
const extensions = [
  StarterKit,                    // Basic formatting
  Image.configure({              // Inline images
    inline: true,
    allowBase64: false,
  }),
  Link.configure({               // Links
    openOnClick: false,
  }),
  Placeholder.configure({        // Placeholder text
    placeholder: 'Start writing...',
  }),
];
```

### Build Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/admin/api': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
    },
  },
});
```

---

## Authentication

### Admin Authentication (Session-based)

```
┌─────────┐      POST /admin/api/login      ┌─────────┐
│  Admin  │ ──────────────────────────────▶ │ Server  │
│   SPA   │   { email, password }           │         │
│         │ ◀────────────────────────────── │         │
└─────────┘   Set-Cookie: session=xxx       └─────────┘
                 HttpOnly, Secure
```

- Password hashing: Argon2
- Session duration: 7 days
- Cookie: `session`, HttpOnly, Secure, SameSite=Lax

### Public API Authentication (API Key)

```
┌─────────┐      GET /api/posts             ┌─────────┐
│  Blog   │ ──────────────────────────────▶ │ Server  │
│  Build  │   X-Api-Key: cms_xxxxx          │         │
│         │ ◀────────────────────────────── │         │
└─────────┘   { data: [...] }               └─────────┘
```

- Key format: `cms_{cuid2}{cuid2}` (~48 chars)
- Stored: Argon2 hash + 8-char prefix for lookup
- Usage tracking: `last_used_at` updated on each request

---

## NixOS Deployment

### Flake

```nix
# flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }: let
    systems = [ "x86_64-linux" "aarch64-linux" ];
    forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f system);
  in {
    packages = forAllSystems (system: let
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      default = pkgs.stdenv.mkDerivation {
        pname = "ivokun-cms";
        version = "1.0.0";
        src = ./.;

        nativeBuildInputs = with pkgs; [ bun nodejs_22 ];

        buildPhase = ''
          export HOME=$TMPDIR
          bun install --frozen-lockfile
          
          # Build admin SPA
          cd admin && bun run build && cd ..
          
          # Compile server to binary
          bun build --compile --minify ./src/server.ts --outfile cms
        '';

        installPhase = ''
          mkdir -p $out/bin $out/share/ivokun-cms
          cp cms $out/bin/
          cp -r public $out/share/ivokun-cms/
        '';
      };
    });

    nixosModules.default = import ./module.nix;
  };
}
```

### NixOS Module

```nix
# module.nix
{ config, lib, pkgs, ... }:

let
  cfg = config.services.ivokun-cms;
in {
  options.services.ivokun-cms = {
    enable = lib.mkEnableOption "ivokun CMS";

    port = lib.mkOption {
      type = lib.types.port;
      default = 3000;
      description = "Port to listen on";
    };

    domain = lib.mkOption {
      type = lib.types.str;
      example = "cms.ivokun.com";
      description = "Domain for the CMS";
    };

    environmentFile = lib.mkOption {
      type = lib.types.path;
      description = "File containing environment variables";
    };

    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.ivokun-cms;
      description = "Package to use";
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.ivokun-cms = {
      description = "ivokun CMS";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" "postgresql.service" ];

      serviceConfig = {
        Type = "simple";
        ExecStart = "${cfg.package}/bin/cms";
        WorkingDirectory = "${cfg.package}/share/ivokun-cms";
        EnvironmentFile = cfg.environmentFile;
        Environment = [ "PORT=${toString cfg.port}" ];
        
        # Security hardening
        DynamicUser = true;
        NoNewPrivileges = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        PrivateDevices = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectControlGroups = true;
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        MemoryDenyWriteExecute = true;
        LockPersonality = true;

        Restart = "always";
        RestartSec = 5;
      };
    };

    # Caddy reverse proxy
    services.caddy.virtualHosts.${cfg.domain} = {
      extraConfig = ''
        reverse_proxy localhost:${toString cfg.port}
      '';
    };
  };
}
```

### clan.lol Integration

```nix
# machines/web/configuration.nix
{ config, pkgs, ... }:
{
  imports = [
    inputs.ivokun-cms.nixosModules.default
  ];

  services.ivokun-cms = {
    enable = true;
    domain = "cms.ivokun.com";
    port = 3000;
    environmentFile = config.age.secrets.cms-env.path;
  };

  # PostgreSQL
  services.postgresql = {
    enable = true;
    ensureDatabases = [ "cms" ];
    ensureUsers = [{
      name = "cms";
      ensureDBOwnership = true;
    }];
  };

  # Secrets (managed by clan)
  age.secrets.cms-env.file = ../../secrets/cms-env.age;
}
```

---

## Migration from Strapi

### Migration Script

```typescript
// scripts/migrate-strapi.ts
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { createId } from '@paralleldrive/cuid2';
import sharp from 'sharp';
import type { Database } from '../src/types';

const STRAPI_URL = process.env.STRAPI_URL!;
const STRAPI_TOKEN = process.env.STRAPI_TOKEN!;
const NEW_DB_URL = process.env.DATABASE_URL!;
const R2_CONFIG = { /* ... */ };

async function fetchStrapi(endpoint: string) {
  const res = await fetch(`${STRAPI_URL}/api${endpoint}`, {
    headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
  });
  return res.json();
}

async function migrate() {
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString: NEW_DB_URL }) }),
  });

  console.log('Starting migration...');

  // 1. Migrate categories
  console.log('Migrating categories...');
  const { data: categories } = await fetchStrapi('/categories?populate=*');
  for (const cat of categories) {
    await db.insertInto('categories').values({
      id: cat.documentId,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
    }).execute();
  }
  console.log(`Migrated ${categories.length} categories`);

  // 2. Migrate media
  console.log('Migrating media...');
  const { data: uploads } = await fetchStrapi('/upload/files?pagination[limit]=1000');
  const mediaIdMap = new Map<number, string>();
  
  for (const file of uploads) {
    const newId = createId();
    mediaIdMap.set(file.id, newId);
    
    // Download and re-process
    const buffer = Buffer.from(await fetch(file.url).then(r => r.arrayBuffer()));
    const urls = await processAndUploadImage(buffer, file.name, newId);
    
    await db.insertInto('media').values({
      id: newId,
      filename: file.name,
      mime_type: file.mime,
      size: file.size,
      alt: file.alternativeText,
      urls,
      width: file.width,
      height: file.height,
    }).execute();
  }
  console.log(`Migrated ${uploads.length} media files`);

  // 3. Migrate posts
  console.log('Migrating posts...');
  const { data: posts } = await fetchStrapi('/posts?populate=*&locale=all&pagination[limit]=1000');
  
  for (const post of posts) {
    await db.insertInto('posts').values({
      id: post.documentId,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: convertStrapiBlocksToTipTap(post.richContent, mediaIdMap),
      featured_image: post.featuredPicture?.data?.id ? mediaIdMap.get(post.featuredPicture.data.id) : null,
      read_time_minute: post.readTimeMinute,
      category_id: post.category?.data?.documentId,
      locale: post.locale as 'en' | 'id',
      status: post.publishedAt ? 'published' : 'draft',
      published_at: post.publishedAt ? new Date(post.publishedAt) : null,
      created_at: new Date(post.createdAt),
      updated_at: new Date(post.updatedAt),
    }).execute();
  }
  console.log(`Migrated ${posts.length} posts`);

  // 4. Migrate galleries
  // ... similar pattern

  // 5. Migrate home
  // ... similar pattern

  console.log('Migration complete!');
  process.exit(0);
}

function convertStrapiBlocksToTipTap(blocks: any[], mediaIdMap: Map<number, string>): object {
  if (!blocks) return { type: 'doc', content: [] };

  return {
    type: 'doc',
    content: blocks.map(block => {
      switch (block.type) {
        case 'paragraph':
          return {
            type: 'paragraph',
            content: convertInlineContent(block.children),
          };
        case 'heading':
          return {
            type: 'heading',
            attrs: { level: block.level },
            content: convertInlineContent(block.children),
          };
        case 'image':
          const mediaId = mediaIdMap.get(block.image?.id);
          return {
            type: 'image',
            attrs: {
              src: block.image?.url,
              alt: block.image?.alternativeText,
              'data-media-id': mediaId,
            },
          };
        case 'list':
          return {
            type: block.format === 'ordered' ? 'orderedList' : 'bulletList',
            content: block.children.map((item: any) => ({
              type: 'listItem',
              content: [{ type: 'paragraph', content: convertInlineContent(item.children) }],
            })),
          };
        case 'quote':
          return {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: convertInlineContent(block.children) }],
          };
        case 'code':
          return {
            type: 'codeBlock',
            attrs: { language: block.language || null },
            content: [{ type: 'text', text: block.children?.[0]?.text || '' }],
          };
        default:
          return { type: 'paragraph', content: [] };
      }
    }),
  };
}

function convertInlineContent(children: any[]): any[] {
  if (!children) return [];
  
  return children.map(child => {
    if (child.type === 'text') {
      const marks: any[] = [];
      if (child.bold) marks.push({ type: 'bold' });
      if (child.italic) marks.push({ type: 'italic' });
      if (child.code) marks.push({ type: 'code' });
      if (child.strikethrough) marks.push({ type: 'strike' });
      
      return {
        type: 'text',
        text: child.text,
        ...(marks.length > 0 ? { marks } : {}),
      };
    }
    if (child.type === 'link') {
      return {
        type: 'text',
        text: child.children?.[0]?.text || '',
        marks: [{ type: 'link', attrs: { href: child.url } }],
      };
    }
    return { type: 'text', text: '' };
  });
}

migrate().catch(console.error);
```

### Running Migration

```bash
# Set environment variables
export STRAPI_URL=https://ivokun-api.fly.dev
export STRAPI_TOKEN=your-strapi-api-token
export DATABASE_URL=postgresql://...
export R2_ACCESS_KEY_ID=...
export R2_ACCESS_SECRET=...
export R2_ENDPOINT=...
export R2_BUCKET=ivokun-prod
export R2_PUBLIC_URL=https://static.ivokun.com

# Run migration
bun run scripts/migrate-strapi.ts
```

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/cms` |
| `SESSION_SECRET` | Secret for session signing (32+ chars) | `random-secret-string` |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key | `xxx` |
| `R2_ACCESS_SECRET` | Cloudflare R2 secret | `xxx` |
| `R2_ENDPOINT` | R2 S3-compatible endpoint | `https://xxx.r2.cloudflarestorage.com` |
| `R2_BUCKET` | R2 bucket name | `ivokun-prod` |
| `R2_PUBLIC_URL` | Public URL for media | `https://static.ivokun.com` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |

### Example .env

```bash
# Database
DATABASE_URL=postgresql://cms:password@localhost:5432/cms

# Server
PORT=3000
SESSION_SECRET=your-super-secret-session-key-at-least-32-chars

# Cloudflare R2
R2_ACCESS_KEY_ID=your-access-key-id
R2_ACCESS_SECRET=your-secret-access-key
R2_ENDPOINT=https://account-id.r2.cloudflarestorage.com
R2_BUCKET=ivokun-prod
R2_PUBLIC_URL=https://static.ivokun.com
```

---

## Development Workflow

### Setup

```bash
# Clone and install
git clone <repo>
cd cms
bun install

# Start PostgreSQL (if not using external)
docker run -d --name cms-db -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16

# Create database
createdb -h localhost -U postgres cms

# Run migrations
bun run migrate

# Start development
bun run dev
```

### Scripts

```json
{
  "scripts": {
    "dev": "bun --watch src/server.ts",
    "dev:admin": "cd admin && vite",
    "build": "bun run build:admin && bun build --compile --minify ./src/server.ts --outfile dist/cms",
    "build:admin": "cd admin && vite build",
    "migrate": "bun run scripts/run-migrations.ts",
    "migrate:strapi": "bun run scripts/migrate-strapi.ts",
    "seed": "bun run scripts/seed.ts"
  }
}
```

---

*Last updated: December 2024*
*Version: 1.0.0*
