# CMS Implementation Plan

> Comprehensive phased approach to implementing the ivokun CMS specification

## Overview

This plan breaks down the CMS implementation into 6 phases, each with clear deliverables and testing criteria. The approach prioritizes getting a working foundation early, then iteratively adding features.

**Total Estimated Timeline:** 6-8 weeks (depending on team size and availability)

---

## Phase 0: Project Setup & Foundation (Week 1)

**Goal:** Establish project structure, dependencies, and basic infrastructure

### Tasks

#### 0.1 Project Initialization
- [ ] Create `cms/` directory in monorepo
- [ ] Initialize `package.json` with all dependencies from specification
- [ ] Set up TypeScript configuration (`tsconfig.json`)
- [ ] Configure Bun build settings
- [ ] Set up ESLint and Prettier with import sorting

**Deliverable:** `cms/package.json`, `cms/tsconfig.json`

#### 0.2 Database Setup
- [ ] Install and configure dbmate
- [ ] Create `cms/db/migrations/` directory
- [ ] Create initial migration file: `20240101000000_initial.sql`
- [ ] Set up local PostgreSQL database for development
- [ ] Create `.env.example` with all required variables
- [ ] Run initial migration and verify schema

**Deliverable:** Working database schema, migration tooling

#### 0.3 Core Type Definitions
- [ ] Create `cms/src/types.ts` with Kysely database interface
- [ ] Add Config type and utility types
- [ ] Verify types compile without errors

**Deliverable:** `cms/src/types.ts` (complete)

#### 0.4 Error System
- [ ] Create `cms/src/errors.ts` with all tagged error classes
- [ ] Define error union types
- [ ] Add JSDoc comments for each error type

**Deliverable:** `cms/src/errors.ts` (complete)

### Testing Criteria
- [ ] All dependencies install without conflicts
- [ ] TypeScript compiles without errors
- [ ] Database migrations run successfully
- [ ] Can connect to database from TypeScript

### Blockers to Address
- PostgreSQL access/credentials
- Cloudflare R2 bucket setup (can be mocked initially)
- Environment variable management strategy

---

## Phase 1: Core Services & Database Layer (Week 2)

**Goal:** Implement Effect TS services and database connectivity

### Tasks

#### 1.1 Database Service
- [ ] Implement `DbService` in `cms/src/services.ts`
- [ ] Create `makeDbService` layer factory
- [ ] Test database connection with simple query
- [ ] Add connection pooling configuration

**Deliverable:** Working database service with Effect TS

#### 1.2 Effect Schema Definitions
- [ ] Create `cms/src/schemas.ts` with all enums
- [ ] Implement common schemas (MediaUrls, Slug, Email, etc.)
- [ ] Define all entity schemas (Category, Post, Gallery, etc.)
- [ ] Implement API request/response schemas
- [ ] Add validation for all schemas

**Deliverable:** `cms/src/schemas.ts` (complete, ~300 lines)

#### 1.3 Storage Service (Mock)
- [ ] Implement `StorageService` interface in `cms/src/services.ts`
- [ ] Create mock implementation for local development (filesystem-based)
- [ ] Add real R2 implementation (can be toggled via env var)
- [ ] Test upload/delete operations

**Deliverable:** Working storage service with local mock

#### 1.4 Image Service
- [ ] Implement `ImageService` in `cms/src/services.ts`
- [ ] Add Sharp-based image processing pipeline
- [ ] Generate all 4 image variants (original, thumbnail, small, large)
- [ ] Convert to WebP format
- [ ] Test with sample images

**Deliverable:** Working image processing pipeline

### Testing Criteria
- [ ] Can query database using Kysely
- [ ] Schema validation works correctly
- [ ] Images are processed and uploaded successfully
- [ ] All variants are generated with correct dimensions

### Deliverables Summary
- `cms/src/services.ts` (DbService, StorageService, ImageService)
- `cms/src/schemas.ts` (complete)

---

## Phase 2: Authentication & Security (Week 3)

**Goal:** Implement authentication services and middleware

