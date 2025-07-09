# Database Schema Requirements

## Overview
This document specifies the DynamoDB schema design using ElectroDB for the Hono API server, providing a 1:1 replacement for the existing Strapi collection types.

## DynamoDB Table Design

### Single Table Design
```
Table Name: ivokun-cms
Partition Key: PK (String)
Sort Key: SK (String)
```

### Global Secondary Indexes (GSI)

#### GSI1 - Category Relations
```
GSI1PK (String) - Category relationships
GSI1SK (String) - Sort by creation date
```

#### GSI2 - User Relations
```
GSI2PK (String) - User relationships
GSI2SK (String) - Sort by creation date
```

#### GSI3 - Status/Publication
```
GSI3PK (String) - Publication status
GSI3SK (String) - Sort by publication date
```

## Entity Definitions

### 1. Post Entity
```typescript
// src/models/post.model.ts
import { Entity } from 'electrodb';

export const PostModel = new Entity({
  model: {
    entity: 'post',
    version: '1',
    service: 'cms',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
    },
    title: {
      type: 'string',
      required: true,
    },
    content: {
      type: 'string',
      required: false,
    },
    richContent: {
      type: 'any', // JSON blocks
      required: false,
    },
    excerpt: {
      type: 'string',
      required: false,
    },
    slug: {
      type: 'string',
      required: true,
    },
    readTimeMinute: {
      type: 'number',
      required: false,
    },
    featuredPictureId: {
      type: 'string',
      required: false,
    },
    categoryId: {
      type: 'string',
      required: false,
    },
    locale: {
      type: 'string',
      required: true,
      default: 'en',
    },
    status: {
      type: ['draft', 'published'] as const,
      required: true,
      default: 'draft',
    },
    createdAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
    },
    updatedAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
      watch: '*',
      set: () => new Date().toISOString(),
    },
    publishedAt: {
      type: 'string',
      required: false,
    },
    createdBy: {
      type: 'string',
      required: false,
    },
    updatedBy: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'PK',
        composite: ['id'],
        template: 'POST#${id}',
      },
      sk: {
        field: 'SK',
        composite: ['locale'],
        template: 'POST#${locale}',
      },
    },
    byCategory: {
      index: 'GSI1',
      pk: {
        field: 'GSI1PK',
        composite: ['categoryId'],
        template: 'CATEGORY#${categoryId}',
      },
      sk: {
        field: 'GSI1SK',
        composite: ['createdAt'],
        template: 'POST#${createdAt}',
      },
    },
    byStatus: {
      index: 'GSI3',
      pk: {
        field: 'GSI3PK',
        composite: ['status'],
        template: 'STATUS#${status}',
      },
      sk: {
        field: 'GSI3SK',
        composite: ['publishedAt'],
        template: 'POST#${publishedAt}',
      },
    },
  },
});
```

### 2. Category Entity
```typescript
// src/models/category.model.ts
export const CategoryModel = new Entity({
  model: {
    entity: 'category',
    version: '1',
    service: 'cms',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
    },
    name: {
      type: 'string',
      required: true,
    },
    description: {
      type: 'string',
      required: false,
    },
    slug: {
      type: 'string',
      required: true,
    },
    status: {
      type: ['draft', 'published'] as const,
      required: true,
      default: 'draft',
    },
    createdAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
    },
    updatedAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
      watch: '*',
      set: () => new Date().toISOString(),
    },
    publishedAt: {
      type: 'string',
      required: false,
    },
    createdBy: {
      type: 'string',
      required: false,
    },
    updatedBy: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'PK',
        composite: ['id'],
        template: 'CATEGORY#${id}',
      },
      sk: {
        field: 'SK',
        composite: [],
        template: 'CATEGORY',
      },
    },
  },
});
```

### 3. Gallery Entity
```typescript
// src/models/gallery.model.ts
export const GalleryModel = new Entity({
  model: {
    entity: 'gallery',
    version: '1',
    service: 'cms',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
    },
    title: {
      type: 'string',
      required: true,
    },
    description: {
      type: 'string',
      required: false,
    },
    slug: {
      type: 'string',
      required: true,
    },
    imageIds: {
      type: 'list',
      items: {
        type: 'string',
      },
      required: false,
    },
    categoryId: {
      type: 'string',
      required: false,
    },
    status: {
      type: ['draft', 'published'] as const,
      required: true,
      default: 'draft',
    },
    createdAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
    },
    updatedAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
      watch: '*',
      set: () => new Date().toISOString(),
    },
    publishedAt: {
      type: 'string',
      required: false,
    },
    createdBy: {
      type: 'string',
      required: false,
    },
    updatedBy: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'PK',
        composite: ['id'],
        template: 'GALLERY#${id}',
      },
      sk: {
        field: 'SK',
        composite: [],
        template: 'GALLERY',
      },
    },
    byCategory: {
      index: 'GSI1',
      pk: {
        field: 'GSI1PK',
        composite: ['categoryId'],
        template: 'CATEGORY#${categoryId}',
      },
      sk: {
        field: 'GSI1SK',
        composite: ['createdAt'],
        template: 'GALLERY#${createdAt}',
      },
    },
  },
});
```

