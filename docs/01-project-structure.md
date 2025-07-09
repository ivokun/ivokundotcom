# Project Structure Requirements

## Overview
This document outlines the complete project structure for the new Hono API server that will replace the existing Strapi implementation.

## Directory Structure

```
api-hono/
├── src/
│   ├── index.ts                    # Main server entry point
│   ├── app.ts                      # Hono app configuration
│   ├── config/                     # Configuration files
│   │   ├── database.ts             # DynamoDB configuration
│   │   ├── auth.ts                 # OpenAuth configuration
│   │   ├── email.ts                # AWS SES configuration
│   │   └── environment.ts          # Environment variables
│   ├── services/                   # Effect.ts services
│   │   ├── content.service.ts      # Content management
│   │   ├── media.service.ts        # Media processing
│   │   ├── auth.service.ts         # Authentication
│   │   ├── email.service.ts        # Email delivery
│   │   ├── webhook.service.ts      # Webhook management
│   │   └── i18n.service.ts         # Internationalization
│   ├── models/                     # ElectroDB models
│   │   ├── post.model.ts           # Post entity
│   │   ├── category.model.ts       # Category entity
│   │   ├── gallery.model.ts        # Gallery entity
│   │   ├── home.model.ts           # Home entity
│   │   ├── media.model.ts          # Media entity
│   │   ├── user.model.ts           # User entity
│   │   ├── token.model.ts          # API token entity
│   │   └── webhook.model.ts        # Webhook entity
│   ├── routes/                     # Hono route handlers
│   │   ├── api/                    # API routes
│   │   │   ├── posts.ts            # Posts CRUD
│   │   │   ├── categories.ts       # Categories CRUD
│   │   │   ├── galleries.ts        # Galleries CRUD
│   │   │   ├── home.ts             # Home content
│   │   │   └── media.ts            # Media management
│   │   ├── auth/                   # Authentication routes
│   │   │   ├── login.ts            # Login endpoint
│   │   │   ├── callback.ts         # OAuth callback
│   │   │   └── tokens.ts           # API token management
│   │   ├── admin/                  # Admin routes
│   │   │   ├── users.ts            # User management
│   │   │   ├── webhooks.ts         # Webhook management
│   │   │   └── settings.ts         # Settings management
│   │   └── public/                 # Public routes
│   │       ├── uploads.ts          # File uploads
│   │       └── health.ts           # Health check
│   ├── middleware/                 # Custom middleware
│   │   ├── auth.middleware.ts      # Authentication middleware
│   │   ├── cors.middleware.ts      # CORS configuration
│   │   ├── rate-limit.middleware.ts # Rate limiting
│   │   ├── validation.middleware.ts # Request validation
│   │   └── logging.middleware.ts   # Request logging
│   ├── utils/                      # Utility functions
│   │   ├── slug.ts                 # Slug generation
│   │   ├── validation.ts           # Input validation
│   │   ├── image.ts                # Image processing helpers
│   │   └── crypto.ts               # Cryptographic utilities
│   ├── types/                      # TypeScript types
│   │   ├── api.types.ts            # API request/response types
│   │   ├── content.types.ts        # Content entity types
│   │   ├── auth.types.ts           # Authentication types
│   │   └── common.types.ts         # Common utility types
│   └── schemas/                    # Effect.ts schemas
│       ├── post.schema.ts          # Post validation schemas
│       ├── category.schema.ts      # Category validation schemas
│       ├── gallery.schema.ts       # Gallery validation schemas
│       ├── home.schema.ts          # Home validation schemas
│       └── media.schema.ts         # Media validation schemas
├── tests/                          # Test files
│   ├── unit/                       # Unit tests
│   ├── integration/                # Integration tests
│   └── fixtures/                   # Test fixtures
├── migrations/                     # Database migrations
│   ├── 001-initial-setup.ts        # Initial table creation
│   ├── 002-seed-data.ts            # Seed data migration
│   └── 003-strapi-migration.ts     # Strapi data migration
├── docs/                           # Documentation
│   ├── api/                        # API documentation
│   └── deployment/                 # Deployment guides
├── scripts/                        # Build/deployment scripts
│   ├── build.sh                    # Build script
│   ├── deploy.sh                   # Deployment script
│   └── migrate.sh                  # Migration script
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── .env.example                    # Environment variables example
├── .gitignore                      # Git ignore rules
├── README.md                       # Project documentation
└── docker-compose.yml              # Local development setup
```

## Key Directories Explained

### `/src/services/`
Contains all Effect.ts services implementing business logic:
- **Pure functional programming patterns**
- **Proper error handling with Effect.ts**
- **Dependency injection**
- **Type-safe operations**

### `/src/models/`
ElectroDB models for DynamoDB:
- **Type-safe database operations**
- **Relationship management**
- **Query optimization**
- **Data validation**

### `/src/routes/`
Hono route handlers organized by functionality:
- **RESTful API design**
- **Proper HTTP status codes**
- **Request/response validation**
- **Authentication integration**

### `/src/middleware/`
Custom middleware for cross-cutting concerns:
- **Authentication/authorization**
- **Request validation**
- **Rate limiting**
- **CORS handling**

### `/src/schemas/`
Effect.ts schemas for validation:
- **Type-safe validation**
- **Request/response schemas**
- **Error handling**
- **Transformation pipelines**

## File Naming Conventions

- **Services**: `*.service.ts`
- **Models**: `*.model.ts`
- **Routes**: `*.ts` (descriptive names)
- **Middleware**: `*.middleware.ts`
- **Schemas**: `*.schema.ts`
- **Types**: `*.types.ts`
- **Tests**: `*.test.ts` or `*.spec.ts`

## Import/Export Patterns

### Services
```typescript
// Export Effect services
export const PostService = Effect.gen(function* () {
  // Implementation
});

// Import in routes
import { PostService } from '../services/post.service';
```

### Models
```typescript
// Export ElectroDB entities
export const PostModel = new Entity({
  // Configuration
});

// Import in services
import { PostModel } from '../models/post.model';
```

### Routes
```typescript
// Export Hono apps
export const postsRouter = new Hono()
  .get('/', handler)
  .post('/', handler);

// Import in main app
import { postsRouter } from './routes/api/posts';
```

## Development Dependencies Structure

### Core Dependencies
- **Hono**: Web framework
- **Effect**: Functional programming library
- **ElectroDB**: DynamoDB operations
- **OpenAuth**: Authentication

### Development Dependencies
- **TypeScript**: Type checking
- **Vitest**: Testing framework
- **ESLint**: Code linting
- **Prettier**: Code formatting

### Build Dependencies
- **esbuild**: Fast bundling
- **tsx**: TypeScript execution
- **nodemon**: Development server

## Configuration Management

### Environment Variables
```typescript
// src/config/environment.ts
export const config = {
  port: process.env.PORT || 3000,
  database: {
    region: process.env.AWS_REGION,
    tableName: process.env.DYNAMODB_TABLE_NAME,
  },
  auth: {
    secret: process.env.AUTH_SECRET,
    providers: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    },
  },
};
```

### Database Configuration
```typescript
// src/config/database.ts
export const databaseConfig = {
  client: DynamoDB,
  region: config.database.region,
  table: config.database.tableName,
};
```

This structure provides:
- **Clear separation of concerns**
- **Scalable architecture**
- **Type safety throughout**
- **Easy testing and maintenance**
- **Proper dependency management**