### Tasks

#### 2.1 Auth Service
- [ ] Implement `AuthService` in `cms/src/services.ts`
- [ ] Add password hashing with @node-rs/argon2
- [ ] Implement session creation/validation/destruction
- [ ] Add API key generation and validation
- [ ] Test password hashing round-trip

**Deliverable:** Complete `AuthService` implementation

#### 2.2 Seed Admin User
- [ ] Create script to seed initial admin user
- [ ] Add command to package.json: `bun run seed-admin`
- [ ] Document default credentials in README

**Deliverable:** `cms/scripts/seed-admin.ts`

#### 2.3 Session Middleware
- [ ] Implement session cookie parsing in server
- [ ] Create session validation middleware
- [ ] Add session renewal on activity
- [ ] Test session expiration

**Deliverable:** Working session middleware

#### 2.4 API Key Middleware
- [ ] Implement API key validation middleware
- [ ] Add request header parsing
- [ ] Test with valid/invalid keys
- [ ] Add rate limiting considerations (document for future)

**Deliverable:** Working API key middleware

### Testing Criteria
- [ ] Can create admin user and login
- [ ] Sessions persist across requests
- [ ] Sessions expire correctly
- [ ] API keys validate correctly
- [ ] Invalid credentials are rejected

### Deliverables Summary
- Complete `AuthService` in `cms/src/services.ts`
- `cms/scripts/seed-admin.ts`
- Session and API key middleware

---

## Phase 3: Business Logic Services (Week 4)

**Goal:** Implement CRUD services for all content types

### Tasks

#### 3.1 Category Service
- [ ] Implement `CategoryService` in `cms/src/services.ts`
- [ ] Add CRUD operations (findMany, findBySlug, findById, create, update, delete)
- [ ] Add slug uniqueness validation
- [ ] Test all operations

**Deliverable:** Complete `CategoryService`

#### 3.2 Media Service
- [ ] Implement `MediaService` in `cms/src/services.ts`
- [ ] Connect to ImageService and StorageService
- [ ] Add upload, findMany, findById, delete, updateAlt operations
- [ ] Store metadata in database
- [ ] Test upload and retrieval

**Deliverable:** Complete `MediaService`

#### 3.3 Post Service
- [ ] Implement `PostService` in `cms/src/services.ts`
- [ ] Add all CRUD operations
- [ ] Implement publish/unpublish workflow
- [ ] Add slug+locale uniqueness validation
- [ ] Implement filtering (locale, category, status)
- [ ] Add pagination support
- [ ] Test draft/publish workflow

**Deliverable:** Complete `PostService`

#### 3.4 Gallery Service
- [ ] Implement `GalleryService` in `cms/src/services.ts`
- [ ] Follow same pattern as PostService
- [ ] Add publish/unpublish support
- [ ] Test with multiple images

**Deliverable:** Complete `GalleryService`

#### 3.5 Home Service
- [ ] Implement `HomeService` in `cms/src/services.ts`
- [ ] Add get and update operations (singleton pattern)
- [ ] Test updates

**Deliverable:** Complete `HomeService`

### Testing Criteria
- [ ] All CRUD operations work correctly
- [ ] Slug conflicts are detected
- [ ] Pagination works correctly
- [ ] Publish/unpublish workflow functions properly
- [ ] Relations (category, featured image) work correctly

### Deliverables Summary
- Complete `cms/src/services.ts` (~800 lines)
- All services tested and working

---

## Phase 4: HTTP API & Server (Week 5)

**Goal:** Implement Effect HTTP server with all API endpoints

### Tasks

#### 4.1 Server Setup
- [ ] Create `cms/src/server.ts` with basic Effect HTTP server
- [ ] Configure environment variables loading
- [ ] Set up CORS middleware
- [ ] Add request logging middleware
- [ ] Test server starts successfully

**Deliverable:** Basic HTTP server running

