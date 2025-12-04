# Phase 0: Project Setup & Foundation

> **Duration:** 3-5 days  
> **Prerequisites:** Bun 1.1.38+, PostgreSQL 16+, Node.js 22.17.0+  
> **PRD Reference:** NFR-4.4 (Maintainability), NFR-4.5 (Compatibility)  
> **Goal:** Establish project structure, dependencies, database schema, and core type system

---

## Overview

This phase establishes the foundation for the ivokun CMS as defined in the [Product Requirements Document](./cms-prd.md). By the end of this phase, you will have:

- A properly configured TypeScript project meeting NFR-4.4 requirements
- A working database schema with all 8 tables per PRD Section 6
- Core type definitions aligned with PRD data models
- A comprehensive error system supporting PRD Section 7.3 error responses

### PRD Alignment

| PRD Section | Phase 0 Deliverable |
|-------------|---------------------|
| NFR-4.4.1 | 100% TypeScript with strict mode |
| NFR-4.4.4 | Flat directory structure |
| NFR-4.4.5 | Tagged error types |
| NFR-4.5.3 | Bun 1.1+ runtime |
| NFR-4.5.4 | PostgreSQL 16+ |
| Section 6 | Complete database schema |
| Section 7.3 | Error response format |

### Success Criteria

Per PRD acceptance criteria:

- [ ] TypeScript compiles without errors (NFR-4.4.1)
- [ ] All 8 database tables created (PRD Section 6.2)
- [ ] Error types map to HTTP status codes (PRD Section 7.3)
- [ ] Environment configuration complete (PRD Appendix 16.2)

---

## Task 0.1: Project Initialization

### Step 0.1.1: Create Directory Structure

Create the CMS directory following PRD Section 5.3 component diagram:

```bash
# From project root
cd /home/ivokun/Documents/dev/ivokundotcom

# Create cms directory structure
mkdir -p cms/src
mkdir -p cms/db/migrations
mkdir -p cms/scripts
mkdir -p cms/public

cd cms
```

**PRD Alignment:** This follows the flat structure requirement (NFR-4.4.4).

**Verification:**
```bash
tree -L 2 .
```

**Expected output:**
```
.
├── db
│   └── migrations
├── public
├── scripts
└── src
```

---

### Step 0.1.2: Create package.json

Create `cms/package.json` with dependencies from PRD Section 5 (Technology Stack):

```json
{
  "name": "@ivokundotcom/cms",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "ivokun CMS - Custom headless CMS built with Effect TS, Kysely, and Bun",
  "scripts": {
    "dev": "bun run --watch src/server.ts",
    "build": "bun build src/server.ts --compile --outfile cms",
    "build:spa": "vite build",
    "start": "./cms",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx}\"",
    "db:new": "dbmate new",
    "db:up": "dbmate up",
    "db:down": "dbmate down",
    "db:status": "dbmate status",
    "db:dump": "dbmate dump",
    "seed:admin": "bun run scripts/seed-admin.ts",
    "test": "bun test"
  },
  "dependencies": {
    "effect": "^3.10.0",
    "@effect/platform": "^0.69.0",
    "@effect/platform-bun": "^0.50.0",
    "@effect/schema": "^0.76.0",
    "kysely": "^0.27.4",
    "pg": "^8.13.1",
    "@aws-sdk/client-s3": "^3.700.0",
    "sharp": "^0.33.5",
    "@node-rs/argon2": "^2.0.0",
    "@paralleldrive/cuid2": "^2.2.2"
  },
  "devDependencies": {
    "@types/bun": "^1.1.14",
    "@types/pg": "^8.11.10",
    "typescript": "^5.7.2",
    "solid-js": "^1.9.3",
    "@solidjs/router": "^0.15.0",
    "solid-tiptap": "^0.13.3",
    "@tiptap/starter-kit": "^2.10.0",
    "@tiptap/extension-image": "^2.10.0",
    "@tiptap/extension-link": "^2.10.0",
    "@tiptap/extension-placeholder": "^2.10.0",
    "vite": "^6.0.3",
    "vite-plugin-solid": "^2.10.2",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.16",
    "@typescript-eslint/parser": "^8.17.0",
    "@typescript-eslint/eslint-plugin": "^8.17.0",
    "eslint": "^9.16.0",
    "eslint-plugin-simple-import-sort": "^12.1.1",
    "prettier": "^3.4.2"
  },
  "engines": {
    "node": ">=22.17.0",
    "bun": ">=1.1.38"
  }
}
```

**PRD Technology Mapping:**

| PRD Technology | Package | Purpose |
|----------------|---------|---------|
| Effect TS 3.x | `effect`, `@effect/*` | FP framework (NFR-4.4.2) |
| Kysely 0.27+ | `kysely` | Type-safe SQL |
| Sharp 0.33+ | `sharp` | Image processing |
| Argon2 | `@node-rs/argon2` | Password hashing (SEC-9.1.1) |
| CUID2 | `@paralleldrive/cuid2` | ID generation |
| SolidJS 1.8+ | `solid-js`, `@solidjs/router` | Admin SPA |
| TipTap 2.x | `@tiptap/*`, `solid-tiptap` | Rich text editor |

**Install dependencies:**
```bash
bun install
```

