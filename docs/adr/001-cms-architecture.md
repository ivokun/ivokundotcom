# ADR-001: Custom CMS Architecture

> **Status:** Accepted  
> **Date:** 2025-01-06  
> **Deciders:** ivokun  
> **Supersedes:** Strapi CMS deployment

## Context

The ivokun.com blog was using Strapi CMS deployed on AWS Lambda. While functional, several pain points emerged:

1. **Infrastructure Complexity** - Strapi requires Node.js runtime + PostgreSQL + S3 storage, making deployment non-declarative and NixOS-incompatible
2. **Resource Usage** - 300-500MB RAM at idle, 5-10 second cold starts
3. **Vendor Lock-in** - Content model changes between major versions, plugin compatibility issues
4. **Operational Overhead** - No single-binary deployment, database migrations tied to Strapi's lifecycle

The goal was to replace Strapi with a lightweight, custom-built CMS that:
- Compiles to a single binary (~50MB)
- Uses <256MB RAM at runtime
- Deploys declaratively via NixOS/clan.lol
- Provides full feature parity with current Strapi setup

## Decision

We built a custom headless CMS with the following architecture:

### Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Runtime** | Bun 1.1+ | Single binary compilation, fast startup, TypeScript native |
| **FP Framework** | Effect TS 3.x | Typed errors, service layers, composable effects |
| **Database** | Kysely + PostgreSQL | Type-safe SQL, no ORM magic, explicit queries |
| **Migrations** | dbmate | Simple SQL migrations, database-agnostic |
| **HTTP Server** | Hono | Lightweight, Effect-compatible, middleware support |
| **Admin SPA** | SolidJS 1.9+ | Small bundle (~15KB), fine-grained reactivity |
| **Rich Editor** | TipTap 2.x | ProseMirror-based, extensible, JSON output |
| **Image Processing** | Sharp 0.33+ | Fast WebP conversion, multiple size variants |
| **Password Hashing** | @node-rs/argon2 | OWASP-recommended, native Rust binding |
| **Storage** | Cloudflare R2 | S3-compatible, existing infrastructure |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   Single Binary (Bun)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Effect TS Runtime                      │  │
│  │                                                           │  │
│  │   ┌─────────────┐   ┌─────────────┐   ┌───────────────┐   │  │
│  │   │ Hono Server │   │  Services   │   │    Image      │   │  │
│  │   │  (routes)   │──▶│  (logic)    │──▶│   Pipeline    │   │  │
│  │   └─────────────┘   └─────────────┘   └───────────────┘   │  │
│  │                                                           │  │
│  │   ┌─────────────────────────────────────────────────────┐ │  │
│  │   │              Effect Layer System                    │ │  │
│  │   │  DbService | StorageService | AuthService | ...     │ │  │
│  │   └─────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌────────────┐      ┌─────────────┐      ┌────────────────┐    │
│  │ PostgreSQL │      │Cloudflare R2│      │  Static SPA    │    │
│  │  (Kysely)  │      │  (S3 API)   │      │   /admin       │    │
│  └────────────┘      └─────────────┘      └────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Service Layer Design

All business logic is encapsulated in Effect services using the `Context.Tag` pattern:

```typescript
// Service definition
export class PostService extends Context.Tag('PostService')<
  PostService,
  {
    readonly findMany: (params: QueryParams) => Effect.Effect<PaginatedResult, DatabaseError>
    readonly create: (data: CreatePostInput) => Effect.Effect<Post, SlugConflict | DatabaseError>
    // ...
  }
>() {}

// Layer composition
const MainLayer = Layer.mergeAll(
  DbServiceLive,
  StorageServiceLive,
  AuthServiceLive,
  PostServiceLive,
  // ...
)
```

### Error Handling Strategy

All errors are tagged union types using `Data.TaggedError`:

```typescript
export class NotFound extends Data.TaggedError('NotFound')<{
  readonly resource: string
  readonly id: string
}> {}

export class SlugConflict extends Data.TaggedError('SlugConflict')<{
  readonly slug: string
  readonly locale?: string
}> {}

// Mapped to HTTP status codes
export function toHttpStatus(error: AppError): number {
  switch (error._tag) {
    case 'NotFound': return 404
    case 'InvalidCredentials': return 401
    case 'SlugConflict': return 409
    // ...
  }
}
```

### API Design

Two API groups with different authentication:

| API | Base Path | Auth | Purpose |
|-----|-----------|------|---------|
| Public | `/api/*` | API Key (X-Api-Key header) | Blog consumption |
| Admin | `/admin/api/*` | Session cookie | Content management |

### Database Schema

8 tables with explicit foreign keys (no ORM relations):

- `users` - Admin accounts (Argon2 password hashing)
- `sessions` - 7-day expiring sessions
- `categories` - Content categorization
- `posts` - Blog posts with i18n (slug+locale unique)
- `galleries` - Photo galleries (images as JSON array)
- `media` - Uploaded files with 4 URL variants
- `home` - Singleton homepage content
- `api_keys` - Public API authentication

### Image Processing Pipeline

All uploads processed through Sharp:

| Variant | Width | Quality | Use Case |
|---------|-------|---------|----------|
| original | as-is | 90% | Full-size view |
| thumbnail | 200px | 80% | Admin lists |
| small | 800px | 85% | Mobile devices |
| large | 1920px | 85% | Desktop/featured |

All variants converted to WebP format.

### Admin SPA Architecture

SolidJS single-page application with:

- **Routing**: `@solidjs/router` with protected routes
- **State**: Simple signals for auth state
- **API Client**: Fetch-based with credentials
- **Editor**: TipTap with StarterKit + Image + Link extensions
- **Styling**: Tailwind CSS with custom primary color

## Consequences

### Positive

1. **Single Binary Deployment** - One file to deploy, no runtime dependencies
2. **Type Safety** - End-to-end TypeScript with Effect schemas
3. **Explicit Error Handling** - No thrown exceptions, all errors typed
4. **Low Resource Usage** - Target <256MB RAM (vs 300-500MB for Strapi)
5. **Fast Startup** - No cold start penalty
6. **NixOS Compatible** - Declarative deployment via clan.lol
7. **Full Control** - No vendor lock-in, own the entire stack

### Negative

1. **Maintenance Burden** - Must maintain custom codebase vs off-the-shelf CMS
2. **Feature Parity** - Some Strapi features may not be replicated (e.g., content versioning)
3. **Learning Curve** - Effect TS has steeper learning curve than traditional Node.js

### Neutral

1. **No GraphQL** - REST-only API (sufficient for static site generation)
2. **Single Admin** - No multi-user/role support in v1
3. **No Scheduled Publishing** - Manual publish only

## Alternatives Considered

### 1. Keep Strapi, Optimize Deployment

**Rejected because:**
- Still requires Node.js runtime
- Cannot achieve single-binary deployment
- NixOS deployment remains complex

### 2. Use Payload CMS

**Rejected because:**
- Similar architecture to Strapi (Node.js + Express)
- Still has vendor lock-in concerns
- No significant improvement in deployment simplicity

### 3. Use Ghost CMS

**Rejected because:**
- Designed for blogging with built-in frontend
- Overkill for headless API use case
- MySQL-focused, PostgreSQL support is secondary

### 4. Static File CMS (e.g., Decap/Netlify CMS)

**Rejected because:**
- Git-based workflow doesn't suit image-heavy content
- No rich image processing pipeline
- Limited querying capabilities

### 5. Use Go/Rust for Backend

**Rejected because:**
- Would require maintaining two languages (Go/Rust + TypeScript for frontend)
- Effect TS provides similar benefits with single language
- Bun compilation achieves comparable binary size

## References

- [PRD: ivokun CMS](/docs/plans/cms-prd.md)
- [Implementation Plan](/docs/plans/cms-implementation-plan.md)
- [Effect TS Documentation](https://effect.website)
- [Kysely Documentation](https://kysely.dev)
- [Bun Build Documentation](https://bun.sh/docs/bundler)