#### 4.2 Public API Endpoints
- [ ] Define PublicApi group with all endpoints
- [ ] Implement handlers for:
  - GET /api/posts (paginated, filtered)
  - GET /api/posts/:slug (with media)
  - GET /api/categories
  - GET /api/categories/:slug
  - GET /api/galleries
  - GET /api/galleries/:slug
  - GET /api/home
- [ ] Apply API key middleware to public routes
- [ ] Test all endpoints with Postman/Bruno

**Deliverable:** Complete public API

#### 4.3 Admin API - Auth Endpoints
- [ ] Implement auth endpoints:
  - POST /admin/api/login
  - POST /admin/api/logout
  - GET /admin/api/me
- [ ] Add session cookie handling
- [ ] Test login/logout flow

**Deliverable:** Working admin authentication

#### 4.4 Admin API - Content Endpoints
- [ ] Implement Posts CRUD endpoints (7 endpoints)
- [ ] Implement Categories CRUD endpoints (5 endpoints)
- [ ] Implement Galleries CRUD endpoints (7 endpoints)
- [ ] Implement Home update endpoint (1 endpoint)
- [ ] Implement Media endpoints (5 endpoints)
- [ ] Implement API Keys management endpoints (3 endpoints)
- [ ] Apply session middleware to admin routes
- [ ] Test all CRUD operations

**Deliverable:** Complete admin API

#### 4.5 Error Handling
- [ ] Implement global error handler
- [ ] Map Effect errors to HTTP status codes
- [ ] Return consistent error response format
- [ ] Add request/response logging
- [ ] Test error scenarios

**Deliverable:** Robust error handling

### Testing Criteria
- [ ] All public API endpoints return correct data
- [ ] API key authentication works
- [ ] Admin API requires valid session
- [ ] CRUD operations work end-to-end
- [ ] Errors return appropriate status codes
- [ ] Response format is consistent

### Deliverables Summary
- Complete `cms/src/server.ts` (~500 lines)
- All API endpoints tested

---

## Phase 5: Admin SPA (Week 6-7)

**Goal:** Build SolidJS admin interface

### Tasks

#### 5.1 SPA Build Setup
- [ ] Create `cms/vite.config.ts` for SPA builds
- [ ] Configure SolidJS plugin
- [ ] Set up Tailwind CSS
- [ ] Configure build output to `cms/public/`
- [ ] Test build process

**Deliverable:** Working Vite build configuration

#### 5.2 Authentication UI
- [ ] Create login page component
- [ ] Implement auth state management
- [ ] Add protected route wrapper
- [ ] Create layout with navigation
- [ ] Test login/logout flow

**Deliverable:** Working authentication UI

#### 5.3 Content Management - Categories
- [ ] Create categories list page
- [ ] Add create/edit category form
- [ ] Implement delete confirmation
- [ ] Add slug auto-generation from name
- [ ] Test CRUD operations

**Deliverable:** Categories management UI

#### 5.4 Content Management - Media Library
- [ ] Create media library grid view
- [ ] Add file upload with drag-and-drop
- [ ] Show image previews (all variants)
- [ ] Implement alt text editing
- [ ] Add delete confirmation
- [ ] Add media picker component for reuse
- [ ] Test upload and management

**Deliverable:** Media library UI

#### 5.5 Content Management - Posts
- [ ] Create posts list page with filters (status, locale, category)
- [ ] Add create/edit post form
- [ ] Integrate TipTap rich text editor
- [ ] Add inline image upload to editor
- [ ] Implement featured image picker
- [ ] Add category selector
- [ ] Add locale selector
- [ ] Add publish/unpublish actions
- [ ] Test full post workflow

**Deliverable:** Posts management UI

#### 5.6 Content Management - Galleries
- [ ] Create galleries list page
- [ ] Add create/edit gallery form
- [ ] Implement multi-image picker
- [ ] Add drag-and-drop image reordering
- [ ] Add publish/unpublish actions
- [ ] Test gallery management

**Deliverable:** Galleries management UI

#### 5.7 Content Management - Home Page
- [ ] Create home page editor
- [ ] Add hero image picker
- [ ] Integrate TipTap for description
- [ ] Add keywords input
- [ ] Test updates