**Verification:**
```bash
# Verify lock file created
ls -lh bun.lock

# Check critical packages installed
bun pm ls 2>/dev/null | head -20
```

---

### Step 0.1.3: Create TypeScript Configuration

Create `cms/tsconfig.json` meeting NFR-4.4.1 (strict TypeScript):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true,
    
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    
    "types": ["bun-types"],
    
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    
    "baseUrl": ".",
    "paths": {
      "~/*": ["./src/*"]
    }
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "scripts/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "public",
    "dist"
  ]
}
```

**Key Settings (PRD Alignment):**

| Setting | Value | PRD Requirement |
|---------|-------|-----------------|
| `strict` | `true` | NFR-4.4.1 - Strict typing |
| `noEmit` | `true` | Using Bun for building |
| `jsxImportSource` | `solid-js` | SolidJS for admin SPA |
| `noUncheckedIndexedAccess` | `true` | Extra safety for arrays/objects |

---

### Step 0.1.4: Configure ESLint

Per AGENTS.md, imports MUST be sorted using `simple-import-sort`.

Create `cms/eslint.config.js`:

```javascript
import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default [
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'scripts/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        Bun: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
    },
  },
  {
    ignores: ['node_modules/', 'public/', 'dist/', '*.js', 'db/'],
  },
];
```

---

### Step 0.1.5: Configure Prettier

Create `cms/.prettierrc`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "bracketSpacing": true,
  "jsxSingleQuote": false
}
```

Create `cms/.prettierignore`:

```
node_modules
public
dist
db
*.lock
*.log
.env
.env.*
```

---

### Step 0.1.6: Create Environment Configuration

Create `cms/.env.example` with all variables from PRD Appendix 16.2:

```bash
# =============================================================================
# ivokun CMS Environment Configuration
# See PRD Appendix 16.2 for documentation
# =============================================================================

# -----------------------------------------------------------------------------
# Server Configuration
# -----------------------------------------------------------------------------
PORT=3000
NODE_ENV=development

# -----------------------------------------------------------------------------
# Database Configuration (Required - PRD Section 10.2)
# -----------------------------------------------------------------------------
# Format: postgresql://user:password@host:port/database
DATABASE_URL=postgres://cms_user:cms_password@localhost:5432/ivokun_cms

# -----------------------------------------------------------------------------
# Session Configuration (Required - PRD SEC-9.1)
# -----------------------------------------------------------------------------
# Minimum 32 characters, used for signing session cookies
SESSION_SECRET=change-this-to-a-random-64-character-string-in-production

# -----------------------------------------------------------------------------
# Cloudflare R2 Configuration (Required - PRD Section 10.1)
# -----------------------------------------------------------------------------
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_ACCESS_SECRET=your_r2_secret_access_key
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_BUCKET=ivokun-cms-media
R2_PUBLIC_URL=https://media.ivokun.com

# -----------------------------------------------------------------------------
# CORS Configuration (Optional)
# -----------------------------------------------------------------------------
CORS_ORIGIN=https://ivokun.com

# -----------------------------------------------------------------------------
# Admin Seed Configuration (Development only)
# -----------------------------------------------------------------------------
ADMIN_EMAIL=admin@ivokun.com
ADMIN_PASSWORD=changeme123
ADMIN_NAME=Administrator
```

Create `.env` from example:
```bash
cp .env.example .env
```

**Security Note (PRD SEC-9.3):** Edit `.env` with real values. Never commit this file.

---

### Step 0.1.7: Create .gitignore

Create `cms/.gitignore`:

```gitignore
# =============================================================================
# ivokun CMS .gitignore
# =============================================================================

# Dependencies
node_modules/

# Environment (PRD SEC-9.3.3, SEC-9.3.4)
.env
.env.local
.env.*.local

# Build outputs
dist/
cms
public/index.html
public/assets/

# Database (generated by dbmate)
db/schema.sql

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Temporary
*.tmp
.cache/

# Test coverage
coverage/
```

---

### Step 0.1.8: Create README

Create `cms/README.md`:

```markdown
# ivokun CMS

> Custom headless CMS replacing Strapi - single binary, Effect TS, Kysely, NixOS deployment

See [PRD](../docs/plans/cms-prd.md) for full requirements.

## Features

- **Single Binary Deployment** - Compiles to ~50MB executable
- **Effect TS** - Functional programming with typed errors
- **Kysely** - Type-safe SQL query builder
- **SolidJS Admin** - Lightweight admin interface
- **TipTap Editor** - Rich text with inline images
- **Sharp** - Automatic image processing (WebP, 4 sizes)
- **Argon2** - Secure password hashing

## Quick Start

### Prerequisites

- Bun 1.1.38+ (`bun --version`)
- PostgreSQL 16+ (`psql --version`)
- Node.js 22.17.0+ (`node --version`)

### Setup

```bash
# Install dependencies
bun install

# Copy and configure environment
cp .env.example .env
# Edit .env with your values

# Start database (Docker)
docker-compose up -d

# Run migrations
bun run db:up

# Seed admin user
bun run seed:admin

