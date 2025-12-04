# ivokun CMS - Product Requirements Document (PRD)

> **Version:** 1.0.0  
> **Last Updated:** 05 December 2025  
> **Status:** Approved for Implementation  
> **Owner:** ivokun

---

## Executive Summary

This document defines the complete requirements for building a custom headless CMS to replace the existing Strapi installation. The new CMS will be a lightweight, single-binary application built with Effect TS, Kysely, and Bun, designed for deployment on NixOS infrastructure via clan.lol.

### Key Objectives

1. **Simplify Infrastructure** - Replace Strapi with a single compiled binary
2. **Improve Performance** - Faster API responses, smaller memory footprint
3. **Maintain Feature Parity** - All current Strapi features must be replicated
4. **Enable Self-Hosting** - Full control over deployment and data
5. **Future-Proof Architecture** - Clean, maintainable codebase using modern patterns

### Success Metrics

| Metric                  | Target      | Measurement               |
| ----------------------- | ----------- | ------------------------- |
| API Response Time (p95) | < 200ms     | Application monitoring    |
| Binary Size             | < 50MB      | Build output              |
| Memory Usage            | < 256MB     | Runtime monitoring        |
| Admin Page Load         | < 2 seconds | Lighthouse/Web Vitals     |
| Migration Data Loss     | 0%          | Post-migration audit      |
| Uptime                  | 99.9%       | Infrastructure monitoring |

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [User Personas](#2-user-personas)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [System Architecture](#5-system-architecture)
6. [Data Model](#6-data-model)
7. [API Specification](#7-api-specification)
8. [User Interface Requirements](#8-user-interface-requirements)
9. [Security Requirements](#9-security-requirements)
10. [Integration Requirements](#10-integration-requirements)
11. [Migration Requirements](#11-migration-requirements)
12. [Deployment Requirements](#12-deployment-requirements)
13. [Constraints & Assumptions](#13-constraints--assumptions)
14. [Out of Scope](#14-out-of-scope)
15. [Acceptance Criteria](#15-acceptance-criteria)
16. [Appendix](#16-appendix)

---

## 1. Problem Statement

### Current State

The ivokun.com blog currently uses **Strapi CMS** deployed on AWS Lambda. While Strapi has served well initially, several pain points have emerged:

1. **Infrastructure Complexity**

   - Strapi requires Node.js runtime + PostgreSQL + S3-compatible storage
   - Updates and maintenance require careful coordination
   - Deployment is not declarative (NixOS incompatible)

2. **Resource Usage**

   - Strapi uses 300-500MB RAM at idle
   - Cold starts take 5-10 seconds
   - Node.js overhead for simple CRUD operations

3. **Vendor Lock-in Concerns**

   - Strapi's content model changes between major versions
   - Plugin ecosystem compatibility issues
   - Limited control over internal behavior

4. **Operational Challenges**
   - No single-binary deployment option
   - Database migrations tied to Strapi's lifecycle
   - Admin panel bundled with backend

### Desired State

A **custom-built CMS** that:

- Compiles to a **single binary** (~20-50MB)
- Uses **< 256MB RAM** at runtime
- Deploys declaratively via **NixOS/clan.lol**
- Provides **full feature parity** with current Strapi setup
- Is **fully self-hosted** with no external service dependencies
- Uses **functional programming patterns** for maintainability

---

## 2. User Personas

### 2.1 Content Author (Primary)

**Profile:** The blog owner who creates and publishes content.

**Goals:**

- Write and publish blog posts efficiently
- Manage photo galleries
- Upload and organize media files
- Preview content before publishing
- Switch between English and Indonesian content

**Pain Points:**

- Wants simple, fast interface
- Dislikes complex content management workflows
- Needs reliable image handling

**Usage Patterns:**

- Creates 2-4 posts per month
- Uploads 10-20 images per month
- Accesses admin panel from desktop browser
- Usually works in single sessions (1-2 hours)

### 2.2 Blog Frontend (Consumer)

**Profile:** The Astro-based blog that consumes the API.

**Goals:**

- Fetch published posts with category information
- Retrieve optimized images in multiple sizes
- Get homepage content
- Load content quickly for static site generation

**Requirements:**

- RESTful JSON API
- API key authentication
- Consistent response format
- Pagination support

### 2.3 System Administrator (Occasional)

**Profile:** Person managing the NixOS infrastructure.

**Goals:**

- Deploy and update CMS easily
- Monitor system health
- Manage backups
- Rotate credentials

**Requirements:**

- Single binary deployment
- Clear environment variable configuration
- Database migration support
- Health check endpoints

---

## 3. Functional Requirements

### 3.1 Content Management

#### FR-3.1.1 Blog Posts

| ID          | Requirement                                             | Priority |
| ----------- | ------------------------------------------------------- | -------- |
| FR-3.1.1.1  | Create new blog post with title, slug, excerpt, content | P0       |
| FR-3.1.1.2  | Edit existing blog post                                 | P0       |
| FR-3.1.1.3  | Delete blog post with confirmation                      | P0       |
| FR-3.1.1.4  | Save post as draft (not publicly visible)               | P0       |
| FR-3.1.1.5  | Publish post (make publicly visible)                    | P0       |
| FR-3.1.1.6  | Unpublish post (revert to draft)                        | P0       |
| FR-3.1.1.7  | Assign post to category                                 | P0       |
| FR-3.1.1.8  | Set featured image for post                             | P0       |
| FR-3.1.1.9  | Set post locale (en/id)                                 | P0       |
| FR-3.1.1.10 | Auto-generate slug from title                           | P1       |
| FR-3.1.1.11 | Calculate estimated read time                           | P2       |
| FR-3.1.1.12 | List all posts with filters (status, locale, category)  | P0       |
| FR-3.1.1.13 | Paginate post list                                      | P0       |
| FR-3.1.1.14 | Sort posts by created date (default)                    | P0       |

**Post Data Structure:**

```typescript
interface Post {
  id: string; // CUID2
  title: string; // Required, non-empty
  slug: string; // Required, URL-safe, unique per locale
  excerpt: string | null;
  content: TipTapJSON | null;
  featured_image: string | null; // Media ID reference
  read_time_minute: number | null;
  category_id: string | null;
  locale: 'en' | 'id';
  status: 'draft' | 'published';
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
```

#### FR-3.1.2 Categories

| ID         | Requirement                                  | Priority |
| ---------- | -------------------------------------------- | -------- |
| FR-3.1.2.1 | Create category with name, slug, description | P0       |
| FR-3.1.2.2 | Edit category                                | P0       |
| FR-3.1.2.3 | Delete category (nullifies post references)  | P0       |
| FR-3.1.2.4 | List all categories                          | P0       |
| FR-3.1.2.5 | Enforce unique slug                          | P0       |

**Category Data Structure:**

```typescript
interface Category {
  id: string;
  name: string;
  slug: string; // Unique
  description: string | null;
  created_at: Date;
  updated_at: Date;
}
```

#### FR-3.1.3 Galleries

| ID         | Requirement                                  | Priority |
| ---------- | -------------------------------------------- | -------- |
| FR-3.1.3.1 | Create gallery with title, slug, description | P0       |
| FR-3.1.3.2 | Add multiple images to gallery               | P0       |
| FR-3.1.3.3 | Reorder images in gallery                    | P1       |
| FR-3.1.3.4 | Remove images from gallery                   | P0       |
| FR-3.1.3.5 | Edit gallery metadata                        | P0       |
| FR-3.1.3.6 | Delete gallery                               | P0       |
| FR-3.1.3.7 | Publish/unpublish gallery                    | P0       |
| FR-3.1.3.8 | Assign gallery to category                   | P1       |

**Gallery Data Structure:**

```typescript
interface Gallery {
  id: string;
  title: string;
  slug: string; // Unique
  description: string | null;
  images: string[]; // Array of Media IDs
  category_id: string | null;
  status: 'draft' | 'published';
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
```

#### FR-3.1.4 Homepage Content

| ID         | Requirement                | Priority |
| ---------- | -------------------------- | -------- |
| FR-3.1.4.1 | Edit homepage title        | P0       |
| FR-3.1.4.2 | Edit short description     | P0       |
| FR-3.1.4.3 | Edit rich text description | P0       |
| FR-3.1.4.4 | Set hero image             | P0       |
| FR-3.1.4.5 | Set SEO keywords           | P1       |

**Home Data Structure:**

```typescript
interface Home {
  id: 'singleton'; // Always 'singleton'
  title: string | null;
  short_description: string | null;
  description: TipTapJSON | null;
  hero: string | null; // Media ID
  keywords: string | null;
  updated_at: Date;
}
```

### 3.2 Media Management

| ID        | Requirement                                            | Priority |
| --------- | ------------------------------------------------------ | -------- |
| FR-3.2.1  | Upload images (PNG, JPG, WebP, GIF)                    | P0       |
| FR-3.2.2  | Auto-generate image variants (thumbnail, small, large) | P0       |
| FR-3.2.3  | Convert all images to WebP format                      | P0       |
| FR-3.2.4  | Store images in Cloudflare R2                          | P0       |
| FR-3.2.5  | Display media library with thumbnails                  | P0       |
| FR-3.2.6  | Delete media (removes from R2)                         | P0       |
| FR-3.2.7  | Edit alt text for accessibility                        | P0       |
| FR-3.2.8  | Pick media from library for posts/galleries            | P0       |
| FR-3.2.9  | Upload via drag-and-drop                               | P1       |
| FR-3.2.10 | Show upload progress                                   | P1       |

**Media Data Structure:**

```typescript
interface Media {
  id: string;
  filename: string;
  mime_type: string;
  size: number; // Bytes
  alt: string | null;
  urls: {
    original: string; // Full size, WebP
    thumbnail: string; // 200px wide
    small: string; // 800px wide
    large: string; // 1920px wide
  };
  width: number | null;
  height: number | null;
  created_at: Date;
}
```

**Image Processing Requirements:**

| Variant   | Max Width | Quality | Use Case                 |
| --------- | --------- | ------- | ------------------------ |
| Original  | As-is     | 90%     | Download, full-size view |
| Thumbnail | 200px     | 80%     | Admin lists, previews    |
| Small     | 800px     | 85%     | Mobile devices           |
| Large     | 1920px    | 85%     | Desktop, featured images |

### 3.3 Rich Text Editor

| ID       | Requirement                                      | Priority |
| -------- | ------------------------------------------------ | -------- |
| FR-3.3.1 | Format text: bold, italic, strikethrough         | P0       |
| FR-3.3.2 | Create headings (H2, H3, H4)                     | P0       |
| FR-3.3.3 | Create bullet and numbered lists                 | P0       |
| FR-3.3.4 | Create blockquotes                               | P0       |
| FR-3.3.5 | Create code blocks with syntax highlighting      | P1       |
| FR-3.3.6 | Insert links                                     | P0       |
| FR-3.3.7 | Insert images from media library                 | P0       |
| FR-3.3.8 | Upload images directly into editor               | P0       |
| FR-3.3.9 | Store content as structured JSON (TipTap format) | P0       |

### 3.4 API Key Management

| ID       | Requirement                          | Priority |
| -------- | ------------------------------------ | -------- |
| FR-3.4.1 | Generate new API key                 | P0       |
| FR-3.4.2 | Show key only once on creation       | P0       |
| FR-3.4.3 | Name API key for identification      | P0       |
| FR-3.4.4 | List all API keys (show prefix only) | P0       |
| FR-3.4.5 | Revoke/delete API key                | P0       |
| FR-3.4.6 | Track last usage time                | P1       |

**API Key Data Structure:**

```typescript
interface ApiKey {
  id: string;
  name: string;
  key_hash: string; // Argon2 hash
  prefix: string; // First 8 chars for lookup
  last_used_at: Date | null;
  created_at: Date;
}
```

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID        | Requirement                       | Target      |
| --------- | --------------------------------- | ----------- |
| NFR-4.1.1 | Public API response time (p95)    | < 200ms     |
| NFR-4.1.2 | Admin API response time (p95)     | < 500ms     |
| NFR-4.1.3 | Image upload processing time      | < 5 seconds |
| NFR-4.1.4 | Admin page initial load           | < 2 seconds |
| NFR-4.1.5 | Admin SPA navigation              | < 500ms     |
| NFR-4.1.6 | Concurrent API requests supported | 100+        |

### 4.2 Scalability

| ID        | Requirement                          |
| --------- | ------------------------------------ |
| NFR-4.2.1 | Support up to 10,000 posts           |
| NFR-4.2.2 | Support up to 50,000 media files     |
| NFR-4.2.3 | Handle 100 concurrent admin sessions |
| NFR-4.2.4 | Handle 1000 concurrent API requests  |

### 4.3 Reliability

| ID        | Requirement                | Target  |
| --------- | -------------------------- | ------- |
| NFR-4.3.1 | System uptime              | 99.9%   |
| NFR-4.3.2 | Data durability            | 99.999% |
| NFR-4.3.3 | Automatic restart on crash | Yes     |
| NFR-4.3.4 | Graceful shutdown handling | Yes     |

### 4.4 Maintainability

| ID        | Requirement                               |
| --------- | ----------------------------------------- |
| NFR-4.4.1 | 100% TypeScript with strict mode          |
| NFR-4.4.2 | Effect TS for all async operations        |
| NFR-4.4.3 | Maximum 6 core source files initially     |
| NFR-4.4.4 | Flat directory structure                  |
| NFR-4.4.5 | Tagged error types (no thrown exceptions) |
| NFR-4.4.6 | Comprehensive JSDoc comments              |

### 4.5 Compatibility

| ID        | Requirement                                   |
| --------- | --------------------------------------------- |
| NFR-4.5.1 | Admin UI: Chrome 90+, Firefox 90+, Safari 14+ |
| NFR-4.5.2 | Node.js 22+ compatibility                     |
| NFR-4.5.3 | Bun 1.1+ runtime                              |
| NFR-4.5.4 | PostgreSQL 16+                                |

---

## 5. System Architecture

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ivokun CMS (Single Binary)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    Effect TS Runtime                            │  │
│  │                                                                  │  │
│  │   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │  │
│  │   │ HTTP Server  │   │   Services   │   │ Image Processing │    │  │
│  │   │   (Routes)   │──▶│   (Logic)    │──▶│  (Sharp + R2)    │    │  │
│  │   └──────────────┘   └──────────────┘   └──────────────────┘    │  │
│  │           │                  │                    │              │  │
│  │           ▼                  ▼                    ▼              │  │
│  │   ┌──────────────────────────────────────────────────────────┐  │  │
│  │   │               Effect Layer System                         │  │  │
│  │   │  DbService | StorageService | AuthService | etc.          │  │  │
│  │   └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                               │                                       │
│         ┌─────────────────────┼─────────────────────┐                │
│         ▼                     ▼                     ▼                │
│  ┌───────────────┐   ┌────────────────┐   ┌─────────────────────┐   │
│  │  PostgreSQL   │   │ Cloudflare R2  │   │ Static SPA Assets   │   │
│  │   (Kysely)    │   │   (S3 API)     │   │    (/admin)         │   │
│  └───────────────┘   └────────────────┘   └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Request Flow

#### Public API Request Flow

```
Blog (Static Site Generator)
        │
        │ GET /api/posts
        │ Header: X-Api-Key: cms_xxx
        ▼
┌─────────────────────────────────┐
│     API Key Middleware          │
│  - Extract key from header      │
│  - Lookup by prefix             │
│  - Verify hash with Argon2      │
│  - Update last_used_at          │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│        Route Handler            │
│  - Parse query params           │
│  - Call PostService.findMany()  │
│  - Format response              │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│       PostService               │
│  - Build Kysely query           │
│  - Execute against PostgreSQL   │
│  - Map to response schema       │
└─────────────────────────────────┘
        │
        ▼
     JSON Response
```

#### Admin API Request Flow

```
Admin SPA (Browser)
        │
        │ POST /admin/api/posts
        │ Cookie: session=xxx
        ▼
┌─────────────────────────────────┐
│     Session Middleware          │
│  - Parse session cookie         │
│  - Lookup session in DB         │
│  - Validate expiration          │
│  - Attach userId to context     │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│     Validation Middleware       │
│  - Parse request body           │
│  - Validate with Effect Schema  │
│  - Return 400 on failure        │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│        Route Handler            │
│  - Call PostService.create()    │
│  - Return created post          │
└─────────────────────────────────┘
        │
        ▼
     JSON Response
```

### 5.3 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Source Files                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  types.ts   │  │  errors.ts  │  │ schemas.ts  │  │ services.ts │  │
│  │             │  │             │  │             │  │             │  │
│  │ - Database  │  │ - Tagged    │  │ - Effect    │  │ - DbService │  │
│  │   Interface │  │   Errors    │  │   Schemas   │  │ - Storage   │  │
│  │ - Config    │  │ - Error     │  │ - Request   │  │ - Image     │  │
│  │ - Types     │  │   Unions    │  │   Schemas   │  │ - Auth      │  │
│  │             │  │ - Helpers   │  │ - Response  │  │ - Post      │  │
│  │             │  │             │  │   Schemas   │  │ - Category  │  │
│  │             │  │             │  │             │  │ - Gallery   │  │
│  │             │  │             │  │             │  │ - Home      │  │
│  │             │  │             │  │             │  │ - Media     │  │
│  │  ~200 LOC   │  │  ~100 LOC   │  │  ~300 LOC   │  │  ~800 LOC   │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│         │                │                │                │         │
│         └────────────────┴────────┬───────┴────────────────┘         │
│                                   │                                   │
│                                   ▼                                   │
│                         ┌─────────────────┐                          │
│                         │   server.ts     │                          │
│                         │                 │                          │
│                         │ - HTTP Routes   │                          │
│                         │ - Middleware    │                          │
│                         │ - Effect Runner │                          │
│                         │                 │                          │
│                         │    ~500 LOC     │                          │
│                         └────────┬────────┘                          │
│                                  │                                    │
│                                  │                                    │
│  ┌───────────────────────────────┴───────────────────────────────┐   │
│  │                         index.tsx                              │   │
│  │                                                                │   │
│  │  - SolidJS Components (Layout, Editor, Forms)                  │   │
│  │  - Pages (Login, Posts, Categories, Galleries, Media, etc.)    │   │
│  │  - API Client                                                  │   │
│  │  - Auth State                                                  │   │
│  │                                                                │   │
│  │                        ~1000 LOC                               │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Total: ~2,900 lines of source code                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Data Model

### 6.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              ENTITIES                                    │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌───────────────┐
                    │    USERS      │
                    ├───────────────┤
                    │ id        PK  │
                    │ email     UK  │
                    │ password_hash │
                    │ name          │
                    │ created_at    │
                    └───────┬───────┘
                            │
                            │ 1:N
                            ▼
                    ┌───────────────┐
                    │   SESSIONS    │
                    ├───────────────┤
                    │ id        PK  │
                    │ user_id   FK  │─────┘
                    │ expires_at    │
                    └───────────────┘


┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│    POSTS      │       │  CATEGORIES   │       │   GALLERIES   │
├───────────────┤       ├───────────────┤       ├───────────────┤
│ id        PK  │       │ id        PK  │       │ id        PK  │
│ title         │       │ name          │       │ title         │
│ slug          │◄──UK──│ slug      UK  │──UK──▶│ slug      UK  │
│ excerpt       │       │ description   │       │ description   │
│ content  JSON │       │ created_at    │       │ images   JSON │
│ featured_image│──┐    │ updated_at    │    ┌──│ category_id   │
│ read_time     │  │    └───────┬───────┘    │  │ status        │
│ category_id   │──┼────────────┘            │  │ published_at  │
│ locale        │  │                         │  │ created_at    │
│ status        │  │                         │  │ updated_at    │
│ published_at  │  │                         │  └───────────────┘
│ created_at    │  │                         │
│ updated_at    │  │    ┌───────────────┐    │
└───────────────┘  │    │     MEDIA     │    │
                   │    ├───────────────┤    │
                   └───▶│ id        PK  │◄───┘
                        │ filename      │
                        │ mime_type     │
┌───────────────┐       │ size          │
│     HOME      │       │ alt           │
├───────────────┤       │ urls     JSON │
│ id='singleton'│       │ width         │
│ title         │       │ height        │
│ short_desc    │       │ created_at    │
│ description   │       └───────────────┘
│ hero      FK  │───────────────┘
│ keywords      │
│ updated_at    │       ┌───────────────┐
└───────────────┘       │   API_KEYS    │
                        ├───────────────┤
                        │ id        PK  │
                        │ name          │
                        │ key_hash      │
                        │ prefix        │
                        │ last_used_at  │
                        │ created_at    │
                        └───────────────┘
```

### 6.2 Database Tables

#### 6.2.1 Users Table

| Column        | Type        | Constraints             | Description  |
| ------------- | ----------- | ----------------------- | ------------ |
| id            | TEXT        | PK                      | CUID2        |
| email         | TEXT        | NOT NULL, UNIQUE        | Login email  |
| password_hash | TEXT        | NOT NULL                | Argon2 hash  |
| name          | TEXT        |                         | Display name |
| created_at    | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |              |

#### 6.2.2 Sessions Table

| Column     | Type        | Constraints        | Description           |
| ---------- | ----------- | ------------------ | --------------------- |
| id         | TEXT        | PK                 | Session token (CUID2) |
| user_id    | TEXT        | NOT NULL, FK users | Owner                 |
| expires_at | TIMESTAMPTZ | NOT NULL           | 7 days from creation  |

#### 6.2.3 Categories Table

| Column      | Type        | Constraints             | Description          |
| ----------- | ----------- | ----------------------- | -------------------- |
| id          | TEXT        | PK                      | CUID2                |
| name        | TEXT        | NOT NULL                | Display name         |
| slug        | TEXT        | NOT NULL, UNIQUE        | URL slug             |
| description | TEXT        |                         | Optional description |
| created_at  | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |                      |
| updated_at  | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Auto-updated         |

#### 6.2.4 Posts Table

| Column           | Type        | Constraints               | Description          |
| ---------------- | ----------- | ------------------------- | -------------------- |
| id               | TEXT        | PK                        | CUID2                |
| title            | TEXT        | NOT NULL                  |                      |
| slug             | TEXT        | NOT NULL                  | Unique with locale   |
| excerpt          | TEXT        |                           | Short summary        |
| content          | JSONB       |                           | TipTap document      |
| featured_image   | TEXT        | FK media                  |                      |
| read_time_minute | INTEGER     |                           | Calculated           |
| category_id      | TEXT        | FK categories             |                      |
| locale           | locale ENUM | NOT NULL, DEFAULT 'en'    | en or id             |
| status           | status ENUM | NOT NULL, DEFAULT 'draft' | draft or published   |
| published_at     | TIMESTAMPTZ |                           | When first published |
| created_at       | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()   |                      |
| updated_at       | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()   | Auto-updated         |

**Indexes:**

- `UNIQUE (slug, locale)` - Slug unique per language
- `INDEX (status)` - Filter by status
- `INDEX (category_id)` - Filter by category
- `INDEX (published_at DESC)` - Sort by publish date

#### 6.2.5 Galleries Table

| Column       | Type        | Constraints               | Description        |
| ------------ | ----------- | ------------------------- | ------------------ |
| id           | TEXT        | PK                        | CUID2              |
| title        | TEXT        | NOT NULL                  |                    |
| slug         | TEXT        | NOT NULL, UNIQUE          | URL slug           |
| description  | TEXT        |                           |                    |
| images       | JSONB       | NOT NULL, DEFAULT '[]'    | Array of media IDs |
| category_id  | TEXT        | FK categories             |                    |
| status       | status ENUM | NOT NULL, DEFAULT 'draft' |                    |
| published_at | TIMESTAMPTZ |                           |                    |
| created_at   | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()   |                    |
| updated_at   | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()   |                    |

#### 6.2.6 Media Table

| Column     | Type        | Constraints             | Description                         |
| ---------- | ----------- | ----------------------- | ----------------------------------- |
| id         | TEXT        | PK                      | CUID2                               |
| filename   | TEXT        | NOT NULL                | Original filename                   |
| mime_type  | TEXT        | NOT NULL                | e.g., image/webp                    |
| size       | INTEGER     | NOT NULL                | Bytes                               |
| alt        | TEXT        |                         | Accessibility text                  |
| urls       | JSONB       | NOT NULL                | {original, thumbnail, small, large} |
| width      | INTEGER     |                         | Original width                      |
| height     | INTEGER     |                         | Original height                     |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |                                     |

#### 6.2.7 Home Table

| Column            | Type        | Constraints                                       | Description    |
| ----------------- | ----------- | ------------------------------------------------- | -------------- |
| id                | TEXT        | PK, DEFAULT 'singleton', CHECK (id = 'singleton') |                |
| title             | TEXT        |                                                   |                |
| short_description | TEXT        |                                                   |                |
| description       | JSONB       |                                                   | TipTap content |
| hero              | TEXT        | FK media                                          | Hero image     |
| keywords          | TEXT        |                                                   | SEO keywords   |
| updated_at        | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                           |                |

#### 6.2.8 API Keys Table

| Column       | Type        | Constraints             | Description   |
| ------------ | ----------- | ----------------------- | ------------- |
| id           | TEXT        | PK                      | CUID2         |
| name         | TEXT        | NOT NULL                | Identifier    |
| key_hash     | TEXT        | NOT NULL                | Argon2 hash   |
| prefix       | TEXT        | NOT NULL                | First 8 chars |
| last_used_at | TIMESTAMPTZ |                         |               |
| created_at   | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |               |

---

## 7. API Specification

### 7.1 Public API

**Base Path:** `/api`  
**Authentication:** `X-Api-Key` header

#### 7.1.1 Endpoints

| Method | Path                | Description              |
| ------ | ------------------- | ------------------------ |
| GET    | `/posts`            | List published posts     |
| GET    | `/posts/:slug`      | Get post by slug         |
| GET    | `/categories`       | List all categories      |
| GET    | `/categories/:slug` | Get category by slug     |
| GET    | `/galleries`        | List published galleries |
| GET    | `/galleries/:slug`  | Get gallery by slug      |
| GET    | `/home`             | Get homepage content     |

#### 7.1.2 GET /posts

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | number | 25 | Max 100 |
| offset | number | 0 | Pagination |
| locale | 'en' \| 'id' | all | Filter by locale |
| category | string | all | Filter by category slug |

**Response:**

```json
{
  "data": [
    {
      "id": "clx...",
      "title": "My Post",
      "slug": "my-post",
      "excerpt": "Short description",
      "content": { "type": "doc", "content": [...] },
      "featured_image": "clx...",
      "read_time_minute": 5,
      "locale": "en",
      "status": "published",
      "published_at": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "category": {
        "id": "clx...",
        "name": "Technology",
        "slug": "technology"
      }
    }
  ],
  "meta": {
    "total": 100,
    "limit": 25,
    "offset": 0
  }
}
```

#### 7.1.3 GET /posts/:slug

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| locale | 'en' \| 'id' | 'en' | Locale for the post |

**Response:** Single post object with category and featured media expanded.

**Error Responses:**

- `404` - Post not found

### 7.2 Admin API

**Base Path:** `/admin/api`  
**Authentication:** Session cookie (`session`)

#### 7.2.1 Authentication Endpoints

| Method | Path      | Description                     |
| ------ | --------- | ------------------------------- |
| POST   | `/login`  | Authenticate and create session |
| POST   | `/logout` | Destroy session                 |
| GET    | `/me`     | Get current user                |

#### 7.2.2 POST /login

**Request:**

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "user": {
    "id": "clx...",
    "email": "admin@example.com",
    "name": "Admin",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Response Headers:**

```
Set-Cookie: session=clx...; HttpOnly; Secure; SameSite=Lax; Max-Age=604800
```

#### 7.2.3 Content CRUD Endpoints

**Posts:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/posts` | List all posts (inc. drafts) |
| POST | `/posts` | Create post |
| GET | `/posts/:id` | Get post by ID |
| PUT | `/posts/:id` | Update post |
| DELETE | `/posts/:id` | Delete post |
| POST | `/posts/:id/publish` | Publish post |
| POST | `/posts/:id/unpublish` | Unpublish post |

**Categories:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/categories` | List categories |
| POST | `/categories` | Create category |
| GET | `/categories/:id` | Get category |
| PUT | `/categories/:id` | Update category |
| DELETE | `/categories/:id` | Delete category |

**Galleries:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/galleries` | List galleries |
| POST | `/galleries` | Create gallery |
| GET | `/galleries/:id` | Get gallery |
| PUT | `/galleries/:id` | Update gallery |
| DELETE | `/galleries/:id` | Delete gallery |
| POST | `/galleries/:id/publish` | Publish |
| POST | `/galleries/:id/unpublish` | Unpublish |

**Home:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/home` | Get home content |
| PUT | `/home` | Update home content |

**Media:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/media` | List media |
| POST | `/media` | Upload media (multipart/form-data) |
| GET | `/media/:id` | Get media |
| PUT | `/media/:id` | Update alt text |
| DELETE | `/media/:id` | Delete media |

**API Keys:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api-keys` | List API keys |
| POST | `/api-keys` | Create API key |
| DELETE | `/api-keys/:id` | Delete API key |

### 7.3 Error Response Format

All errors follow this format:

```json
{
  "error": "ErrorType",
  "message": "Human-readable message"
  // Additional fields depending on error type
}
```

**Error Types:**
| Type | HTTP Code | Description |
|------|-----------|-------------|
| NotFound | 404 | Resource not found |
| InvalidCredentials | 401 | Wrong email/password |
| SessionExpired | 401 | Session invalid/expired |
| InvalidApiKey | 401 | API key invalid/missing |
| Unauthorized | 403 | Action not permitted |
| SlugConflict | 409 | Slug already exists |
| ValidationError | 400 | Input validation failed |
| DatabaseError | 500 | Database operation failed |
| StorageError | 500 | R2 operation failed |
| ImageProcessingError | 500 | Sharp operation failed |

---

## 8. User Interface Requirements

### 8.1 Admin Panel Pages

| Page            | Path                    | Purpose                 |
| --------------- | ----------------------- | ----------------------- |
| Login           | `/admin/login`          | Authentication          |
| Posts List      | `/admin/posts`          | View/manage all posts   |
| Post Edit       | `/admin/posts/:id`      | Create/edit post        |
| Categories List | `/admin/categories`     | View/manage categories  |
| Category Edit   | `/admin/categories/:id` | Create/edit category    |
| Galleries List  | `/admin/galleries`      | View/manage galleries   |
| Gallery Edit    | `/admin/galleries/:id`  | Create/edit gallery     |
| Home Editor     | `/admin/home`           | Edit homepage           |
| Media Library   | `/admin/media`          | Browse/upload media     |
| Settings        | `/admin/settings`       | API keys, user settings |

### 8.2 UI Components

#### 8.2.1 Layout

- Fixed sidebar navigation (left, 256px)
- Main content area (fluid)
- User info + logout in sidebar footer
- Responsive: sidebar collapses on mobile

#### 8.2.2 Forms

- Labeled input fields
- Inline validation messages
- Save button (always visible)
- Delete button (with confirmation)
- Publish/Unpublish toggle

#### 8.2.3 Lists

- Tabular format
- Columns: Title, Slug, Status, Locale, Actions
- Status badge (green=published, yellow=draft)
- Action links (Edit, Delete)
- Empty state message

#### 8.2.4 Rich Text Editor (TipTap)

- Toolbar: Bold, Italic, H2, H3, Lists, Quote, Code, Image
- WYSIWYG editing
- Inline image insertion
- Placeholder text when empty
- Minimum height: 400px

#### 8.2.5 Media Picker

- Modal overlay
- Grid of thumbnails
- Click to select
- Upload button
- Empty state with dropzone

### 8.3 UX Requirements

| ID       | Requirement                                  |
| -------- | -------------------------------------------- |
| UX-8.3.1 | Auto-save indicator (saved/unsaved)          |
| UX-8.3.2 | Loading states for all async operations      |
| UX-8.3.3 | Error toasts for failed operations           |
| UX-8.3.4 | Confirmation dialogs for destructive actions |
| UX-8.3.5 | Keyboard shortcuts: Cmd/Ctrl+S to save       |
| UX-8.3.6 | Mobile-friendly on tablets (768px+)          |

---

## 9. Security Requirements

### 9.1 Authentication

| ID        | Requirement                                     |
| --------- | ----------------------------------------------- |
| SEC-9.1.1 | Passwords hashed with Argon2id                  |
| SEC-9.1.2 | Minimum password length: 8 characters           |
| SEC-9.1.3 | Sessions expire after 7 days of inactivity      |
| SEC-9.1.4 | Session cookies: HttpOnly, Secure, SameSite=Lax |
| SEC-9.1.5 | API keys hashed with Argon2id                   |
| SEC-9.1.6 | API keys shown only once on creation            |

### 9.2 Authorization

| ID        | Requirement                                        |
| --------- | -------------------------------------------------- |
| SEC-9.2.1 | All admin endpoints require valid session          |
| SEC-9.2.2 | All public endpoints require valid API key         |
| SEC-9.2.3 | No cross-user data access (single admin initially) |

### 9.3 Data Protection

| ID        | Requirement                                        |
| --------- | -------------------------------------------------- |
| SEC-9.3.1 | HTTPS only in production                           |
| SEC-9.3.2 | No sensitive data in logs                          |
| SEC-9.3.3 | Database credentials in environment variables only |
| SEC-9.3.4 | R2 credentials in environment variables only       |

### 9.4 Input Validation

| ID        | Requirement                                     |
| --------- | ----------------------------------------------- |
| SEC-9.4.1 | All inputs validated with Effect Schema         |
| SEC-9.4.2 | Slug format: lowercase alphanumeric + hyphens   |
| SEC-9.4.3 | Email format validated                          |
| SEC-9.4.4 | File uploads: images only (PNG, JPG, WebP, GIF) |
| SEC-9.4.5 | Max file size: 10MB                             |

---

## 10. Integration Requirements

### 10.1 Cloudflare R2 Storage

**Purpose:** Store processed images

**Configuration:**

- Endpoint: S3-compatible API
- Bucket: `ivokun-prod`
- Public URL: Custom domain for CDN delivery

**Operations:**

- PUT object (upload)
- DELETE object
- No list operations (managed via database)

### 10.2 PostgreSQL Database

**Purpose:** Primary data store

**Version:** PostgreSQL 16+

**Configuration:**

- Connection pooling via pg.Pool
- SSL in production
- Migrations via dbmate

### 10.3 Blog Frontend Integration

**Consumer:** Astro static site generator

**Integration Pattern:**

1. Blog fetches API at build time
2. Uses API key authentication
3. Requests published content only
4. Caches responses for SSG

---

## 11. Migration Requirements

### 11.1 Data Migration Scope

| Entity     | Strapi Source       | Action                         |
| ---------- | ------------------- | ------------------------------ |
| Categories | `/api/categories`   | Direct import                  |
| Media      | `/api/upload/files` | Download, reprocess, re-upload |
| Posts      | `/api/posts`        | Convert blocks to TipTap       |
| Galleries  | `/api/galleries`    | Convert image refs             |
| Home       | `/api/home`         | Convert content                |
| Users      | N/A                 | Create fresh admin user        |
| API Keys   | N/A                 | Generate new key               |

### 11.2 Content Transformation

#### Rich Content (Strapi Blocks → TipTap)

| Strapi Block             | TipTap Node            |
| ------------------------ | ---------------------- |
| paragraph                | paragraph              |
| heading (level 1-6)      | heading (level 2-4)    |
| list (ordered/unordered) | bulletList/orderedList |
| quote                    | blockquote             |
| code                     | codeBlock              |
| image                    | image                  |
| link (inline)            | link mark              |

### 11.3 Migration Validation

| Check          | Criteria                                       |
| -------------- | ---------------------------------------------- |
| Post count     | New DB count = Strapi count                    |
| Category count | New DB count = Strapi count                    |
| Media count    | New DB count = Strapi count                    |
| Image URLs     | All resolve to valid images                    |
| Rich content   | No empty content for posts with Strapi content |
| Relationships  | Category/media references valid                |

---

## 12. Deployment Requirements

### 12.1 Build Artifacts

| Artifact   | Format            | Size Target |
| ---------- | ----------------- | ----------- |
| CMS Binary | Single executable | < 50MB      |
| Admin SPA  | Static files      | < 2MB       |

### 12.2 NixOS Service

**Requirements:**

- systemd service unit
- Automatic restart on failure
- Environment file for secrets
- Run as dynamic user (security hardening)
- Integration with Caddy reverse proxy

### 12.3 Database Migrations

**Tool:** dbmate

**Requirements:**

- Migrations run automatically on deploy
- Rollback capability
- Schema file generated for verification

### 12.4 Health Checks

| Endpoint       | Purpose               |
| -------------- | --------------------- |
| GET /health    | Basic liveness check  |
| GET /health/db | Database connectivity |

---

## 13. Constraints & Assumptions

### 13.1 Constraints

1. **Single Admin User** - Multi-user support out of scope for v1
2. **Two Locales Only** - English and Indonesian (no dynamic locales)
3. **No Content Versioning** - No history/undo for v1
4. **No Scheduled Publishing** - Manual publish only for v1
5. **PostgreSQL Only** - No support for other databases
6. **Cloudflare R2 Only** - No support for other S3 providers

### 13.2 Assumptions

1. Admin has reliable internet connection
2. Blog rebuild triggered manually after content changes
3. PostgreSQL and R2 are pre-provisioned
4. NixOS infrastructure managed separately
5. Single-region deployment (no geo-replication)

---

## 14. Out of Scope

The following features are explicitly **not** included in this PRD:

| Feature                | Reason                              |
| ---------------------- | ----------------------------------- |
| Multi-user support     | Complexity; single admin sufficient |
| Role-based access      | Single admin                        |
| Content versioning     | Complexity; can add later           |
| Scheduled publishing   | Low priority; manual is sufficient  |
| Comments system        | Not needed for static blog          |
| Full-text search       | Database built-in sufficient        |
| Analytics/metrics      | Separate concern (use Plausible)    |
| Email notifications    | Not needed                          |
| Two-factor auth        | Single admin, low risk              |
| Content preview URLs   | Can add in v2                       |
| Webhooks               | Can add if needed                   |
| Import from other CMSs | Focus on Strapi only                |
| GraphQL API            | REST sufficient                     |
| Real-time updates      | Static blog doesn't need            |

---

## 15. Acceptance Criteria

### 15.1 Feature Acceptance

| Feature      | Acceptance Criteria                             |
| ------------ | ----------------------------------------------- |
| Login        | Admin can login with email/password             |
| Logout       | Session is destroyed, cookie cleared            |
| Create Post  | Post appears in list, can be retrieved via API  |
| Publish Post | Status changes, public API returns post         |
| Edit Post    | Changes persist after page refresh              |
| Delete Post  | Post removed from database and API              |
| Upload Image | Image processed, 4 variants available           |
| Rich Text    | Content saves as TipTap JSON, renders correctly |
| Categories   | CRUD operations work, posts can reference       |
| Galleries    | Multiple images can be added/removed/reordered  |
| API Keys     | New key works for public API access             |
| Migration    | All Strapi content accessible in new CMS        |

### 15.2 Performance Acceptance

| Metric           | Pass Criteria         |
| ---------------- | --------------------- |
| API p95 Latency  | < 200ms               |
| Admin Page Load  | < 2 seconds           |
| Image Processing | < 5 seconds per image |
| Memory Usage     | < 256MB idle          |
| Binary Size      | < 50MB                |

### 15.3 Security Acceptance

| Check            | Pass Criteria                           |
| ---------------- | --------------------------------------- |
| Session Security | HttpOnly, Secure, SameSite cookies      |
| Password Storage | Argon2 hash verified                    |
| API Key Security | Cannot retrieve full key after creation |
| Input Validation | All endpoints reject invalid input      |
| Authorization    | Unauthenticated requests rejected       |

---

## 16. Appendix

### 16.1 Technology Reference

| Technology | Documentation                                                |
| ---------- | ------------------------------------------------------------ |
| Effect TS  | https://effect.website                                       |
| Kysely     | https://kysely.dev                                           |
| SolidJS    | https://solidjs.com                                          |
| TipTap     | https://tiptap.dev                                           |
| Sharp      | https://sharp.pixelplumbing.com                              |
| dbmate     | https://github.com/amacneil/dbmate                           |
| Argon2     | https://github.com/napi-rs/node-rs/tree/main/packages/argon2 |
| Bun        | https://bun.sh                                               |

### 16.2 Environment Variables Reference

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/db
SESSION_SECRET=minimum-32-character-secret-string
R2_ACCESS_KEY_ID=your-access-key
R2_ACCESS_SECRET=your-secret-key
R2_ENDPOINT=https://account.r2.cloudflarestorage.com
R2_BUCKET=bucket-name
R2_PUBLIC_URL=https://media.example.com

# Optional
PORT=3000                    # Default: 3000
NODE_ENV=production          # Default: development
CORS_ORIGIN=https://example.com
```

### 16.3 Glossary

| Term   | Definition                                  |
| ------ | ------------------------------------------- |
| CUID2  | Collision-resistant unique identifier       |
| Effect | Functional effect system for TypeScript     |
| Kysely | Type-safe SQL query builder                 |
| TipTap | ProseMirror-based rich text editor          |
| R2     | Cloudflare's S3-compatible object storage   |
| SPA    | Single Page Application                     |
| SSG    | Static Site Generation                      |
| WebP   | Modern image format with better compression |

---

## Document History

| Version | Date             | Author | Changes     |
| ------- | ---------------- | ------ | ----------- |
| 1.0.0   | 04 December 2025 | ivokun | Initial PRD |

---

**Approval:**
NONE