**Deliverable:** Home page editor UI

#### 5.8 Settings & API Keys
- [ ] Create settings page
- [ ] Add API key generation UI
- [ ] Show API key list with usage
- [ ] Add delete API key action
- [ ] Display key only once on creation
- [ ] Test API key management

**Deliverable:** Settings UI

### Testing Criteria
- [ ] All pages render correctly
- [ ] Forms validate input
- [ ] Rich text editor works with images
- [ ] Media picker functions properly
- [ ] All CRUD operations work from UI
- [ ] Responsive design works on different screen sizes
- [ ] Loading states are shown
- [ ] Error messages are displayed

### Deliverables Summary
- Complete `cms/src/index.tsx` (~1000 lines)
- `cms/vite.config.ts`
- Built SPA in `cms/public/`

---

## Phase 6: Deployment & Migration (Week 8)

**Goal:** Deploy to NixOS and migrate from Strapi

### Tasks

#### 6.1 Bun Binary Compilation
- [ ] Configure Bun build for single binary
- [ ] Test binary locally
- [ ] Verify all assets are embedded/accessible
- [ ] Document binary usage

**Deliverable:** Compiled CMS binary

#### 6.2 NixOS Module
- [ ] Create `cms/module.nix` for NixOS service
- [ ] Create `cms/flake.nix` for Nix flake
- [ ] Define systemd service configuration
- [ ] Add environment variable management
- [ ] Add automatic migration running
- [ ] Test on local NixOS instance

**Deliverable:** NixOS service module

#### 6.3 Strapi Migration Script
- [ ] Create `cms/scripts/migrate-strapi.ts`
- [ ] Export data from Strapi database
- [ ] Map Strapi schema to new schema
- [ ] Import users (with password reset requirement)
- [ ] Import categories
- [ ] Import media files (download and re-upload)
- [ ] Import posts with localization
- [ ] Import galleries
- [ ] Import home page data
- [ ] Generate API keys for existing consumers
- [ ] Test migration on copy of production data

**Deliverable:** Working migration script

#### 6.4 Deployment to Production
- [ ] Deploy PostgreSQL database
- [ ] Set up Cloudflare R2 bucket
- [ ] Configure environment variables
- [ ] Deploy via clan.lol
- [ ] Run migrations
- [ ] Test all functionality in production
- [ ] Monitor logs and performance

**Deliverable:** CMS running in production

#### 6.5 Documentation
- [ ] Write deployment documentation
- [ ] Document environment variables
- [ ] Create API documentation
- [ ] Write user guide for admin panel
- [ ] Document backup/restore procedures
- [ ] Add troubleshooting guide

**Deliverable:** Complete documentation

#### 6.6 Cutover Plan
- [ ] Schedule maintenance window
- [ ] Run Strapi migration script
- [ ] Verify data integrity
- [ ] Update blog to use new API
- [ ] Update API keys in blog deployment
- [ ] Test blog functionality
- [ ] Monitor for issues
- [ ] Prepare rollback plan

**Deliverable:** Successful cutover to new CMS

### Testing Criteria
- [ ] Binary runs on NixOS
- [ ] All migrated data is correct
- [ ] No data loss during migration
- [ ] Blog consumes new API successfully
- [ ] Performance is acceptable
- [ ] No errors in production logs

### Deliverables Summary
- Compiled binary
- `cms/module.nix`, `cms/flake.nix`
- `cms/scripts/migrate-strapi.ts`
- Complete documentation
- Production deployment

---

## Post-Launch Phase: Optimization & Features

**Goal:** Improve performance and add nice-to-have features

### Future Enhancements

#### Performance Optimizations
- [ ] Add Redis caching layer for public API
- [ ] Implement database query optimization
- [ ] Add CDN caching headers
- [ ] Optimize image loading (lazy loading)
- [ ] Add response compression