# Start development server
bun run dev
```

### Access

| URL | Purpose |
|-----|---------|
| http://localhost:3000/admin | Admin Panel |
| http://localhost:3000/api | Public API |
| http://localhost:3000/admin/api | Admin API |

## Development

```bash
bun run dev          # Start with hot reload
bun run typecheck    # TypeScript check
bun run lint         # ESLint
bun run format       # Prettier
bun run test         # Run tests
```

## Database

```bash
bun run db:new NAME  # Create migration
bun run db:up        # Apply migrations
bun run db:down      # Rollback last
bun run db:status    # Check status
```

## Build

```bash
bun run build:spa    # Build admin SPA
bun run build        # Compile binary
./cms                # Run binary
```

## Project Structure

```
cms/
├── src/
│   ├── server.ts    # HTTP server (~500 LOC)
│   ├── services.ts  # Business logic (~800 LOC)
│   ├── schemas.ts   # Effect schemas (~300 LOC)
│   ├── types.ts     # Type definitions (~200 LOC)
│   ├── errors.ts    # Error classes (~150 LOC)
│   └── index.tsx    # Admin SPA (~1000 LOC)
├── db/migrations/   # SQL migrations
├── scripts/         # Utility scripts
└── public/          # Built SPA assets
```

## License

Private - All Rights Reserved
```

---

## Task 0.2: Database Setup

### Step 0.2.1: Install dbmate

dbmate is the migration tool specified in the PRD.

**Linux:**
```bash
sudo curl -fsSL -o /usr/local/bin/dbmate \
  https://github.com/amacneil/dbmate/releases/latest/download/dbmate-linux-amd64
sudo chmod +x /usr/local/bin/dbmate
```

**macOS:**
```bash
brew install dbmate
```

**Verification:**
```bash
dbmate --version
# Expected: dbmate version 2.x.x
```

---

### Step 0.2.2: Set Up PostgreSQL

**Option A: Docker (Recommended for development)**

Create `cms/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: ivokun-cms-db
    environment:
      POSTGRES_USER: cms_user
      POSTGRES_PASSWORD: cms_password
      POSTGRES_DB: ivokun_cms
    ports:
      - "5432:5432"
    volumes:
      - cms_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cms_user -d ivokun_cms"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  cms_postgres_data:
```

Start the database:
```bash
docker-compose up -d
```

**Option B: Native PostgreSQL**

```bash
# Create user and database
sudo -u postgres psql << 'EOF'
CREATE USER cms_user WITH PASSWORD 'cms_password';
CREATE DATABASE ivokun_cms OWNER cms_user;
GRANT ALL PRIVILEGES ON DATABASE ivokun_cms TO cms_user;
EOF
```

**Verification:**
```bash
# Test connection
psql "postgres://cms_user:cms_password@localhost:5432/ivokun_cms" -c "SELECT version();"
```

---

### Step 0.2.3: Create Initial Migration

Create the migration file:
```bash
bun run db:new initial_schema
```

This creates `db/migrations/YYYYMMDDHHMMSS_initial_schema.sql`.

Replace its contents with the schema from PRD Section 6.2:

```sql
-- migrate:up

-- =============================================================================
-- ENUMS (PRD Section 6.1)
-- =============================================================================

CREATE TYPE content_status AS ENUM ('draft', 'published');
CREATE TYPE content_locale AS ENUM ('en', 'id');

-- =============================================================================
-- USERS TABLE (PRD Section 6.2.1)
-- Admin users for CMS access
-- =============================================================================

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE INDEX idx_users_email ON users (email);

COMMENT ON TABLE users IS 'Admin users for CMS access (PRD 6.2.1)';
COMMENT ON COLUMN users.id IS 'CUID2 identifier';
COMMENT ON COLUMN users.password_hash IS 'Argon2id hash (PRD SEC-9.1.1)';

-- =============================================================================
-- SESSIONS TABLE (PRD Section 6.2.2)
-- User sessions for admin authentication
-- =============================================================================

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    
    CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) 
        REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

COMMENT ON TABLE sessions IS 'User sessions - 7 day expiry (PRD 6.2.2, SEC-9.1.3)';

-- =============================================================================
-- CATEGORIES TABLE (PRD Section 6.2.3)
-- Content categorization
-- =============================================================================

CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT categories_slug_unique UNIQUE (slug)
);

CREATE INDEX idx_categories_slug ON categories (slug);

COMMENT ON TABLE categories IS 'Content categories (PRD 6.2.3)';

-- =============================================================================
-- MEDIA TABLE (PRD Section 6.2.6)
-- Uploaded media files with processed variants
-- =============================================================================

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

CREATE INDEX idx_media_created_at ON media (created_at DESC);

COMMENT ON TABLE media IS 'Media files with variants (PRD 6.2.6)';
COMMENT ON COLUMN media.urls IS 'JSON: {original, thumbnail, small, large}';

-- =============================================================================
-- POSTS TABLE (PRD Section 6.2.4)
-- Blog posts with i18n support
-- =============================================================================

CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    excerpt TEXT,
    content JSONB,
    featured_image TEXT,
    read_time_minute INTEGER,
    category_id TEXT,
    locale content_locale NOT NULL DEFAULT 'en',
    status content_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT posts_slug_locale_unique UNIQUE (slug, locale),
    CONSTRAINT posts_featured_image_fk FOREIGN KEY (featured_image) 
        REFERENCES media (id) ON DELETE SET NULL,
    CONSTRAINT posts_category_fk FOREIGN KEY (category_id) 
        REFERENCES categories (id) ON DELETE SET NULL
);

CREATE INDEX idx_posts_slug_locale ON posts (slug, locale);
CREATE INDEX idx_posts_status ON posts (status);
CREATE INDEX idx_posts_locale ON posts (locale);
CREATE INDEX idx_posts_category_id ON posts (category_id);
CREATE INDEX idx_posts_published_at ON posts (published_at DESC NULLS LAST);
CREATE INDEX idx_posts_created_at ON posts (created_at DESC);

COMMENT ON TABLE posts IS 'Blog posts with i18n (PRD 6.2.4)';
COMMENT ON COLUMN posts.content IS 'TipTap JSON document';

-- =============================================================================
-- GALLERIES TABLE (PRD Section 6.2.5)
-- Photo galleries
-- =============================================================================

CREATE TABLE galleries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    images JSONB NOT NULL DEFAULT '[]',
    category_id TEXT,
    status content_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT galleries_slug_unique UNIQUE (slug),
    CONSTRAINT galleries_category_fk FOREIGN KEY (category_id) 
        REFERENCES categories (id) ON DELETE SET NULL
);

CREATE INDEX idx_galleries_slug ON galleries (slug);
CREATE INDEX idx_galleries_status ON galleries (status);
CREATE INDEX idx_galleries_category_id ON galleries (category_id);
CREATE INDEX idx_galleries_published_at ON galleries (published_at DESC NULLS LAST);

COMMENT ON TABLE galleries IS 'Photo galleries (PRD 6.2.5)';
COMMENT ON COLUMN galleries.images IS 'Array of media IDs';

-- =============================================================================
-- HOME TABLE (PRD Section 6.2.7)
-- Singleton for homepage content
-- =============================================================================

CREATE TABLE home (
    id TEXT PRIMARY KEY DEFAULT 'singleton',
    title TEXT,
    short_description TEXT,
    description JSONB,
    hero TEXT,
    keywords TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT home_singleton CHECK (id = 'singleton'),
    CONSTRAINT home_hero_fk FOREIGN KEY (hero) 
        REFERENCES media (id) ON DELETE SET NULL
);

-- Insert singleton row
INSERT INTO home (id) VALUES ('singleton');

COMMENT ON TABLE home IS 'Homepage content singleton (PRD 6.2.7)';

-- =============================================================================
-- API_KEYS TABLE (PRD Section 6.2.8)
-- API keys for public API access
-- =============================================================================

CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    prefix TEXT NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_prefix ON api_keys (prefix);

COMMENT ON TABLE api_keys IS 'API keys for public API (PRD 6.2.8)';
COMMENT ON COLUMN api_keys.key_hash IS 'Argon2id hash (PRD SEC-9.1.5)';
COMMENT ON COLUMN api_keys.prefix IS 'First 8 chars for lookup';

-- =============================================================================
-- TRIGGERS FOR updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_galleries_updated_at
    BEFORE UPDATE ON galleries
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_home_updated_at
    BEFORE UPDATE ON home
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- migrate:down

-- Drop triggers
DROP TRIGGER IF EXISTS set_home_updated_at ON home;
DROP TRIGGER IF EXISTS set_galleries_updated_at ON galleries;
DROP TRIGGER IF EXISTS set_categories_updated_at ON categories;
DROP TRIGGER IF EXISTS set_posts_updated_at ON posts;
DROP FUNCTION IF EXISTS trigger_set_updated_at();

-- Drop tables (order matters for foreign keys)
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS home;
DROP TABLE IF EXISTS galleries;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

-- Drop types
DROP TYPE IF EXISTS content_locale;
DROP TYPE IF EXISTS content_status;
```

**PRD Alignment Notes:**

| PRD Section | Implementation |
|-------------|----------------|
| 6.2.1 Users | Email unique, Argon2 hash |
| 6.2.2 Sessions | 7-day expiry, cascade delete |
| 6.2.3 Categories | Slug unique |
| 6.2.4 Posts | Slug+locale unique, TipTap JSON |
| 6.2.5 Galleries | Images as JSON array |
| 6.2.6 Media | URLs as JSON object |
| 6.2.7 Home | Singleton with CHECK constraint |
| 6.2.8 API Keys | Prefix for fast lookup |

---

### Step 0.2.4: Run Migration

```bash
bun run db:up
```

**Expected output:**
```
Applying: YYYYMMDDHHMMSS_initial_schema.sql
Writing: db/schema.sql
```

**Verification:**
```bash
# Check migration status
bun run db:status

# Expected:
# [x] YYYYMMDDHHMMSS_initial_schema.sql
# 
# Applied: 1
# Pending: 0

# Verify all 8 tables exist (PRD Section 6.2)
psql "postgres://cms_user:cms_password@localhost:5432/ivokun_cms" -c "\dt"
```

**Expected tables:**
```
 Schema |    Name    | Type  |  Owner   
--------+------------+-------+----------
 public | api_keys   | table | cms_user
 public | categories | table | cms_user
 public | galleries  | table | cms_user
 public | home       | table | cms_user
 public | media      | table | cms_user
 public | posts      | table | cms_user
 public | sessions   | table | cms_user
 public | users      | table | cms_user
(8 rows)
```

---

## Task 0.3: Core Type Definitions

