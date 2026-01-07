# ivokun CMS

A custom headless CMS built with Effect TS, Kysely, and Bun. Designed as a lightweight, type-safe replacement for Strapi.

## Features

- **Content Types**: Posts (with i18n), Categories, Galleries, Media, Home singleton
- **Rich Text Editor**: TipTap-based editor with image support
- **Media Management**: Image processing with automatic WebP conversion and responsive variants
- **Admin Panel**: SolidJS single-page application
- **Authentication**: Session-based admin auth, API key auth for public endpoints
- **Storage**: Cloudflare R2 integration for media files
- **Deployment**: Single binary compilation, NixOS module included

## Tech Stack

- **Runtime**: Bun 1.1.38+
- **Language**: TypeScript with strict mode
- **Backend**: Effect TS for type-safe error handling and services
- **Database**: PostgreSQL with Kysely query builder
- **Admin UI**: SolidJS + TailwindCSS + TipTap 3.x
- **Image Processing**: Sharp

## Monorepo Context

This package is part of the `ivokundotcom` monorepo. It uses Bun workspaces and can be managed from the root:

```bash
# From monorepo root
bun --filter '@ivokundotcom/cms' dev        # Start dev server
bun --filter '@ivokundotcom/cms' typecheck  # Type check
bun --filter '@ivokundotcom/cms' test       # Run tests

# Or from cms directory
cd cms && bun run dev
```

See [ADR-006](../docs/adr/006-bun-workspace-configuration.md) for workspace configuration details.

## Prerequisites

- Bun >= 1.1.38
- Node.js >= 22.17.0
- PostgreSQL 15+
- dbmate (for migrations)

## Quick Start

### 1. Install Dependencies

```bash
cd cms
bun install
```

### 2. Set Up Environment

Create a `.env` file:

```bash
# Required
DATABASE_URL=postgres://user:password@localhost:5432/cms
SESSION_SECRET=your-secret-at-least-32-characters-long

# Cloudflare R2 Storage
R2_ACCESS_KEY_ID=your-access-key
R2_ACCESS_SECRET=your-secret-key
R2_ENDPOINT=https://account-id.r2.cloudflarestorage.com
R2_BUCKET=your-bucket-name
R2_PUBLIC_URL=https://your-public-domain.com

# Optional
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
```

### 3. Run Database Migrations

```bash
bun run db:up
```

### 4. Create Admin User

```bash
bun run seed:admin
```

Follow the prompts to create your admin account.

### 5. Start Development Server

```bash
bun run dev
```

The server starts at `http://localhost:3000`:
- Admin panel: `http://localhost:3000/admin`
- Health check: `http://localhost:3000/health`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | - | Secret for signing sessions (min 32 chars) |
| `R2_ACCESS_KEY_ID` | Yes | - | Cloudflare R2 access key |
| `R2_ACCESS_SECRET` | Yes | - | Cloudflare R2 secret key |
| `R2_ENDPOINT` | Yes | - | R2 S3-compatible endpoint URL |
| `R2_BUCKET` | Yes | - | R2 bucket name |
| `R2_PUBLIC_URL` | Yes | - | Public URL for serving media |
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment (development/production) |
| `CORS_ORIGIN` | No | * | Allowed CORS origins |

## Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run build` | Build production binary + SPA |
| `bun run build:spa` | Build admin SPA only |
| `bun run build:quick` | Quick binary build (no SPA rebuild) |
| `bun run start` | Run production binary |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | ESLint checking |
| `bun run test` | Run tests |
| `bun run db:up` | Run pending migrations |
| `bun run db:down` | Rollback last migration |
| `bun run db:status` | Show migration status |
| `bun run db:new <name>` | Create new migration |
| `bun run seed:admin` | Create admin user |
| `bun run migrate:strapi` | Migrate data from Strapi |

## API Overview

### Public API (requires API key)

All public endpoints require `X-API-Key` header.

```
GET /api/posts              - List published posts
GET /api/posts/:slug        - Get post by slug
GET /api/categories         - List categories
GET /api/categories/:slug   - Get category by slug
GET /api/galleries          - List published galleries
GET /api/galleries/:slug    - Get gallery by slug
GET /api/home               - Get home page content
```

### Admin API (requires session)

Authenticate via `POST /admin/api/login`, then use session cookie.

```
POST   /admin/api/login     - Login
POST   /admin/api/logout    - Logout
GET    /admin/api/me        - Current user

# Posts
GET    /admin/api/posts
POST   /admin/api/posts
GET    /admin/api/posts/:id
PATCH  /admin/api/posts/:id
DELETE /admin/api/posts/:id
POST   /admin/api/posts/:id/publish
POST   /admin/api/posts/:id/unpublish

# Categories, Galleries, Media, Home - similar CRUD patterns
# API Keys management at /admin/api/api-keys
```