### 4. Home Entity (Single Type)
```typescript
// src/models/home.model.ts
export const HomeModel = new Entity({
  model: {
    entity: 'home',
    version: '1',
    service: 'cms',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
      default: 'home',
    },
    title: {
      type: 'string',
      required: false,
    },
    description: {
      type: 'string',
      required: false,
    },
    shortDescription: {
      type: 'string',
      required: false,
    },
    keywords: {
      type: 'string',
      required: false,
    },
    heroImageId: {
      type: 'string',
      required: false,
    },
    status: {
      type: ['draft', 'published'] as const,
      required: true,
      default: 'draft',
    },
    createdAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
    },
    updatedAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
      watch: '*',
      set: () => new Date().toISOString(),
    },
    publishedAt: {
      type: 'string',
      required: false,
    },
    createdBy: {
      type: 'string',
      required: false,
    },
    updatedBy: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'PK',
        composite: ['id'],
        template: 'HOME#${id}',
      },
      sk: {
        field: 'SK',
        composite: [],
        template: 'HOME',
      },
    },
  },
});
```

### 5. Media Entity
```typescript
// src/models/media.model.ts
export const MediaModel = new Entity({
  model: {
    entity: 'media',
    version: '1',
    service: 'cms',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
    },
    name: {
      type: 'string',
      required: true,
    },
    alternativeText: {
      type: 'string',
      required: false,
    },
    caption: {
      type: 'string',
      required: false,
    },
    width: {
      type: 'number',
      required: false,
    },
    height: {
      type: 'number',
      required: false,
    },
    url: {
      type: 'string',
      required: true,
    },
    formats: {
      type: 'map',
      properties: {
        thumbnail: {
          type: 'map',
          properties: {
            url: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
            size: { type: 'number' },
          },
        },
        small: {
          type: 'map',
          properties: {
            url: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
            size: { type: 'number' },
          },
        },
        medium: {
          type: 'map',
          properties: {
            url: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
            size: { type: 'number' },
          },
        },
        large: {
          type: 'map',
          properties: {
            url: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
            size: { type: 'number' },
          },
        },
      },
    },
    hash: {
      type: 'string',
      required: true,
    },
    ext: {
      type: 'string',
      required: true,
    },
    mime: {
      type: 'string',
      required: true,
    },
    size: {
      type: 'number',
      required: true,
    },
    createdAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
    },
    updatedAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
      watch: '*',
      set: () => new Date().toISOString(),
    },
    createdBy: {
      type: 'string',
      required: false,
    },
    updatedBy: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'PK',
        composite: ['id'],
        template: 'MEDIA#${id}',
      },
      sk: {
        field: 'SK',
        composite: [],
        template: 'MEDIA',
      },
    },
  },
});
```

### 6. User Entity
```typescript
// src/models/user.model.ts
export const UserModel = new Entity({
  model: {
    entity: 'user',
    version: '1',
    service: 'cms',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
    },
    email: {
      type: 'string',
      required: true,
    },
    firstName: {
      type: 'string',
      required: false,
    },
    lastName: {
      type: 'string',
      required: false,
    },
    username: {
      type: 'string',
      required: false,
    },
    provider: {
      type: 'string',
      required: true,
    },
    providerId: {
      type: 'string',
      required: true,
    },
    role: {
      type: ['admin', 'editor', 'author'] as const,
      required: true,
      default: 'author',
    },
    isActive: {
      type: 'boolean',
      required: true,
      default: true,
    },
    lastLogin: {
      type: 'string',
      required: false,
    },
    createdAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
    },
    updatedAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
      watch: '*',
      set: () => new Date().toISOString(),
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'PK',
        composite: ['id'],
        template: 'USER#${id}',
      },
      sk: {
        field: 'SK',
        composite: [],
        template: 'USER',
      },
    },
    byEmail: {
      index: 'GSI1',
      pk: {
        field: 'GSI1PK',
        composite: ['email'],
        template: 'EMAIL#${email}',
      },
      sk: {
        field: 'GSI1SK',
        composite: [],
        template: 'USER',
      },
    },
  },
});
```