### Step 0.3.1: Create types.ts

Create `cms/src/types.ts` implementing PRD Section 6 data model:

```typescript
/**
 * @fileoverview Core type definitions for ivokun CMS
 * @see PRD Section 6 - Data Model
 * @see PRD NFR-4.4.1 - 100% TypeScript with strict mode
 */

import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

// =============================================================================
// DATABASE INTERFACE
// Defines all tables for Kysely type-safe queries
// =============================================================================

/**
 * Main database interface for Kysely
 * Maps to PRD Section 6.2 tables
 */
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

// =============================================================================
// TABLE INTERFACES
// Each interface maps to PRD Section 6.2.x
// =============================================================================

/**
 * Users table - PRD Section 6.2.1
 * Admin users for CMS access
 */
export interface UsersTable {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: Generated<Date>;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

/**
 * Sessions table - PRD Section 6.2.2
 * User sessions - 7 day expiry (SEC-9.1.3)
 */
export interface SessionsTable {
  id: string;
  user_id: string;
  expires_at: Date;
}

export type Session = Selectable<SessionsTable>;
export type NewSession = Insertable<SessionsTable>;

/**
 * Categories table - PRD Section 6.2.3
 * Content categorization
 */
export interface CategoriesTable {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Category = Selectable<CategoriesTable>;
export type NewCategory = Insertable<CategoriesTable>;
export type CategoryUpdate = Updateable<CategoriesTable>;

/**
 * Media table - PRD Section 6.2.6
 * Uploaded media files with processed variants
 */
export interface MediaTable {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  alt: string | null;
  urls: ColumnType<MediaUrls, MediaUrls, MediaUrls>;
  width: number | null;
  height: number | null;
  created_at: Generated<Date>;
}

export type Media = Selectable<MediaTable>;
export type NewMedia = Insertable<MediaTable>;
export type MediaUpdate = Updateable<MediaTable>;

/**
 * Posts table - PRD Section 6.2.4
 * Blog posts with i18n support
 */
export interface PostsTable {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: ColumnType<TipTapDocument | null, TipTapDocument | null, TipTapDocument | null>;
  featured_image: string | null;
  read_time_minute: number | null;
  category_id: string | null;
  locale: Locale;
  status: Status;
  published_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Post = Selectable<PostsTable>;
export type NewPost = Insertable<PostsTable>;
export type PostUpdate = Updateable<PostsTable>;

/**
 * Galleries table - PRD Section 6.2.5
 * Photo galleries
 */
export interface GalleriesTable {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  images: ColumnType<string[], string[], string[]>;
  category_id: string | null;
  status: Status;
  published_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Gallery = Selectable<GalleriesTable>;
export type NewGallery = Insertable<GalleriesTable>;
export type GalleryUpdate = Updateable<GalleriesTable>;

/**
 * Home table - PRD Section 6.2.7
 * Singleton for homepage content
 */
export interface HomeTable {
  id: string;
  title: string | null;
  short_description: string | null;
  description: ColumnType<TipTapDocument | null, TipTapDocument | null, TipTapDocument | null>;
  hero: string | null;
  keywords: string | null;
  updated_at: Generated<Date>;
}

export type Home = Selectable<HomeTable>;
export type HomeUpdate = Updateable<HomeTable>;

/**
 * API Keys table - PRD Section 6.2.8
 * API keys for public API access
 */
export interface ApiKeysTable {
  id: string;
  name: string;
  key_hash: string;
  prefix: string;
  last_used_at: Date | null;
  created_at: Generated<Date>;
}

export type ApiKey = Selectable<ApiKeysTable>;
export type NewApiKey = Insertable<ApiKeysTable>;

// =============================================================================
// SHARED TYPES
// =============================================================================

/**
 * Supported locales - PRD Section 3.1.1.9
 * Only English and Indonesian (Constraint #2)
 */
export type Locale = 'en' | 'id';

/**
 * Content status - PRD FR-3.1.1.4, FR-3.1.1.5
 */
export type Status = 'draft' | 'published';

/**
 * Media URLs for image variants - PRD Section 3.2
 * @see Image Processing Requirements table
 */
export interface MediaUrls {
  /** Full size, WebP, 90% quality */
  original: string;
  /** 200px wide, 80% quality */
  thumbnail: string;
  /** 800px wide, 85% quality */
  small: string;
  /** 1920px wide, 85% quality */
  large: string;
}

/**
 * TipTap document structure - PRD FR-3.3.9
 * Simplified type for rich text content
 */
export interface TipTapDocument {
  type: 'doc';
  content: TipTapNode[];
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Application configuration - PRD Appendix 16.2
 */
export interface Config {
  /** Server port (default: 3000) */
  port: number;
  /** PostgreSQL connection string */
  databaseUrl: string;
  /** Session signing secret (min 32 chars) */
  sessionSecret: string;
  /** Cloudflare R2 configuration */
  r2: R2Config;
  /** CORS origin (optional) */
  corsOrigin?: string;
}

export interface R2Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucket: string;
  publicUrl: string;
}

// =============================================================================
// API RESPONSE TYPES
// Used by services and handlers
// =============================================================================

/**
 * Paginated response - PRD Section 7.1.2
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Post with expanded relations
 */
export interface PostWithCategory extends Post {
  category: Category | null;
}

export interface PostWithMedia extends PostWithCategory {
  featured_media: Media | null;
}

/**
 * Gallery with expanded category
 */
export interface GalleryWithCategory extends Gallery {
  category: Category | null;
}
```

