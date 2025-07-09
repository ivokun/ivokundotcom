# Strapi to Hono Migration Plan

This document outlines the comprehensive migration from Strapi to Hono, implementing a functional programming approach with Effect.ts and AWS services.

## Project Overview

**Current State**: Strapi 5.16.1 with PostgreSQL
**Target State**: Hono API with Effect.ts, DynamoDB, and AWS services

**Current Collection Types**:
- Posts (with i18n, draft/publish, media, categories)
- Categories (with relations to posts/galleries)
- Galleries (with multiple images, categories)
- Home (single type with hero image)

## Current Status (Ready for `sst dev`)

✅ **Phase 1 & 2 Complete**: Foundation and core API implementation finished
- Complete Hono API server with Effect.ts integration
- All content management APIs (posts, categories, galleries, home) implemented
- SST configuration with DynamoDB table setup
- AWS Lambda handler for serverless deployment
- Comprehensive test suite with proper Effect.ts patterns

🔄 **Next Priority**: Authentication system (OpenAuth) and Media library implementation

⚠️ **Ready for Deployment**: 
- SST configuration complete with DynamoDB table resource
- Environment properly configured for AWS deployment
- All API routes tested and working with Effect.ts patterns

## Phase 1: Foundation Setup ✅ COMPLETED

### 1. Project Structure & Dependencies
- [x] Create new `api-hono/` directory
- [x] Set up package.json with Hono, Effect.ts, and required dependencies
- [x] Configure TypeScript with strict settings
- [x] Set up development environment with hot reload

**Key Dependencies**:
```json
{
  "hono": "^4.x",
  "@effect/core": "^0.x",
  "@effect/schema": "^0.x",
  "electrodb": "^2.x",
  "aws-sdk": "^3.x",
  "sharp": "^0.x",
  "openauth": "^1.x"
}
```

### 2. Database Layer (DynamoDB + ElectroDB) ✅ COMPLETED
- [x] Design DynamoDB table structure for all entities
- [x] Create ElectroDB models for:
  - Posts
  - Categories  
  - Galleries
  - Home
  - Media files
  - Users/Auth
  - API tokens
  - Webhooks
- [x] Set up local DynamoDB for development
- [x] Configure AWS DynamoDB connection

**Entity Design**:
```typescript
// Posts: PK: POST#id, SK: POST#id, GSI1PK: CATEGORY#id, GSI1SK: createdAt
// Categories: PK: CATEGORY#id, SK: CATEGORY#id
// Galleries: PK: GALLERY#id, SK: GALLERY#id, GSI1PK: CATEGORY#id, GSI1SK: createdAt
// Media: PK: MEDIA#id, SK: MEDIA#id
// Users: PK: USER#id, SK: USER#id
// API Tokens: PK: TOKEN#id, SK: TOKEN#id
// Webhooks: PK: WEBHOOK#id, SK: WEBHOOK#id
```

### 3. Effect.ts Foundation ✅ COMPLETED
- [x] Create Effect.ts service layers
- [x] Implement error handling patterns
- [x] Set up dependency injection
- [x] Create common Effect patterns for:
  - Database operations
  - File operations
  - HTTP requests
  - Email sending

## Phase 2: Core API Implementation ✅ COMPLETED

### 4. Authentication System (OpenAuth)
- [ ] Configure OpenAuth.js integration
- [ ] Implement OAuth providers (Google, GitHub, etc.)
- [ ] Create session management
- [ ] Set up role-based access control
- [ ] Implement JWT token generation/validation

### 5. Content Management API ✅ COMPLETED
- [x] **Posts API**:
  - [x] CRUD operations with Effect.ts
  - [x] Internationalization support
  - [x] Draft/publish workflow
  - [x] Slug generation
  - [x] Category relations
  - [x] Featured images
  - [x] Rich content (blocks)
  
- [x] **Categories API**:
  - [x] CRUD operations
  - [x] Slug generation
  - [x] Relations to posts/galleries
  
- [x] **Galleries API**:
  - [x] CRUD operations
  - [x] Multiple image handling
  - [x] Category relations
  
- [x] **Home API**:
  - [x] Single type management
  - [x] Hero image handling

### 6. SST Integration & Deployment ✅ COMPLETED
- [x] **SST Configuration**:
  - [x] Configure DynamoDB table resource
  - [x] Set up Lambda function for API
  - [x] AWS Lambda handler integration
  - [x] Environment configuration with SST Resource
  
