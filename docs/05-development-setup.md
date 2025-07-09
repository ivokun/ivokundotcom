# Development Setup Requirements

## Overview
This document specifies the development environment setup for the Hono API server, including local development, testing, and deployment configurations.

## Environment Setup

### Prerequisites
- Node.js 22.17.0 or higher
- pnpm 9.5.0
- AWS CLI configured
- Docker (for local DynamoDB)

### Local Development Stack

#### 1. DynamoDB Local
```yaml
# docker-compose.yml
version: '3.8'

services:
  dynamodb-local:
    image: amazon/dynamodb-local:2.5.2
    container_name: dynamodb-local
    ports:
      - "8000:8000"
    command: ["-jar", "DynamoDBLocal.jar", "-sharedDb", "-dbPath", "./data"]
    volumes:
      - ./data:/home/dynamodblocal/data
    working_dir: /home/dynamodblocal
    restart: unless-stopped

  dynamodb-admin:
    image: aaronshaf/dynamodb-admin:4.6.1
    container_name: dynamodb-admin
    ports:
      - "8001:8001"
    environment:
      - DYNAMO_ENDPOINT=http://dynamodb-local:8000
    depends_on:
      - dynamodb-local
    restart: unless-stopped

  # Optional: AWS SES Local for email testing
  ses-local:
    image: mailhog/mailhog:v1.0.1
    container_name: ses-local
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
    restart: unless-stopped
```

#### 2. Environment Variables
```bash
# .env.development
NODE_ENV=development
PORT=3000

# Database
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=ivokun-cms-dev
DYNAMODB_ENDPOINT=http://localhost:8000

# Authentication
AUTH_SECRET=your-super-secret-key-for-development
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id
OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret
OAUTH_GITHUB_CLIENT_ID=your-github-client-id
OAUTH_GITHUB_CLIENT_SECRET=your-github-client-secret

# Email
SES_REGION=us-east-1
SES_FROM_EMAIL=noreply@localhost
SES_ENDPOINT=http://localhost:1025

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,webp,pdf,doc,docx

# CORS
CORS_ORIGIN=http://localhost:4321
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100        # requests per window

# Webhook
WEBHOOK_SECRET=your-webhook-secret
WEBHOOK_TIMEOUT=30000     # 30 seconds
```

```bash
# .env.production
NODE_ENV=production
PORT=3000

# Database
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=ivokun-cms-prod

# Authentication
AUTH_SECRET=production-secret-key
OAUTH_GOOGLE_CLIENT_ID=prod-google-client-id
OAUTH_GOOGLE_CLIENT_SECRET=prod-google-client-secret

# Email
SES_REGION=us-east-1
SES_FROM_EMAIL=noreply@ivokun.com

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,webp,pdf,doc,docx

# CORS
CORS_ORIGIN=https://ivokun.com
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Webhook
WEBHOOK_SECRET=production-webhook-secret
WEBHOOK_TIMEOUT=30000
```

#### 3. Development Scripts

```json
{
  "scripts": {
    "dev": "concurrently \"pnpm:dev:db\" \"pnpm:dev:server\"",
    "dev:db": "docker-compose up -d dynamodb-local dynamodb-admin",
    "dev:server": "tsx watch src/index.ts",
    "dev:setup": "pnpm run db:create && pnpm run db:migrate && pnpm run db:seed",
    "dev:clean": "docker-compose down -v && pnpm run clean",
    
    "build": "pnpm run clean && pnpm run typecheck && pnpm run build:esbuild",
    "build:esbuild": "esbuild src/index.ts --bundle --platform=node --target=node22 --outfile=dist/index.js --external:sharp --sourcemap",
    "build:production": "pnpm run build && pnpm run build:compress",
    "build:compress": "gzip -9 dist/index.js",
    
    "start": "node dist/index.js",
    "start:dev": "NODE_ENV=development node dist/index.js",
    "start:prod": "NODE_ENV=production node dist/index.js",
    
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "lint:staged": "lint-staged",
    
    "format": "prettier --write src/**/*.{ts,tsx}",
    "format:check": "prettier --check src/**/*.{ts,tsx}",
    
    "db:create": "tsx scripts/create-table.ts",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:seed": "tsx scripts/seed.ts",
    "db:reset": "tsx scripts/reset.ts",
    "db:backup": "tsx scripts/backup.ts",
    "db:restore": "tsx scripts/restore.ts",
    
    "clean": "rm -rf dist coverage .turbo node_modules/.cache"
  }
}
```

## Project Structure Setup

### 1. Initial Project Creation
```bash
# Create project structure
mkdir -p api-hono/{src,tests,scripts,docs}
cd api-hono

# Initialize package.json
pnpm init

# Create directory structure
mkdir -p src/{config,services,models,routes,middleware,utils,types,schemas}
mkdir -p src/routes/{api,auth,admin,public}
mkdir -p tests/{unit,integration,fixtures}
mkdir -p docs/{api,deployment}
```

### 2. Core Configuration Files