**PRD Traceability:**

| Type | PRD Reference |
|------|---------------|
| `Locale` | Section 3.1.1.9, Constraint #2 |
| `Status` | FR-3.1.1.4, FR-3.1.1.5 |
| `MediaUrls` | Section 3.2 Image Processing |
| `TipTapDocument` | FR-3.3.9 |
| `Config` | Appendix 16.2 |
| `PaginatedResponse` | Section 7.1.2 |

---

### Step 0.3.2: Verify Types Compile

```bash
bun run typecheck
```

**Expected:** No errors.

---

## Task 0.4: Error System

### Step 0.4.1: Create errors.ts

Create `cms/src/errors.ts` implementing PRD Section 7.3 error responses:

```typescript
/**
 * @fileoverview Domain error hierarchy for ivokun CMS
 * @see PRD Section 7.3 - Error Response Format
 * @see PRD NFR-4.4.5 - Tagged error types (no thrown exceptions)
 */

import { Data } from 'effect';

// =============================================================================
// AUTHENTICATION ERRORS
// PRD Section 7.3 - Error Types
// =============================================================================

/**
 * Invalid login credentials
 * HTTP 401 - PRD Section 7.3
 */
export class InvalidCredentials extends Data.TaggedError('InvalidCredentials')<{
  readonly message: string;
}> {}

/**
 * Session expired or invalid
 * HTTP 401 - PRD SEC-9.1.3
 */
export class SessionExpired extends Data.TaggedError('SessionExpired')<{
  readonly message: string;
}> {}

/**
 * API key invalid or missing
 * HTTP 401 - PRD Section 7.2
 */
export class InvalidApiKey extends Data.TaggedError('InvalidApiKey')<{
  readonly message: string;
}> {}

/**
 * User not authorized for action
 * HTTP 403 - PRD Section 7.3
 */
export class Unauthorized extends Data.TaggedError('Unauthorized')<{
  readonly message: string;
}> {}

// =============================================================================
// RESOURCE ERRORS
// =============================================================================

/**
 * Resource not found
 * HTTP 404 - PRD Section 7.3
 */
export class NotFound extends Data.TaggedError('NotFound')<{
  readonly resource: string;
  readonly id: string;
}> {
  get message(): string {
    return `${this.resource} with id '${this.id}' not found`;
  }
}

/**
 * Slug conflict (already exists)
 * HTTP 409 - PRD Section 7.3
 */
export class SlugConflict extends Data.TaggedError('SlugConflict')<{
  readonly slug: string;
  readonly locale?: string;
}> {
  get message(): string {
    return this.locale
      ? `Slug '${this.slug}' already exists for locale '${this.locale}'`
      : `Slug '${this.slug}' already exists`;
  }
}

/**
 * Input validation failed
 * HTTP 400 - PRD SEC-9.4
 */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly message: string;
  readonly errors: ReadonlyArray<{
    readonly path: string;
    readonly message: string;
  }>;
}> {}

// =============================================================================
// INFRASTRUCTURE ERRORS
// =============================================================================

/**
 * Database operation failed
 * HTTP 500 - PRD Section 7.3
 */
export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Storage operation failed (R2)
 * HTTP 500 - PRD Section 7.3
 */
export class StorageError extends Data.TaggedError('StorageError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Image processing failed (Sharp)
 * HTTP 500 - PRD Section 7.3
 */
export class ImageProcessingError extends Data.TaggedError('ImageProcessingError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Configuration error
 * HTTP 500 - Internal
 */
export class ConfigError extends Data.TaggedError('ConfigError')<{
  readonly message: string;
  readonly variable: string;
}> {}

// =============================================================================
// ERROR TYPE UNIONS
// For type-safe error handling
// =============================================================================

export type AuthError = InvalidCredentials | SessionExpired | InvalidApiKey | Unauthorized;

export type ResourceError = NotFound | SlugConflict | ValidationError;

export type InfraError = DatabaseError | StorageError | ImageProcessingError | ConfigError;

export type AppError = AuthError | ResourceError | InfraError;

// =============================================================================
// ERROR UTILITIES
// PRD Section 7.3 - Error Response Format
// =============================================================================

/**
 * Map error to HTTP status code
 * @see PRD Section 7.3 - Error Types table
 */
export function toHttpStatus(error: AppError): number {
  switch (error._tag) {
    case 'NotFound':
      return 404;
    case 'InvalidCredentials':
    case 'SessionExpired':
    case 'InvalidApiKey':
      return 401;
    case 'Unauthorized':
      return 403;
    case 'SlugConflict':
      return 409;
    case 'ValidationError':
      return 400;
    case 'DatabaseError':
    case 'StorageError':
    case 'ImageProcessingError':
    case 'ConfigError':
      return 500;
  }
}

/**
 * Convert error to JSON response format
 * @see PRD Section 7.3 - Error Response Format
 */
export function toJsonResponse(error: AppError): ErrorResponse {
  const base = {
    error: error._tag,
    message: error.message,
  };

  switch (error._tag) {
    case 'NotFound':
      return { ...base, resource: error.resource, id: error.id };
    case 'SlugConflict':
      return { ...base, slug: error.slug, locale: error.locale };
    case 'ValidationError':
      return { ...base, errors: error.errors };
    default:
      return base;
  }
}

/**
 * Error response JSON structure
 * @see PRD Section 7.3
 */
export interface ErrorResponse {
  error: string;
  message: string;
  resource?: string;
  id?: string;
  slug?: string;
  locale?: string;
  errors?: ReadonlyArray<{ path: string; message: string }>;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isAuthError(error: unknown): error is AuthError {
  return (
    error instanceof InvalidCredentials ||
    error instanceof SessionExpired ||
    error instanceof InvalidApiKey ||
    error instanceof Unauthorized
  );
}

export function isResourceError(error: unknown): error is ResourceError {
  return (
    error instanceof NotFound ||
    error instanceof SlugConflict ||
    error instanceof ValidationError
  );
}

export function isInfraError(error: unknown): error is InfraError {
  return (
    error instanceof DatabaseError ||
    error instanceof StorageError ||
    error instanceof ImageProcessingError ||
    error instanceof ConfigError
  );
}

export function isAppError(error: unknown): error is AppError {
  return isAuthError(error) || isResourceError(error) || isInfraError(error);
}
```

