# Dependencies Requirements

## Overview
This document specifies all required dependencies for the Hono API server with Effect.ts, including pinned versions following the project's best practices.

## Core Dependencies

### Web Framework
```json
{
  "hono": "4.6.3"
}
```
**Rationale**: Lightweight, fast web framework with excellent TypeScript support

### Functional Programming
```json
{
  "@effect/platform": "0.63.3",
  "@effect/platform-node": "0.58.3", 
  "@effect/schema": "0.72.3",
  "effect": "3.7.2"
}
```
**Rationale**: Complete Effect.ts ecosystem for functional programming, error handling, and type safety

### Database
```json
{
  "electrodb": "2.14.3",
  "@aws-sdk/client-dynamodb": "3.658.1",
  "@aws-sdk/lib-dynamodb": "3.658.1"
}
```
**Rationale**: Type-safe DynamoDB operations with ElectroDB, latest AWS SDK v3

### Authentication
```json
{
  "@openauth/core": "0.3.0",
  "@openauth/client": "0.3.0",
  "jose": "5.9.3"
}
```
**Rationale**: Modern authentication with OpenAuth, JWT handling with jose

### Image Processing
```json
{
  "sharp": "0.33.5"
}
```
**Rationale**: High-performance image processing for media library

### Email Service
```json
{
  "@aws-sdk/client-ses": "3.658.1"
}
```
**Rationale**: AWS SES integration for email delivery

### Validation & Serialization
```json
{
  "zod": "3.23.8"
}
```
**Rationale**: Runtime type validation that works well with Effect.ts

### Utilities
```json
{
  "nanoid": "5.0.7",
  "slugify": "1.6.6",
  "mime-types": "2.1.35"
}
```
**Rationale**: ID generation, URL slug creation, MIME type detection

## Development Dependencies

### TypeScript
```json
{
  "typescript": "5.6.2",
  "@types/node": "22.7.4",
  "@types/mime-types": "2.1.4"
}
```
**Rationale**: Latest TypeScript with Node.js types

### Build Tools
```json
{
  "tsx": "4.19.1",
  "esbuild": "0.24.0"
}
```
**Rationale**: Fast TypeScript execution and bundling

### Testing
```json
{
  "vitest": "2.1.1",
  "@vitest/ui": "2.1.1",
  "supertest": "7.0.0",
  "@types/supertest": "6.0.2"
}
```
**Rationale**: Fast testing framework with UI, HTTP testing

### Code Quality
```json
{
  "eslint": "9.11.1",
  "@typescript-eslint/eslint-plugin": "8.8.0",
  "@typescript-eslint/parser": "8.8.0",
  "prettier": "3.3.3",
  "simple-import-sort": "12.1.0"
}
```
**Rationale**: Code linting, formatting, and import sorting

### Development Server
```json
{
  "nodemon": "3.1.7",
  "concurrently": "9.0.1"
}
```
**Rationale**: Development server with hot reload, concurrent script execution

## Complete package.json

```json
{
  "name": "api-hono",
  "version": "1.0.0",
  "description": "Hono API server with Effect.ts replacing Strapi",
  "main": "dist/index.js",
  "type": "module",
  "engines": {
    "node": ">=22.17.0"
  },
  "packageManager": "pnpm@9.5.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "esbuild src/index.ts --bundle --platform=node --target=node22 --outfile=dist/index.js --external:sharp",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write src/**/*.{ts,tsx}",
    "format:check": "prettier --check src/**/*.{ts,tsx}",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:seed": "tsx scripts/seed.ts",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "hono": "4.6.3",
    "@effect/platform": "0.63.3",
    "@effect/platform-node": "0.58.3",
    "@effect/schema": "0.72.3",
    "effect": "3.7.2",
    "electrodb": "2.14.3",
    "@aws-sdk/client-dynamodb": "3.658.1",
    "@aws-sdk/lib-dynamodb": "3.658.1",
    "@aws-sdk/client-ses": "3.658.1",
    "@openauth/core": "0.3.0",
    "@openauth/client": "0.3.0",
    "jose": "5.9.3",
    "sharp": "0.33.5",
    "zod": "3.23.8",
    "nanoid": "5.0.7",
    "slugify": "1.6.6",
    "mime-types": "2.1.35"
  },
  "devDependencies": {
    "typescript": "5.6.2",
    "@types/node": "22.7.4",
    "@types/mime-types": "2.1.4",
    "@types/supertest": "6.0.2",
    "tsx": "4.19.1",
    "esbuild": "0.24.0",
    "vitest": "2.1.1",
    "@vitest/ui": "2.1.1",
    "supertest": "7.0.0",
    "eslint": "9.11.1",
    "@typescript-eslint/eslint-plugin": "8.8.0",
    "@typescript-eslint/parser": "8.8.0",
    "prettier": "3.3.3",
    "simple-import-sort": "12.1.0",
    "nodemon": "3.1.7",
    "concurrently": "9.0.1"
  },
  "keywords": [
    "hono",
    "effect-ts",
    "dynamodb",
    "openauth",
    "typescript"
  ],
  "author": "ivokun",
  "license": "MIT"
}
```

## Installation Commands

```bash
# Create new project
mkdir api-hono
cd api-hono

# Initialize package.json
pnpm init

# Install dependencies (pinned versions)
pnpm add hono@4.6.3 @effect/platform@0.63.3 @effect/platform-node@0.58.3 @effect/schema@0.72.3 effect@3.7.2
pnpm add electrodb@2.14.3 @aws-sdk/client-dynamodb@3.658.1 @aws-sdk/lib-dynamodb@3.658.1 @aws-sdk/client-ses@3.658.1
pnpm add @openauth/core@0.3.0 @openauth/client@0.3.0 jose@5.9.3
pnpm add sharp@0.33.5 zod@3.23.8 nanoid@5.0.7 slugify@1.6.6 mime-types@2.1.35

# Install dev dependencies (pinned versions)
pnpm add -D typescript@5.6.2 @types/node@22.7.4 @types/mime-types@2.1.4 @types/supertest@6.0.2
pnpm add -D tsx@4.19.1 esbuild@0.24.0 vitest@2.1.1 @vitest/ui@2.1.1 supertest@7.0.0
pnpm add -D eslint@9.11.1 @typescript-eslint/eslint-plugin@8.8.0 @typescript-eslint/parser@8.8.0
pnpm add -D prettier@3.3.3 simple-import-sort@12.1.0 nodemon@3.1.7 concurrently@9.0.1
```

## Version Pinning Strategy

All dependencies are pinned to exact versions following the project's best practices:
- **No semver ranges**: Exact versions for predictable builds
- **Security updates**: Manual updates after testing
- **Compatibility**: Tested combinations of dependencies

## Compatibility Notes

- **Node.js**: Requires Node.js 22+ for latest features
- **TypeScript**: Uses latest TypeScript 5.6+ features
- **Effect.ts**: Latest stable version with all features
- **AWS SDK**: Version 3 for better performance and tree-shaking