#### tsconfig.json
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
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
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
    }
  },
  "include": [
    "src/**/*.ts",
    "tests/**/*.ts",
    "scripts/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "coverage"
  ]
}
```

#### .eslintrc.json
```json
{
  "env": {
    "es2022": true,
    "node": true
  },
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "plugins": [
    "@typescript-eslint",
    "simple-import-sort"
  ],
  "rules": {
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    "no-console": "warn",
    "prefer-const": "error"
  },
  "ignorePatterns": ["dist", "coverage", "node_modules"]
}
```

#### .prettierrc
```json
{
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "quoteProps": "as-needed",
  "trailingComma": "es5",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

#### .gitignore
```
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment files
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*
pnpm-debug.log*

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage
coverage/
*.lcov

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Database
data/
*.db
*.sqlite

# Uploads
uploads/
temp/

# AWS
.aws/

# Cache
.turbo/
.cache/
```

### 3. Testing Configuration

#### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

#### tests/setup.ts
```typescript
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '@/config/database';

beforeAll(async () => {
  // Setup test database
  process.env.NODE_ENV = 'test';
  process.env.DYNAMODB_TABLE_NAME = 'test-table';
  process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
});

afterAll(async () => {
  // Cleanup test database
});

beforeEach(async () => {
  // Reset database state
});

afterEach(async () => {
  // Cleanup after each test
});
```

## Database Setup Scripts

### 1. Create Table Script
```typescript
// scripts/create-table.ts
import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.NODE_ENV === 'development' && {
    endpoint: 'http://localhost:8000',
  }),
});

const createTable = async () => {
  const command = new CreateTableCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME || 'ivokun-cms',
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'GSI1PK', AttributeType: 'S' },
      { AttributeName: 'GSI1SK', AttributeType: 'S' },
      { AttributeName: 'GSI2PK', AttributeType: 'S' },
      { AttributeName: 'GSI2SK', AttributeType: 'S' },
      { AttributeName: 'GSI3PK', AttributeType: 'S' },
      { AttributeName: 'GSI3SK', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1',
        KeySchema: [
          { AttributeName: 'GSI1PK', KeyType: 'HASH' },
          { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
      {
        IndexName: 'GSI2',
        KeySchema: [
          { AttributeName: 'GSI2PK', KeyType: 'HASH' },
          { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
      {
        IndexName: 'GSI3',
        KeySchema: [
          { AttributeName: 'GSI3PK', KeyType: 'HASH' },
          { AttributeName: 'GSI3SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    BillingMode: 'PROVISIONED',
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  });

  try {
    await client.send(command);
    console.log('Table created successfully');
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('Table already exists');
    } else {
      throw error;
    }
  }
};

createTable().catch(console.error);
```

### 2. Seed Data Script
```typescript
// scripts/seed.ts
import { DatabaseService } from '@/config/database';
import { nanoid } from 'nanoid';

const seedData = async () => {
  // Create admin user
  const adminUser = await DatabaseService.entities.users.create({
    id: nanoid(),
    email: 'admin@ivokun.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    provider: 'google',
    providerId: 'google-admin-id',
  }).go();

  // Create default category
  const category = await DatabaseService.entities.categories.create({
    id: nanoid(),
    name: 'General',
    description: 'General category',
    slug: 'general',
    status: 'published',
  }).go();

  // Create home page
  const home = await DatabaseService.entities.home.create({
    id: 'home',
    title: 'Welcome to Ivokun',
    description: 'Personal blog and gallery',
    shortDescription: 'Personal blog',
    keywords: 'blog, gallery, personal',
    status: 'published',
  }).go();

  console.log('Seed data created successfully');
};

seedData().catch(console.error);
```

## Development Workflow

### 1. Daily Development
```bash
# Start development environment
pnpm dev

# In separate terminal - run tests
pnpm test:watch

# Type checking
pnpm typecheck:watch

# Code formatting
pnpm format
```

### 2. Pre-commit Hooks
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

### 3. CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      dynamodb:
        image: amazon/dynamodb-local
        ports:
          - 8000:8000
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Type check
        run: pnpm typecheck
      
      - name: Lint
        run: pnpm lint
      
      - name: Test
        run: pnpm test:coverage
        env:
          DYNAMODB_ENDPOINT: http://localhost:8000
      
      - name: Build
        run: pnpm build
```

## Deployment Configuration

### 1. Production Build
```bash
# Build for production
pnpm build:production

# Start production server
pnpm start:prod
```

### 2. Environment-specific Configs
```typescript
// src/config/environment.ts
export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  database: {
    region: process.env.AWS_REGION || 'us-east-1',
    tableName: process.env.DYNAMODB_TABLE_NAME || 'ivokun-cms',
    endpoint: process.env.DYNAMODB_ENDPOINT,
  },
  
  auth: {
    secret: process.env.AUTH_SECRET || 'development-secret',
    providers: {
      google: {
        clientId: process.env.OAUTH_GOOGLE_CLIENT_ID,
        clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET,
      },
    },
  },
  
  upload: {
    maxFileSize: Number(process.env.MAX_FILE_SIZE) || 10485760,
    allowedExtensions: process.env.ALLOWED_EXTENSIONS?.split(',') || ['jpg', 'png'],
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:4321',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
};
```

This development setup provides:
- **Complete local development environment** with DynamoDB Local
- **Hot reload** for fast development cycles
- **Comprehensive testing** with Vitest
- **Code quality** with ESLint and Prettier
- **Type safety** with strict TypeScript
- **Database management** with migration scripts
- **CI/CD ready** with GitHub Actions
- **Production ready** build configuration