**PRD Error Mapping:**

| Error Class | HTTP Code | PRD Reference |
|-------------|-----------|---------------|
| NotFound | 404 | Section 7.3 |
| InvalidCredentials | 401 | Section 7.3 |
| SessionExpired | 401 | SEC-9.1.3 |
| InvalidApiKey | 401 | Section 7.3 |
| Unauthorized | 403 | Section 7.3 |
| SlugConflict | 409 | Section 7.3 |
| ValidationError | 400 | SEC-9.4 |
| DatabaseError | 500 | Section 7.3 |
| StorageError | 500 | Section 7.3 |
| ImageProcessingError | 500 | Section 7.3 |

---

### Step 0.4.2: Test Error System

Create `cms/src/errors.test.ts`:

```typescript
import { describe, expect, test } from 'bun:test';

import * as Errors from './errors';

describe('Error System', () => {
  test('NotFound generates correct message', () => {
    const error = new Errors.NotFound({ resource: 'Post', id: 'abc123' });
    expect(error.message).toBe("Post with id 'abc123' not found");
    expect(error._tag).toBe('NotFound');
  });

  test('SlugConflict includes locale when provided', () => {
    const error = new Errors.SlugConflict({ slug: 'my-post', locale: 'en' });
    expect(error.message).toBe("Slug 'my-post' already exists for locale 'en'");
  });

  test('SlugConflict without locale', () => {
    const error = new Errors.SlugConflict({ slug: 'my-post' });
    expect(error.message).toBe("Slug 'my-post' already exists");
  });

  test('toHttpStatus maps correctly', () => {
    expect(Errors.toHttpStatus(new Errors.NotFound({ resource: 'Post', id: '1' }))).toBe(404);
    expect(Errors.toHttpStatus(new Errors.InvalidCredentials({ message: 'Bad' }))).toBe(401);
    expect(Errors.toHttpStatus(new Errors.Unauthorized({ message: 'No' }))).toBe(403);
    expect(Errors.toHttpStatus(new Errors.SlugConflict({ slug: 'x' }))).toBe(409);
    expect(Errors.toHttpStatus(new Errors.ValidationError({ message: 'Bad', errors: [] }))).toBe(400);
    expect(Errors.toHttpStatus(new Errors.DatabaseError({ message: 'Fail' }))).toBe(500);
  });

  test('toJsonResponse includes correct fields', () => {
    const notFound = Errors.toJsonResponse(
      new Errors.NotFound({ resource: 'Post', id: 'xyz' })
    );
    expect(notFound).toEqual({
      error: 'NotFound',
      message: "Post with id 'xyz' not found",
      resource: 'Post',
      id: 'xyz',
    });

    const validation = Errors.toJsonResponse(
      new Errors.ValidationError({
        message: 'Validation failed',
        errors: [{ path: 'title', message: 'Required' }],
      })
    );
    expect(validation.errors).toHaveLength(1);
  });

  test('type guards work correctly', () => {
    const auth = new Errors.InvalidCredentials({ message: 'Bad' });
    const resource = new Errors.NotFound({ resource: 'X', id: '1' });
    const infra = new Errors.DatabaseError({ message: 'Fail' });

    expect(Errors.isAuthError(auth)).toBe(true);
    expect(Errors.isAuthError(resource)).toBe(false);

    expect(Errors.isResourceError(resource)).toBe(true);
    expect(Errors.isResourceError(auth)).toBe(false);

    expect(Errors.isInfraError(infra)).toBe(true);
    expect(Errors.isInfraError(auth)).toBe(false);

    expect(Errors.isAppError(auth)).toBe(true);
    expect(Errors.isAppError(resource)).toBe(true);
    expect(Errors.isAppError(infra)).toBe(true);
    expect(Errors.isAppError(new Error('random'))).toBe(false);
  });
});
```

Run tests:
```bash
bun test
```

