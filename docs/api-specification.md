# API Specification (Strapi CMS)

> Comprehensive technical specification for the `api/` directory - a Strapi 5 headless CMS powering the ivokun.com blog/portfolio website.

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Configuration Reference](#configuration-reference)
5. [Content Types Specification](#content-types-specification)
6. [API Endpoints](#api-endpoints)
7. [Data Models & Relationships](#data-models--relationships)
8. [Authentication & Security](#authentication--security)
9. [File Storage](#file-storage)
10. [Deployment](#deployment)
11. [Development Guide](#development-guide)

---

## Overview

The API is a **Strapi 5.16.1** headless CMS application that provides content management capabilities for a blog/portfolio website. It serves as the backend for the Astro-based frontend (`web/`) and exposes RESTful APIs for content consumption.

### Key Features

- **Headless CMS**: Decoupled content management with REST API
- **Draft/Publish Workflow**: Content staging before publication
- **Internationalization (i18n)**: Multi-language support for posts
- **Media Management**: Cloudflare R2 storage integration
- **Role-Based Access Control**: Admin and public access separation
- **TypeScript**: Full type safety with auto-generated types

### Project Purpose

This API manages content for:
- Blog posts with rich text and block-based content
- Image galleries organized by categories
- Homepage content and SEO metadata
- Content categorization system

---

## Technology Stack

### Core Framework

| Component | Version | Description |
|-----------|---------|-------------|
| Strapi | 5.16.1 | Headless CMS framework |
| Node.js | >=22.17.0 | JavaScript runtime |
| Bun | >=1.1.38 | Package manager and runtime |
| TypeScript | (via @strapi/typescript-utils) | Type-safe development |

### Database

| Component | Version | Description |
|-----------|---------|-------------|
| PostgreSQL | - | Primary database |
| pg | 8.11.3 | PostgreSQL client for Node.js |
| pg-connection-string | 2.6.2 | Connection string parser |

### File Storage

| Component | Version | Description |
|-----------|---------|-------------|
| strapi-provider-cloudflare-r2 | 0.3.0 | Cloudflare R2 upload provider |

### Plugins

| Plugin | Version | Description |
|--------|---------|-------------|
| @strapi/plugin-users-permissions | 5.16.1 | User authentication and permissions |
| i18n | Built-in | Internationalization support |
| content-releases | Built-in | Scheduled content releases |

### Frontend Dependencies (Admin Panel)

| Component | Version | Description |
|-----------|---------|-------------|
| React | 18.0.0 | Admin panel UI framework |
| React DOM | 18.0.0 | React DOM renderer |
| React Router DOM | 6.28.1 | Admin panel routing |
| styled-components | 6.1.16 | CSS-in-JS styling |

---

## Architecture

### Directory Structure

```
api/
├── config/                          # Configuration files
│   ├── env/                         # Environment-specific configs
│   │   └── production/
│   │       └── database.ts          # Production database config
│   ├── admin.ts                     # Admin panel configuration
│   ├── api.ts                       # REST API configuration
│   ├── database.ts                  # Database connection config
│   ├── middlewares.ts               # Middleware stack config
│   ├── plugins.ts                   # Plugin configuration (R2)
│   └── server.ts                    # Server configuration
│
├── database/                        # Database files
│   └── migrations/                  # Database migrations
│       └── .gitkeep
│
├── public/                          # Static files
│   ├── uploads/                     # Local upload directory
│   │   └── .gitkeep
│   └── robots.txt                   # Search engine directives
│
├── src/                             # Source code
│   ├── admin/                       # Admin panel customizations
│   │   └── tsconfig.json            # Admin TypeScript config
│   │
│   ├── api/                         # Content type definitions
│   │   ├── category/                # Category content type
│   │   │   ├── content-types/
│   │   │   │   └── category/
│   │   │   │       └── schema.json  # Schema definition
│   │   │   ├── controllers/
│   │   │   │   └── category.ts      # Controller logic
│   │   │   ├── routes/
│   │   │   │   └── category.ts      # Route definitions
│   │   │   └── services/
│   │   │       └── category.ts      # Service layer
│   │   │
│   │   ├── gallery/                 # Gallery content type
│   │   │   ├── content-types/
│   │   │   │   └── gallery/
│   │   │   │       └── schema.json
│   │   │   ├── controllers/
│   │   │   │   └── gallery.ts
│   │   │   ├── routes/
│   │   │   │   └── gallery.ts
│   │   │   └── services/
│   │   │       └── gallery.ts
│   │   │
│   │   ├── home/                    # Home (Single Type)
│   │   │   ├── content-types/
│   │   │   │   └── home/
│   │   │   │       └── schema.json
│   │   │   ├── controllers/
│   │   │   │   └── home.ts
│   │   │   ├── routes/
│   │   │   │   └── home.ts
│   │   │   └── services/
│   │   │       └── home.ts
│   │   │
│   │   ├── post/                    # Post content type
│   │   │   ├── content-types/
│   │   │   │   └── post/
│   │   │   │       └── schema.json
│   │   │   ├── controllers/
│   │   │   │   └── post.ts
│   │   │   ├── routes/
│   │   │   │   └── post.ts
│   │   │   └── services/
│   │   │       └── post.ts
│   │   │
│   │   └── .gitkeep
│   │
│   ├── extensions/                  # Core extensions
│   │   └── .gitkeep
│   │
│   └── index.ts                     # Application entry point
│
├── types/                           # TypeScript definitions
│   └── generated/                   # Auto-generated types
│       ├── components.d.ts          # Component type definitions
│       └── contentTypes.d.ts        # Content type definitions
│
├── .env.example                     # Environment variables template
├── fly.toml                         # Fly.io deployment config
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
└── README.md                        # Project documentation
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Strapi 5 Core                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │ Admin Panel │    │  REST API   │    │ Document Service    │  │
│  │   (React)   │    │  Endpoints  │    │ (Data Access Layer) │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│         │                  │                      │             │
│         └──────────────────┼──────────────────────┘             │
│                            │                                    │
│  ┌─────────────────────────┴─────────────────────────────────┐  │
│  │                    Content Types                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │   Post   │  │ Category │  │ Gallery  │  │   Home   │   │  │
│  │  │(Collection)│(Collection)│(Collection)│ (Single)  │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                    │
│  ┌─────────────────────────┴─────────────────────────────────┐  │
│  │                      Plugins                              │  │
│  │  ┌────────────────┐  ┌─────────┐  ┌───────────────────┐   │  │
│  │  │ Users/Permissions│  │  i18n   │  │ Content Releases │   │  │
│  │  └────────────────┘  └─────────┘  └───────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                    │
└────────────────────────────┼────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
   │ PostgreSQL  │   │Cloudflare R2│   │   Fly.io    │
   │  Database   │   │   Storage   │   │  Hosting    │
   └─────────────┘   └─────────────┘   └─────────────┘
```

---

## Configuration Reference

### Server Configuration (`config/server.ts`)

```typescript
export default ({ env }) => ({
  host: env("HOST", "0.0.0.0"),      // Bind to all interfaces
  port: env.int("PORT", 1337),       // Default Strapi port
  app: {
    keys: env.array("APP_KEYS"),     // Application security keys
  },
  webhooks: {
    populateRelations: env.bool("WEBHOOKS_POPULATE_RELATIONS", false),
  },
});
```

### Database Configuration (`config/database.ts`)

```typescript
import { parse } from "pg-connection-string";
const config = parse(process.env.DATABASE_URL);

export default ({ env }) => ({
  connection: {
    client: "postgres",
    connection: {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: true,                     // SSL enabled for security
    },
    debug: false,
    acquireConnectionTimeout: env.int("DATABASE_CONNECTION_TIMEOUT", 60000),
  },
});
```

### API Configuration (`config/api.ts`)

```typescript
export default {
  rest: {
    defaultLimit: 25,    // Default pagination limit
    maxLimit: 100,       // Maximum items per request
    withCount: true,     // Include total count in responses
  },
};
```

### Admin Configuration (`config/admin.ts`)

```typescript
export default ({ env }) => ({
  auth: {
    secret: env("ADMIN_JWT_SECRET"),  // JWT secret for admin auth
  },
  apiToken: {
    salt: env("API_TOKEN_SALT"),      // Salt for API token hashing
  },
});
```

### Plugin Configuration (`config/plugins.ts`)

```typescript
export default ({ env }) => ({
  upload: {
    config: {
      provider: "strapi-provider-cloudflare-r2",
      providerOptions: {
        accessKeyId: env("R2_ACCESS_KEY_ID"),
        secretAccessKey: env("R2_ACCESS_SECRET"),
        endpoint: env("R2_ENDPOINT"),
        params: {
          Bucket: "ivokun-prod",       // R2 bucket name
        },
        cloudflarePublicAccessUrl: env("R2_PUBLIC_URL"),
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
});
```

### Middleware Configuration (`config/middlewares.ts`)

The middleware stack includes:

| Order | Middleware | Purpose |
|-------|------------|---------|
| 1 | strapi::errors | Error handling |
| 2 | strapi::cors | Cross-Origin Resource Sharing |
| 3 | strapi::poweredBy | X-Powered-By header |
| 4 | strapi::logger | Request logging |
| 5 | strapi::query | Query parameter parsing |
| 6 | strapi::body | Request body parsing |
| 7 | strapi::session | Session management |
| 8 | strapi::favicon | Favicon serving |
| 9 | strapi::public | Static file serving |
| 10 | strapi::security | CSP and security headers |

**Content Security Policy Configuration:**

```typescript
{
  name: "strapi::security",
  config: {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "connect-src": ["'self'", "https:"],
        "img-src": [
          "'self'", "data:", "blob:",
          "dl.airtable.com",
          "<R2_PUBLIC_URL>",
          "static.ivokun.com",
          "strapi.io",
          "market-assets.strapi.io",
        ],
        "media-src": [
          "'self'", "data:", "blob:",
          "dl.airtable.com",
          "static.ivokun.com",
          "<R2_PUBLIC_URL>",
        ],
        upgradeInsecureRequests: null,
      },
    },
  },
}
```

---

## Content Types Specification

### Post (Collection Type)

**API Identifier:** `api::post.post`

**Features:**
- Draft and Publish workflow enabled
- Internationalization (i18n) enabled
- Localized fields for multi-language content

**Schema Definition:**

| Field | Type | Localized | Required | Description |
|-------|------|-----------|----------|-------------|
| `title` | String | Yes | No | Post title |
| `slug` | UID | No | No | URL-friendly identifier (auto-generated from title) |
| `excerpt` | String | Yes | No | Short summary of the post |
| `content` | RichText | Yes | No | Legacy rich text content (Markdown) |
| `richContent` | Blocks | Yes | No | Block-based rich content (Strapi 5) |
| `featuredPicture` | Media | Yes | No | Featured image (single file) |
| `readTimeMinute` | Integer | Yes | No | Estimated reading time in minutes |
| `category` | Relation | No | No | Many-to-One relation to Category |

**Relation Details:**
```json
{
  "category": {
    "type": "relation",
    "relation": "manyToOne",
    "target": "api::category.category",
    "inversedBy": "posts"
  }
}
```

**TypeScript Interface:**
```typescript
interface Post {
  id: number;
  documentId: string;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  content: string | null;           // RichText (Markdown)
  richContent: BlocksContent | null; // Strapi Blocks
  featuredPicture: Media | null;
  readTimeMinute: number | null;
  category: Category | null;
  locale: string;
  localizations: Post[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}
```

---

### Category (Collection Type)

**API Identifier:** `api::category.category`

**Features:**
- Draft and Publish workflow enabled
- No internationalization

**Schema Definition:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | String | No | Category name |
| `slug` | UID | No | URL-friendly identifier (auto-generated from name) |
| `description` | RichText | No | Category description |
| `posts` | Relation | No | One-to-Many relation to Posts |
| `galleries` | Relation | No | One-to-Many relation to Galleries |

**Relation Details:**
```json
{
  "posts": {
    "type": "relation",
    "relation": "oneToMany",
    "target": "api::post.post",
    "mappedBy": "category"
  },
  "galleries": {
    "type": "relation",
    "relation": "oneToMany",
    "target": "api::gallery.gallery",
    "mappedBy": "category"
  }
}
```

**TypeScript Interface:**
```typescript
interface Category {
  id: number;
  documentId: string;
  name: string | null;
  slug: string | null;
  description: string | null;  // RichText (Markdown)
  posts: Post[];
  galleries: Gallery[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}
```

---

### Gallery (Collection Type)

**API Identifier:** `api::gallery.gallery`

**Features:**
- Draft and Publish workflow enabled
- No internationalization

**Schema Definition:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | String | No | Gallery title |
| `slug` | UID | No | URL-friendly identifier (auto-generated from title) |
| `description` | RichText | No | Gallery description |
| `images` | Media | No | Multiple media files (images, videos, etc.) |
| `category` | Relation | No | Many-to-One relation to Category |

**Relation Details:**
```json
{
  "category": {
    "type": "relation",
    "relation": "manyToOne",
    "target": "api::category.category",
    "inversedBy": "galleries"
  }
}
```

**Media Field Configuration:**
```json
{
  "images": {
    "type": "media",
    "multiple": true,
    "required": false,
    "allowedTypes": ["images", "files", "videos", "audios"]
  }
}
```

**TypeScript Interface:**
```typescript
interface Gallery {
  id: number;
  documentId: string;
  title: string | null;
  slug: string | null;
  description: string | null;  // RichText (Markdown)
  images: Media[];             // Multiple media files
  category: Category | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}
```

---

### Home (Single Type)

**API Identifier:** `api::home.home`

**Features:**
- Draft and Publish workflow enabled
- Single Type (only one instance exists)
- No internationalization

**Schema Definition:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | String | No | Homepage title |
| `shortDescription` | String | No | Brief tagline or description |
| `description` | RichText | No | Full homepage description |
| `hero` | Media | No | Hero image/video (single file) |
| `keywords` | String | No | SEO keywords |

**TypeScript Interface:**
```typescript
interface Home {
  id: number;
  documentId: string;
  title: string | null;
  shortDescription: string | null;
  description: string | null;  // RichText (Markdown)
  hero: Media | null;
  keywords: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}
```

---

## API Endpoints

### REST API Base URL

- **Development:** `http://localhost:1337/api`
- **Production:** `https://ivokun-api.fly.dev/api`

### Posts Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/posts` | List all published posts | Public |
| GET | `/api/posts/:documentId` | Get a specific post | Public |
| POST | `/api/posts` | Create a new post | Admin |
| PUT | `/api/posts/:documentId` | Update a post | Admin |
| DELETE | `/api/posts/:documentId` | Delete a post | Admin |

**Query Parameters:**

```
# Pagination
?pagination[page]=1
?pagination[pageSize]=25
?pagination[start]=0
?pagination[limit]=25

# Sorting
?sort=createdAt:desc
?sort[0]=title:asc&sort[1]=createdAt:desc

# Filtering
?filters[title][$contains]=hello
?filters[category][slug][$eq]=technology
?filters[publishedAt][$notNull]=true

# Population (relations & media)
?populate=*
?populate[category]=*
?populate[featuredPicture][fields][0]=url
?populate=category,featuredPicture

# Field Selection
?fields[0]=title&fields[1]=slug&fields[2]=excerpt

# Localization
?locale=en
?locale=id
```

**Example Response:**

```json
{
  "data": [
    {
      "id": 1,
      "documentId": "abc123def456",
      "attributes": {
        "title": "Getting Started with Strapi 5",
        "slug": "getting-started-with-strapi-5",
        "excerpt": "Learn how to build APIs with Strapi 5",
        "content": "# Introduction\n\nStrapi 5 is...",
        "richContent": [...],
        "readTimeMinute": 5,
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-15T12:00:00.000Z",
        "publishedAt": "2024-01-15T12:00:00.000Z",
        "locale": "en",
        "featuredPicture": {
          "data": {
            "id": 10,
            "attributes": {
              "url": "https://static.ivokun.com/image.jpg",
              "width": 1200,
              "height": 630
            }
          }
        },
        "category": {
          "data": {
            "id": 2,
            "attributes": {
              "name": "Technology",
              "slug": "technology"
            }
          }
        }
      }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 4,
      "total": 100
    }
  }
}
```

---

### Categories Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/categories` | List all categories | Public |
| GET | `/api/categories/:documentId` | Get a specific category | Public |
| POST | `/api/categories` | Create a new category | Admin |
| PUT | `/api/categories/:documentId` | Update a category | Admin |
| DELETE | `/api/categories/:documentId` | Delete a category | Admin |

**Example - Get Category with Posts:**

```
GET /api/categories/abc123?populate[posts][fields][0]=title&populate[posts][fields][1]=slug
```

---

### Galleries Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/galleries` | List all galleries | Public |
| GET | `/api/galleries/:documentId` | Get a specific gallery | Public |
| POST | `/api/galleries` | Create a new gallery | Admin |
| PUT | `/api/galleries/:documentId` | Update a gallery | Admin |
| DELETE | `/api/galleries/:documentId` | Delete a gallery | Admin |

**Example - Get Gallery with Images:**

```
GET /api/galleries/abc123?populate=images,category
```

---

### Home Endpoint (Single Type)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/home` | Get homepage content | Public |
| PUT | `/api/home` | Update homepage content | Admin |
| DELETE | `/api/home` | Delete homepage content | Admin |

**Example Response:**

```json
{
  "data": {
    "id": 1,
    "documentId": "home123",
    "attributes": {
      "title": "Welcome to My Portfolio",
      "shortDescription": "Software Engineer & Photographer",
      "description": "# About Me\n\nI'm a...",
      "keywords": "software, engineering, photography",
      "hero": {
        "data": {
          "id": 5,
          "attributes": {
            "url": "https://static.ivokun.com/hero.jpg"
          }
        }
      }
    }
  },
  "meta": {}
}
```

---

## Data Models & Relationships

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONTENT TYPES                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│      POST       │         │    CATEGORY     │         │     GALLERY     │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ id              │         │ id              │         │ id              │
│ documentId      │         │ documentId      │         │ documentId      │
│ title      [i18n]│         │ name            │         │ title           │
│ slug            │         │ slug            │         │ slug            │
│ excerpt    [i18n]│         │ description     │         │ description     │
│ content    [i18n]│         │ createdAt       │         │ images [media[]]│
│ richContent[i18n]│         │ updatedAt       │         │ createdAt       │
│ featuredPicture │         │ publishedAt     │         │ updatedAt       │
│ readTimeMinute  │         └────────┬────────┘         │ publishedAt     │
│ category_id  ───┼─────────────────►│◄─────────────────┼── category_id   │
│ locale          │                  │                  └─────────────────┘
│ localizations[] │                  │
│ createdAt       │         ┌────────┴────────┐
│ updatedAt       │         │   Relations:    │
│ publishedAt     │         │ - posts[]       │
└─────────────────┘         │ - galleries[]   │
                            └─────────────────┘

┌─────────────────┐
│      HOME       │
├─────────────────┤
│ id              │  (Single Type - Only 1 instance)
│ documentId      │
│ title           │
│ shortDescription│
│ description     │
│ hero [media]    │
│ keywords        │
│ createdAt       │
│ updatedAt       │
│ publishedAt     │
└─────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        RELATIONSHIPS                                │
└─────────────────────────────────────────────────────────────────────┘

Post ──────────── Many-to-One ────────────► Category
                       │
                       │ (inversedBy: posts)
                       ▼
Category ◄──────── One-to-Many ──────────── Post[]

Gallery ────────── Many-to-One ────────────► Category
                       │
                       │ (inversedBy: galleries)
                       ▼
Category ◄──────── One-to-Many ──────────── Gallery[]

Post ──────────── One-to-Many ────────────► Post[] (localizations)
```

### Relationship Summary

| From | Relation | To | Field |
|------|----------|-----|-------|
| Post | Many-to-One | Category | `category` |
| Category | One-to-Many | Post | `posts` |
| Gallery | Many-to-One | Category | `category` |
| Category | One-to-Many | Gallery | `galleries` |
| Post | One-to-Many | Post | `localizations` (i18n) |

---

## Authentication & Security

### Authentication Methods

#### 1. Admin JWT Authentication

Used for accessing the admin panel and admin-level API operations.

```typescript
// config/admin.ts
{
  auth: {
    secret: env("ADMIN_JWT_SECRET"),
  }
}
```

#### 2. API Tokens

Used for programmatic API access.

| Token Type | Access Level | Use Case |
|------------|--------------|----------|
| `read-only` | GET requests only | Public API consumers |
| `full-access` | All CRUD operations | Trusted applications |
| `custom` | Configurable per-endpoint | Fine-grained control |

**Using API Tokens:**

```bash
curl -X GET "https://api.ivokun.com/api/posts" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

#### 3. User Authentication (Users & Permissions Plugin)

Standard user authentication with JWT tokens.

```bash
# Login
POST /api/auth/local
{
  "identifier": "user@example.com",
  "password": "password123"
}

# Response
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "user",
    "email": "user@example.com"
  }
}
```

### Security Headers (Content Security Policy)

The middleware configuration includes strict CSP directives:

| Directive | Allowed Sources |
|-----------|-----------------|
| `connect-src` | `'self'`, `https:` |
| `img-src` | `'self'`, `data:`, `blob:`, Cloudflare R2, static.ivokun.com |
| `media-src` | `'self'`, `data:`, `blob:`, Cloudflare R2, static.ivokun.com |

### Environment Variables for Security

| Variable | Description | Required |
|----------|-------------|----------|
| `ADMIN_JWT_SECRET` | Secret for admin panel JWT | Yes |
| `API_TOKEN_SALT` | Salt for hashing API tokens | Yes |
| `APP_KEYS` | Application security keys (comma-separated) | Yes |
| `JWT_SECRET` | Secret for user JWT tokens | Yes |
| `TRANSFER_TOKEN_SALT` | Salt for transfer tokens | Yes |

---

## File Storage

### Cloudflare R2 Configuration

The API uses Cloudflare R2 (S3-compatible) for media storage.

**Provider:** `strapi-provider-cloudflare-r2`

**Configuration:**

```typescript
{
  upload: {
    config: {
      provider: "strapi-provider-cloudflare-r2",
      providerOptions: {
        accessKeyId: env("R2_ACCESS_KEY_ID"),
        secretAccessKey: env("R2_ACCESS_SECRET"),
        endpoint: env("R2_ENDPOINT"),
        params: {
          Bucket: "ivokun-prod",
        },
        cloudflarePublicAccessUrl: env("R2_PUBLIC_URL"),
      },
    },
  },
}
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `R2_ACCESS_KEY_ID` | R2 access key ID | `abc123...` |
| `R2_ACCESS_SECRET` | R2 secret access key | `xyz789...` |
| `R2_ENDPOINT` | R2 S3-compatible endpoint | `https://xxx.r2.cloudflarestorage.com` |
| `R2_PUBLIC_URL` | Public URL for accessing files | `https://static.ivokun.com` |

### Media Response Format

```json
{
  "data": {
    "id": 10,
    "attributes": {
      "name": "hero-image.jpg",
      "alternativeText": "Hero image description",
      "caption": "Photo by Author",
      "width": 1920,
      "height": 1080,
      "formats": {
        "thumbnail": {
          "url": "https://static.ivokun.com/thumbnail_hero-image.jpg",
          "width": 245,
          "height": 138
        },
        "small": {
          "url": "https://static.ivokun.com/small_hero-image.jpg",
          "width": 500,
          "height": 281
        },
        "medium": {
          "url": "https://static.ivokun.com/medium_hero-image.jpg",
          "width": 750,
          "height": 422
        },
        "large": {
          "url": "https://static.ivokun.com/large_hero-image.jpg",
          "width": 1000,
          "height": 563
        }
      },
      "hash": "hero_image_abc123",
      "ext": ".jpg",
      "mime": "image/jpeg",
      "size": 245.67,
      "url": "https://static.ivokun.com/hero-image.jpg",
      "provider": "strapi-provider-cloudflare-r2"
    }
  }
}
```

---

## Deployment

### Fly.io Configuration

**File:** `fly.toml`

```toml
app = "ivokun-api"
kill_signal = "SIGINT"
kill_timeout = 5

[env]
# Environment variables set via fly secrets

[experimental]
allowed_public_ports = []
auto_rollback = true

[[services]]
internal_port = 1337
protocol = "tcp"

[services.concurrency]
hard_limit = 25
soft_limit = 20
type = "connections"

[[services.ports]]
force_https = true
handlers = ["http"]
port = 80

[[services.ports]]
handlers = ["tls", "http"]
port = 443

[[services.tcp_checks]]
grace_period = "1s"
interval = "15s"
restart_limit = 0
timeout = "2s"
```

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `DATABASE_CONNECTION_TIMEOUT` | Connection timeout (ms) | No (default: 60000) |
| `HOST` | Server host | No (default: 0.0.0.0) |
| `PORT` | Server port | No (default: 1337) |
| `APP_KEYS` | Security keys (comma-separated) | Yes |
| `ADMIN_JWT_SECRET` | Admin JWT secret | Yes |
| `API_TOKEN_SALT` | API token salt | Yes |
| `JWT_SECRET` | User JWT secret | Yes |
| `TRANSFER_TOKEN_SALT` | Transfer token salt | Yes |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key | Yes |
| `R2_ACCESS_SECRET` | Cloudflare R2 secret | Yes |
| `R2_ENDPOINT` | Cloudflare R2 endpoint | Yes |
| `R2_PUBLIC_URL` | Public URL for media | Yes |

### Deployment Commands

```bash
# Deploy to Fly.io
fly deploy

# Set secrets
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set ADMIN_JWT_SECRET="your-secret"

# View logs
fly logs

# SSH into container
fly ssh console
```

---

## Development Guide

### Prerequisites

- Node.js >= 22.17.0
- Bun >= 1.1.38
- PostgreSQL database
- Cloudflare R2 bucket (for media storage)

### Environment Setup

1. **Copy environment template:**

```bash
cp .env.example .env
```

2. **Configure environment variables:**

```bash
# .env
HOST=0.0.0.0
PORT=1337
APP_KEYS="key1,key2"
API_TOKEN_SALT=your-api-token-salt
ADMIN_JWT_SECRET=your-admin-jwt-secret
JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql://user:password@localhost:5432/strapi

# Cloudflare R2 (optional for local dev)
R2_ACCESS_KEY_ID=your-access-key
R2_ACCESS_SECRET=your-secret
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://static.ivokun.com
```

### NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `develop` | `strapi develop` | Start development server with hot reload |
| `start` | `strapi start` | Start production server |
| `build` | `strapi build` | Build admin panel for production |
| `strapi` | `strapi` | Access Strapi CLI |

### Development Commands

```bash
# Install dependencies
bun install

# Start development server
bun run develop

# Build for production
bun run build

# Start production server
bun run start

# Generate TypeScript types
bun run strapi ts:generate-types
```

### Accessing the Application

| Interface | URL | Description |
|-----------|-----|-------------|
| Admin Panel | `http://localhost:1337/admin` | Content management interface |
| REST API | `http://localhost:1337/api` | API endpoints |
| API Documentation | `http://localhost:1337/documentation` | Swagger docs (if enabled) |

### Creating Content Types

Strapi provides a Content-Type Builder in the admin panel, but content types can also be created manually:

1. Create directory structure:
```
src/api/{content-type}/
├── content-types/
│   └── {content-type}/
│       └── schema.json
├── controllers/
│   └── {content-type}.ts
├── routes/
│   └── {content-type}.ts
└── services/
    └── {content-type}.ts
```

2. Define schema in `schema.json`
3. Use factory functions for controller, router, and service:

```typescript
// controllers/{content-type}.ts
import { factories } from "@strapi/strapi";
export default factories.createCoreController("api::{content-type}.{content-type}");

// routes/{content-type}.ts
import { factories } from "@strapi/strapi";
export default factories.createCoreRouter("api::{content-type}.{content-type}");

// services/{content-type}.ts
import { factories } from "@strapi/strapi";
export default factories.createCoreService("api::{content-type}.{content-type}");
```

### TypeScript Support

The project uses TypeScript with auto-generated types:

- **Config:** `tsconfig.json` extends `@strapi/typescript-utils/tsconfigs/server`
- **Generated Types:** `types/generated/contentTypes.d.ts`
- **Regenerate Types:** Run `bun run strapi ts:generate-types`

### Admin Panel Customization

Custom admin configurations are placed in `src/admin/`:

- `tsconfig.json` - TypeScript config extending `@strapi/typescript-utils/tsconfigs/admin`
- Custom components and plugins can be added here

---

## Appendix

### Strapi 5 Document Service API

Strapi 5 uses the Document Service API (replaces Entity Service):

```typescript
// Find documents
const posts = await strapi.documents("api::post.post").findMany({
  filters: { title: { $contains: "Hello" } },
  populate: ["category", "featuredPicture"],
  locale: "en",
});

// Find one document
const post = await strapi.documents("api::post.post").findOne({
  documentId: "abc123",
  populate: "*",
});

// Create document
const newPost = await strapi.documents("api::post.post").create({
  data: { title: "New Post", slug: "new-post" },
  locale: "en",
});

// Update document
const updated = await strapi.documents("api::post.post").update({
  documentId: "abc123",
  data: { title: "Updated Title" },
});

// Delete document
await strapi.documents("api::post.post").delete({
  documentId: "abc123",
});

// Publish document
await strapi.documents("api::post.post").publish({
  documentId: "abc123",
});

// Unpublish document
await strapi.documents("api::post.post").unpublish({
  documentId: "abc123",
});
```

### Useful Resources

- [Strapi 5 Documentation](https://docs.strapi.io/)
- [Strapi REST API Reference](https://docs.strapi.io/dev-docs/api/rest)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Fly.io Documentation](https://fly.io/docs/)

---

*Last updated: December 2024*
*Strapi Version: 5.16.1*