#### Additional Features
- [ ] Content versioning/history
- [ ] Scheduled publishing
- [ ] Content preview URLs
- [ ] Bulk operations
- [ ] Search functionality in admin
- [ ] Analytics dashboard
- [ ] Webhook support for content changes
- [ ] Multi-user support with roles/permissions
- [ ] Activity audit log

#### Monitoring & Observability
- [ ] Add structured logging
- [ ] Integrate APM (Application Performance Monitoring)
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Add health check endpoint
- [ ] Create alerting rules

---

## Risk Management

### High-Risk Areas

1. **Effect TS Learning Curve**
   - Mitigation: Start with simple services, reference Effect documentation
   - Fallback: Consider using regular Promises initially, refactor later

2. **Data Migration Complexity**
   - Mitigation: Test on staging data multiple times
   - Fallback: Keep Strapi running, gradual migration

3. **NixOS Deployment Issues**
   - Mitigation: Test on local NixOS VM first
   - Fallback: Deploy as Docker container initially

4. **Image Processing Performance**
   - Mitigation: Benchmark with production-size images
   - Fallback: Use background job queue for processing

### Medium-Risk Areas

1. **SolidJS/TipTap Integration**
   - Mitigation: Build prototype editor first
   - Fallback: Use alternative React-based editor

2. **Session Management**
   - Mitigation: Implement session store carefully
   - Fallback: Use JWT tokens instead

---

## Success Metrics

### Technical Metrics
- [ ] API response time < 200ms (p95)
- [ ] Image processing < 5s per image
- [ ] Admin page load < 2s
- [ ] Zero data loss during migration
- [ ] 99.9% uptime

### Functional Metrics
- [ ] All Strapi features replicated
- [ ] Admin can manage all content types
- [ ] Blog successfully consumes API
- [ ] API keys work correctly

---

## Dependencies & Prerequisites

### Before Starting
- [ ] PostgreSQL 16 access
- [ ] Cloudflare R2 bucket created
- [ ] NixOS deployment environment ready
- [ ] Access to Strapi database for migration
- [ ] Bun 1.1+ installed locally

### External Dependencies
- PostgreSQL database
- Cloudflare R2 storage
- NixOS server
- Domain/SSL certificate

---

## Team & Roles

Suggested team structure:

- **Backend Developer**: Phases 1-4 (Services, API)
- **Frontend Developer**: Phase 5 (Admin SPA)
- **DevOps Engineer**: Phase 6 (Deployment)
- **Full-Stack Developer**: Can handle Phases 0-6 (solo)

**Estimated Effort:**
- Solo developer: 6-8 weeks full-time
- Team of 3: 3-4 weeks with parallel work

---

## Appendix: File Checklist

### Phase 0
- [ ] `cms/package.json`
- [ ] `cms/tsconfig.json`
- [ ] `cms/.env.example`
- [ ] `cms/db/migrations/20240101000000_initial.sql`
- [ ] `cms/src/types.ts`
- [ ] `cms/src/errors.ts`

### Phase 1-3
- [ ] `cms/src/schemas.ts`
- [ ] `cms/src/services.ts`
- [ ] `cms/scripts/seed-admin.ts`

### Phase 4
- [ ] `cms/src/server.ts`

### Phase 5
- [ ] `cms/src/index.tsx`
- [ ] `cms/vite.config.ts`
- [ ] `cms/public/` (built assets)

### Phase 6
- [ ] `cms/flake.nix`
- [ ] `cms/module.nix`
- [ ] `cms/scripts/migrate-strapi.ts`
- [ ] `cms/README.md`

**Total Source Files:** ~10 core files (adhering to flat structure rule)

---

## Quick Start Commands

```bash
# Phase 0: Setup
cd cms
bun install
dbmate up

# Phase 1-3: Development
bun run dev        # Start development server
bun run typecheck  # Type checking

# Phase 4: Testing
bun run test       # Run tests

# Phase 5: Build SPA
bun run build:spa  # Build admin SPA

# Phase 6: Production
bun run build      # Build binary
./cms             # Run binary
```

---

**Document Version:** 1.0  
**Last Updated:** 2024-12-03  
**Status:** Ready for implementation