### 7. API Token Entity
```typescript
// src/models/token.model.ts
export const TokenModel = new Entity({
  model: {
    entity: 'token',
    version: '1',
    service: 'cms',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
    },
    name: {
      type: 'string',
      required: true,
    },
    token: {
      type: 'string',
      required: true,
    },
    permissions: {
      type: 'list',
      items: {
        type: 'string',
      },
      required: true,
    },
    lastUsed: {
      type: 'string',
      required: false,
    },
    isActive: {
      type: 'boolean',
      required: true,
      default: true,
    },
    expiresAt: {
      type: 'string',
      required: false,
    },
    createdAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
    },
    updatedAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
      watch: '*',
      set: () => new Date().toISOString(),
    },
    createdBy: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'PK',
        composite: ['id'],
        template: 'TOKEN#${id}',
      },
      sk: {
        field: 'SK',
        composite: [],
        template: 'TOKEN',
      },
    },
    byToken: {
      index: 'GSI1',
      pk: {
        field: 'GSI1PK',
        composite: ['token'],
        template: 'TOKEN_VALUE#${token}',
      },
      sk: {
        field: 'GSI1SK',
        composite: [],
        template: 'TOKEN',
      },
    },
  },
});
```

### 8. Webhook Entity
```typescript
// src/models/webhook.model.ts
export const WebhookModel = new Entity({
  model: {
    entity: 'webhook',
    version: '1',
    service: 'cms',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
    },
    name: {
      type: 'string',
      required: true,
    },
    url: {
      type: 'string',
      required: true,
    },
    events: {
      type: 'list',
      items: {
        type: 'string',
      },
      required: true,
    },
    headers: {
      type: 'map',
      properties: {},
      required: false,
    },
    isActive: {
      type: 'boolean',
      required: true,
      default: true,
    },
    lastTriggered: {
      type: 'string',
      required: false,
    },
    failureCount: {
      type: 'number',
      required: true,
      default: 0,
    },
    createdAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
    },
    updatedAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
      watch: '*',
      set: () => new Date().toISOString(),
    },
    createdBy: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'PK',
        composite: ['id'],
        template: 'WEBHOOK#${id}',
      },
      sk: {
        field: 'SK',
        composite: [],
        template: 'WEBHOOK',
      },
    },
  },
});
```

## Database Service Configuration

### ElectroDB Service
```typescript
// src/config/database.ts
import { Service } from 'electrodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { PostModel } from '@/models/post.model';
import { CategoryModel } from '@/models/category.model';
import { GalleryModel } from '@/models/gallery.model';
import { HomeModel } from '@/models/home.model';
import { MediaModel } from '@/models/media.model';
import { UserModel } from '@/models/user.model';
import { TokenModel } from '@/models/token.model';
import { WebhookModel } from '@/models/webhook.model';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.NODE_ENV === 'development' && {
    endpoint: 'http://localhost:8000',
  }),
});

const documentClient = DynamoDBDocumentClient.from(client);

export const DatabaseService = new Service({
  posts: PostModel,
  categories: CategoryModel,
  galleries: GalleryModel,
  home: HomeModel,
  media: MediaModel,
  users: UserModel,
  tokens: TokenModel,
  webhooks: WebhookModel,
}, {
  client: documentClient,
  table: process.env.DYNAMODB_TABLE_NAME || 'ivokun-cms',
});
```

## Query Patterns

### Post Queries
```typescript
// Get all posts
const posts = await DatabaseService.entities.posts.query.primary({}).go();

// Get posts by category
const categoryPosts = await DatabaseService.entities.posts.query
  .byCategory({ categoryId: 'cat123' })
  .go();

// Get published posts
const publishedPosts = await DatabaseService.entities.posts.query
  .byStatus({ status: 'published' })
  .go();

// Get post with i18n
const localizedPost = await DatabaseService.entities.posts.get({
  id: 'post123',
  locale: 'en'
}).go();
```

### Category Queries
```typescript
// Get all categories
const categories = await DatabaseService.entities.categories.scan.go();

// Get category by ID
const category = await DatabaseService.entities.categories.get({
  id: 'cat123'
}).go();
```

### Gallery Queries
```typescript
// Get galleries by category
const galleries = await DatabaseService.entities.galleries.query
  .byCategory({ categoryId: 'cat123' })
  .go();
```

### User Queries
```typescript
// Get user by email
const user = await DatabaseService.entities.users.query
  .byEmail({ email: 'user@example.com' })
  .go();
```

## Migration Strategy

### 1. Table Creation
```typescript
// scripts/create-table.ts
import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { client } from '@/config/database';

const createTable = async () => {
  const command = new CreateTableCommand({
    TableName: 'ivokun-cms',
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
      // GSI2 and GSI3 definitions...
    ],
    BillingMode: 'PAY_PER_REQUEST',
  });

  await client.send(command);
};
```

### 2. Data Migration
```typescript
// scripts/migrate-from-strapi.ts
import { DatabaseService } from '@/config/database';
import { nanoid } from 'nanoid';

const migrateFromStrapi = async () => {
  // Migration logic for each entity type
  // Convert Strapi data format to DynamoDB format
  // Handle relationships and i18n data
};
```

This database schema provides:
- **Single table design** for optimal performance
- **Type safety** with ElectroDB
- **Efficient queries** with GSI indexes
- **Scalability** with DynamoDB
- **1:1 feature parity** with Strapi
- **Internationalization** support
- **Audit trails** with created/updated tracking