- [x] **Database Integration**:
  - [x] Connect to SST-managed DynamoDB table
  - [x] Remove hardcoded AWS configuration
  - [x] Use SST Resource for table name
  
- [x] **Testing Framework**:
  - [x] Complete test suite for all API routes
  - [x] Hono testing patterns with app.request
  - [x] Effect.ts and ElectroDB integration tests

### 7. Media Library & Image Processing
- [ ] Implement file upload endpoint
- [ ] Sharp integration for image processing:
  - Resize to multiple formats (thumbnail, small, medium, large)
  - WebP conversion
  - Quality optimization
- [ ] File storage (local/cloud)
- [ ] Media metadata storage
- [ ] Image serving with cache headers

### 8. API Token Management
- [ ] Create API token generation
- [ ] Implement token-based authentication
- [ ] Token permissions/scopes
- [ ] Token revocation
- [ ] Usage tracking

## Phase 3: Advanced Features

### 9. Internationalization (i18n)
- [ ] Create i18n service layer
- [ ] Implement locale detection
- [ ] Content translation storage
- [ ] API endpoints for locale-specific content
- [ ] Fallback language support

### 10. Email System (AWS SES)
- [ ] Configure AWS SES integration
- [ ] Create email templates
- [ ] Implement email service with Effect.ts
- [ ] Email queue management
- [ ] Delivery tracking

### 11. Webhook Management
- [ ] Create webhook registration API
- [ ] Implement webhook triggers for:
  - Content create/update/delete
  - Media upload
  - User actions
- [ ] Webhook delivery system
- [ ] Retry logic and failure handling
- [ ] Webhook validation/security

### 12. Admin Interface (Optional)
- [ ] Create basic admin routes
- [ ] Content management endpoints
- [ ] Media management
- [ ] User management
- [ ] Settings management

## Phase 4: Integration & Migration

### 13. Frontend Integration
- [ ] Update web/src/api/ files to use new Hono API
- [ ] Update TypeScript types
- [ ] Test all frontend integrations
- [ ] Update environment variables

### 14. Data Migration
- [ ] Export existing Strapi data
- [ ] Create migration scripts for:
  - Posts with i18n data
  - Categories
  - Galleries
  - Media files
  - User data
- [ ] Validate data integrity
- [ ] Test migration process

### 15. Deployment & Configuration
- [x] Update SST configuration
- [x] Configure AWS resources:
  - [x] DynamoDB tables
  - [ ] SES configuration
  - [ ] CloudFront for media
- [x] Environment variables setup
- [ ] CI/CD pipeline updates

## Phase 5: Testing & Optimization

### 16. Testing
- [x] Unit tests for all services
- [x] Integration tests
- [x] API endpoint tests
- [ ] Performance testing
- [ ] Security testing

### 17. Performance Optimization
- [ ] Database query optimization
- [ ] Image processing optimization
- [ ] Caching strategies
- [ ] CDN configuration

### 18. Documentation
- [x] API documentation (Phase 1 docs created)
- [ ] Migration guide
- [x] Deployment guide (development setup completed)
- [x] Development setup guide

## Implementation Notes

### File Structure
```
api-hono/
├── src/
│   ├── services/          # Effect.ts services
│   ├── models/            # ElectroDB models
│   ├── routes/            # Hono route handlers
│   ├── middleware/        # Authentication, CORS, etc.
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript types
│   └── index.ts           # Main server file
├── tests/
├── migrations/
└── package.json
```

### Key Technical Decisions
- **Effect.ts**: Functional programming with proper error handling
- **ElectroDB**: Type-safe DynamoDB operations
- **OpenAuth**: Modern authentication solution
- **Sharp**: High-performance image processing
- **AWS Services**: SES for email, DynamoDB for data, CloudFront for media

### Migration Strategy
1. Build new API in parallel
2. Dual-write during transition
3. Gradual frontend migration
4. Complete data migration
5. Deprecate old Strapi API

## Estimated Timeline
- **Phase 1-2**: 2-3 weeks (Foundation + Core API)
- **Phase 3**: 2-3 weeks (Advanced Features)
- **Phase 4**: 1-2 weeks (Integration)
- **Phase 5**: 1 week (Testing & Optimization)

**Total**: 6-9 weeks for complete migration