**Expected:**
```
bun test v1.1.x

src/errors.test.ts:
✓ Error System > NotFound generates correct message
✓ Error System > SlugConflict includes locale when provided
✓ Error System > SlugConflict without locale
✓ Error System > toHttpStatus maps correctly
✓ Error System > toJsonResponse includes correct fields
✓ Error System > type guards work correctly

 6 pass
 0 fail
```

---

## Task 0.5: Verification & Checklist

### Final Verification Script

Create `cms/scripts/verify-phase0.ts`:

```typescript
#!/usr/bin/env bun
/**
 * Phase 0 Verification Script
 * Checks all success criteria from the phase plan
 */

import { existsSync } from 'node:fs';
import { Pool } from 'pg';

const checks: Array<{ name: string; check: () => Promise<boolean> | boolean }> = [];

function addCheck(name: string, check: () => Promise<boolean> | boolean) {
  checks.push({ name, check });
}

// File existence checks
addCheck('package.json exists', () => existsSync('package.json'));
addCheck('tsconfig.json exists', () => existsSync('tsconfig.json'));
addCheck('.env exists', () => existsSync('.env'));
addCheck('.env.example exists', () => existsSync('.env.example'));
addCheck('src/types.ts exists', () => existsSync('src/types.ts'));
addCheck('src/errors.ts exists', () => existsSync('src/errors.ts'));
addCheck('db/migrations/ exists', () => existsSync('db/migrations'));

// Database checks
addCheck('Database connection works', async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
});

addCheck('All 8 tables exist', async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const tables = result.rows.map((r) => r.table_name);
    const required = [
      'api_keys',
      'categories',
      'galleries',
      'home',
      'media',
      'posts',
      'sessions',
      'users',
    ];
    return required.every((t) => tables.includes(t));
  } catch {
    return false;
  } finally {
    await pool.end();
  }
});

addCheck('Home singleton exists', async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query("SELECT id FROM home WHERE id = 'singleton'");
    return result.rowCount === 1;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
});

// Run all checks
async function main() {
  console.log('Phase 0 Verification\n' + '='.repeat(50) + '\n');

  let passed = 0;
  let failed = 0;

  for (const { name, check } of checks) {
    try {
      const result = await check();
      if (result) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${name} (error: ${error})`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\n⚠️  Phase 0 is NOT complete. Fix the failing checks above.');
    process.exit(1);
  } else {
    console.log('\n🎉 Phase 0 is complete! Proceed to Phase 1.');
    process.exit(0);
  }
}

main();
```

Run verification:
```bash
bun run scripts/verify-phase0.ts
```

---

### Success Criteria Checklist

Per PRD acceptance criteria:

| # | Criterion | PRD Reference | Verification |
|---|-----------|---------------|--------------|
| 1 | TypeScript compiles without errors | NFR-4.4.1 | `bun run typecheck` |
| 2 | All 8 database tables created | Section 6.2 | `bun run db:status` |
| 3 | Error types map to HTTP codes | Section 7.3 | `bun test` |
| 4 | Environment configuration complete | Appendix 16.2 | Check `.env` |
| 5 | Flat directory structure | NFR-4.4.4 | `tree src/` |
| 6 | Dependencies installed | Section 5 | `bun pm ls` |
| 7 | Git ignores sensitive files | SEC-9.3.3 | `git status` |

### Final Directory Structure

```
cms/
├── .env                              # Local config (NOT in git)
├── .env.example                      # Example config
├── .gitignore                        # Git ignore
├── .prettierrc                       # Prettier config
├── docker-compose.yml                # Local PostgreSQL
├── eslint.config.js                  # ESLint config
├── package.json                      # Dependencies
├── README.md                         # Documentation
├── tsconfig.json                     # TypeScript config
├── db/
│   ├── migrations/
│   │   └── YYYYMMDDHHMMSS_initial_schema.sql
│   └── schema.sql                    # Generated by dbmate
├── public/                           # Empty (for built SPA)
├── scripts/
│   └── verify-phase0.ts              # Verification script
└── src/
    ├── errors.test.ts                # Error tests
    ├── errors.ts                     # ~150 LOC
    └── types.ts                      # ~200 LOC
```

**Total Source Code:** ~350 lines

---

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker-compose ps

# Test connection manually
psql "$DATABASE_URL" -c "SELECT 1"

# Check DATABASE_URL format
echo $DATABASE_URL
# Should be: postgres://user:pass@host:port/dbname
```

### TypeScript Errors

```bash
# Ensure dependencies installed
bun install

# Check for missing types
bun add -d @types/pg @types/bun

# Clear cache and retry
rm -rf node_modules && bun install
```

### Migration Fails

```bash
# Check dbmate is installed
which dbmate

# Check migration syntax
cat db/migrations/*.sql | head -20

# Manual rollback and retry
bun run db:down
bun run db:up
```

---

## Next Steps

Phase 0 establishes the foundation. **Phase 1: Core Services** will build:

1. **DbService** - Kysely database layer
2. **Effect Schemas** - Request/response validation
3. **AuthService** - Password hashing, sessions
4. **StorageService** - R2 integration

**Estimated duration:** 5-7 days

---

## Document Information

| Field | Value |
|-------|-------|
| Phase | 0 - Setup & Foundation |
| PRD Version | 1.0.0 |
| Last Updated | December 2024 |
| Status | Ready for Implementation |
