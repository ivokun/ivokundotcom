# TypeScript Configuration Requirements

## Overview
This document specifies the TypeScript configuration for the Hono API server, following Node.js 22 standards and strict typing requirements.

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "removeComments": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/config/*": ["src/config/*"],
      "@/services/*": ["src/services/*"],
      "@/models/*": ["src/models/*"],
      "@/routes/*": ["src/routes/*"],
      "@/middleware/*": ["src/middleware/*"],
      "@/utils/*": ["src/utils/*"],
      "@/types/*": ["src/types/*"],
      "@/schemas/*": ["src/schemas/*"]
    },
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "tests/**/*.ts",
    "scripts/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "build",
    "coverage",
    "**/*.test.ts",
    "**/*.spec.ts"
  ],
  "ts-node": {
    "esm": true,
    "experimentalSpecifierResolution": "node"
  }
}
```

## Configuration Breakdown

### Compilation Options

#### Target & Module
```json
{
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "bundler"
}
```
**Rationale**: 
- ES2022 for Node.js 22 compatibility
- ESNext modules for modern JavaScript features
- Bundler resolution for optimal bundling

#### Import/Export
```json
{
  "allowImportingTsExtensions": true,
  "resolveJsonModule": true,
  "isolatedModules": true,
  "esModuleInterop": true,
  "allowSyntheticDefaultImports": true
}
```
**Rationale**:
- Modern module system support
- JSON imports for configuration
- Isolated modules for better performance
- Interop with CommonJS modules

#### Strict Type Checking
```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitReturns": true,
  "noImplicitOverride": true,
  "exactOptionalPropertyTypes": true
}
```
**Rationale**:
- Maximum type safety
- Catch common programming errors
- Enforce explicit typing
- Prevent runtime errors

### Path Mapping

```json
{
  "baseUrl": ".",
  "paths": {
    "@/*": ["src/*"],
    "@/config/*": ["src/config/*"],
    "@/services/*": ["src/services/*"],
    "@/models/*": ["src/models/*"],
    "@/routes/*": ["src/routes/*"],
    "@/middleware/*": ["src/middleware/*"],
    "@/utils/*": ["src/utils/*"],
    "@/types/*": ["src/types/*"],
    "@/schemas/*": ["src/schemas/*"]
  }
}
```
**Benefits**:
- Clean import paths
- Easy refactoring
- Clear project structure
- IDE support

### Example Usage

```typescript
// Instead of: import { PostService } from '../../../services/post.service';
import { PostService } from '@/services/post.service';

// Instead of: import { PostModel } from '../../models/post.model';
import { PostModel } from '@/models/post.model';

// Instead of: import { ApiResponse } from '../types/api.types';
import { ApiResponse } from '@/types/api.types';
```

## Build Configuration

### Development Build
```bash
# Type checking only
pnpm typecheck

# Development with watch
pnpm dev
```

### Production Build
```bash
# Clean build
pnpm clean && pnpm build

# Build with esbuild
esbuild src/index.ts --bundle --platform=node --target=node22 --outfile=dist/index.js --external:sharp
```

## IDE Configuration

### VS Code Settings (.vscode/settings.json)
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.suggest.autoImports": true,
  "typescript.format.enable": true,
  "typescript.validate.enable": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "files.associations": {
    "*.ts": "typescript"
  }
}
```

### VS Code Extensions
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Effect.ts (if available)

## Type-Only Imports

```typescript
// Type-only imports for better tree-shaking
import type { Context } from 'hono';
import type { Effect } from 'effect';
import type { PostModel } from '@/models/post.model';

// Regular imports for runtime
import { Hono } from 'hono';
import { Effect } from 'effect';
import { PostService } from '@/services/post.service';
```

## Effect.ts Integration

### Effect Types
```typescript
// Proper Effect.ts typing
import { Effect, Context, Layer } from 'effect';

// Service definition
export interface PostService {
  readonly create: (data: PostData) => Effect.Effect<Post, PostError>;
  readonly findById: (id: string) => Effect.Effect<Post, PostError>;
  readonly update: (id: string, data: PostData) => Effect.Effect<Post, PostError>;
  readonly delete: (id: string) => Effect.Effect<void, PostError>;
}

// Service implementation
export const PostService = Context.GenericTag<PostService>('PostService');
```

### Error Types
```typescript
// Proper error typing with Effect.ts
export class PostNotFoundError extends Error {
  readonly _tag = 'PostNotFoundError';
  constructor(id: string) {
    super(`Post with id ${id} not found`);
  }
}

export class PostValidationError extends Error {
  readonly _tag = 'PostValidationError';
  constructor(message: string) {
    super(message);
  }
}

export type PostError = PostNotFoundError | PostValidationError;
```

## Testing Configuration

### Vitest Configuration (vitest.config.ts)
```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

### Test Types
```typescript
// Test type definitions
import type { TestContext } from 'vitest';
import type { SuperTest, Test } from 'supertest';

declare global {
  interface TestContext {
    app: SuperTest<Test>;
  }
}
```

## Linting Integration

### ESLint Configuration
```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error"
  }
}
```

This TypeScript configuration provides:
- **Maximum type safety** with strict settings
- **Modern JavaScript features** with ES2022 target
- **Clean import paths** with path mapping
- **Effect.ts integration** with proper typing
- **Development productivity** with IDE support
- **Build optimization** with bundler resolution