## Migration from Strapi

The migration script transfers data from a running Strapi instance:

```bash
STRAPI_URL=http://localhost:1337 \
STRAPI_TOKEN=your-strapi-api-token \
DATABASE_URL=postgres://... \
R2_ACCESS_KEY_ID=... \
R2_ACCESS_SECRET=... \
R2_ENDPOINT=... \
R2_BUCKET=... \
R2_PUBLIC_URL=... \
bun run migrate:strapi
```

### Options

- `--dry-run` - Preview changes without writing to database
- `--skip-media` - Skip media file migration (keeps Strapi URLs)
- `--only=TYPE` - Only migrate specific type: `categories`, `posts`, `galleries`, `home`, `media`

### Migration Order

1. Categories (no dependencies)
2. Media files (downloaded and re-uploaded to R2)
3. Posts (references categories and media)
4. Galleries (references categories and media)
5. Home content (references media)

The script converts:
- Strapi blocks format to TipTap JSON
- Markdown rich text to TipTap JSON
- Media files to WebP with responsive variants

## Deployment

### Binary Build

```bash
# Build for current platform
bun run build

# Build for Linux x64 (cross-compile)
bun run build:linux

# Build for all platforms
bun run build:all
```

Output: `dist/cms` (binary) + `dist/public/` (admin SPA)

### NixOS Deployment

Add to your NixOS configuration:

```nix
{ config, pkgs, ... }:

{
  imports = [ ./path/to/cms/nix/module.nix ];

  services.ivokun-cms = {
    enable = true;
    domain = "cms.example.com";
    databaseUrl = "postgres://user:pass@localhost/cms";
    environmentFile = "/run/secrets/cms.env";
    
    caddy.enable = true;  # Optional: enable Caddy reverse proxy
  };
}
```

The environment file should contain secrets:
```
SESSION_SECRET=...
R2_ACCESS_KEY_ID=...
R2_ACCESS_SECRET=...
R2_ENDPOINT=...
R2_BUCKET=...
R2_PUBLIC_URL=...
```

### Manual Deployment

1. Build the binary: `bun run build`
2. Copy `dist/` to server
3. Set environment variables
4. Run migrations: `./cms` (with `CMS_MIGRATIONS_DIR` set, or run dbmate separately)
5. Start: `./cms`

The binary expects:
- `public/` directory alongside it (or `CMS_PUBLIC_DIR` env var)
- Database migrations to be run separately

## Development

### Project Structure

```
cms/
├── src/
│   ├── server.ts           # HTTP server and routes
│   ├── config.ts           # Environment configuration
│   ├── schemas.ts          # Effect schemas for validation
│   ├── types.ts            # TypeScript types and Kysely tables
│   ├── errors.ts           # Error types
│   ├── middleware.ts       # Auth middleware
│   ├── services/           # Business logic services
│   │   ├── auth.service.ts
│   │   ├── category.service.ts
│   │   ├── post.service.ts
│   │   ├── gallery.service.ts
│   │   ├── home.service.ts
│   │   ├── media.service.ts
│   │   ├── image.service.ts
│   │   ├── storage.service.ts
│   │   └── db.service.ts
│   └── admin/              # SolidJS admin panel
│       ├── App.tsx
│       ├── api.ts
│       └── store.ts
├── db/
│   └── migrations/         # SQL migration files
├── scripts/
│   ├── build-binary.ts     # Binary build script
│   ├── seed-admin.ts       # Admin user seeding
│   └── migrate-strapi.ts   # Strapi migration
├── nix/
│   ├── module.nix          # NixOS service module
│   └── package.nix         # Nix package derivation
└── public/                 # Built admin SPA (after build)
```

### Running Tests

```bash
bun test                    # Run all tests
bun test src/services/      # Run service tests only
bun test --watch            # Watch mode
```

### Workspace Configuration

The CMS uses `bunfig.toml` to configure module resolution for Effect TS packages:

```toml
[install]
registry = "https://registry.npmjs.org"

[resolve]
conditions = ["import", "module", "node"]
```

This ensures proper resolution of Effect TS subpath exports and prevents version conflicts with hoisted dependencies.

## Architecture Decision Records

- [ADR-001: Custom CMS Architecture](../docs/adr/001-cms-architecture.md)
- [ADR-002: Effect TS Adoption](../docs/adr/002-effect-ts-adoption.md)
- [ADR-003: SolidJS for Admin SPA](../docs/adr/003-admin-spa-technology.md)
- [ADR-004: Image Processing Pipeline](../docs/adr/004-image-processing-pipeline.md)
- [ADR-005: Authentication Strategy](../docs/adr/005-authentication-strategy.md)
- [ADR-006: Bun Workspace Configuration](../docs/adr/006-bun-workspace-configuration.md)

## License

MIT
