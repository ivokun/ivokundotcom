# ADR-010: Unified API Client Architecture

> **Status:** Accepted  
> **Date:** 2026-02-24  
> **Deciders:** ivokun

## Context

The web frontend (`web/`) consumes the CMS API for content (articles, galleries, categories, homepage). Initially, each API module (`article.ts`, `gallery.ts`, `category.ts`, `home.ts`) had its own fetch logic with inconsistent patterns:

1. **Duplicated fetch code** - Each file repeated headers, error handling, URL construction
2. **Inconsistent error handling** - Some threw, some returned null, some logged differently
3. **Type duplication** - Same types defined in multiple places
4. **No central configuration** - API URL and token accessed inconsistently

After migrating from Strapi to the custom CMS (ADR-007), the API responses changed significantly. Strapi used a nested `data.attributes` structure, while the custom CMS returns flat objects. This required a comprehensive refactor of all API clients.

## Decision

Create a unified API client architecture with:

### 1. Centralized Fetch Utility (`cms.ts`)

```typescript
// src/api/cms.ts - Single source of truth for API communication
export async function cmsFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${CMS_API_URL}/${path}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CMS_API_TOKEN,  // Custom CMS uses API keys
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`CMS API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}
```

### 2. Shared Types

Central types for API responses:

```typescript
export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; limit: number; offset: number };
}

export interface Media {
  id: string;
  filename: string;
  urls: MediaUrls | null;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  // ...
}

export interface TipTapDocument {
  type: 'doc';
  content: TipTapNode[];
}
```

### 3. Domain-Specific Modules

Each content type has its own module using the shared client:

```typescript
// src/api/article.ts
import { cmsFetch, type PaginatedResponse } from './cms';

export interface Article {
  id: string;
  title: string;
  slug: string;
  content: TipTapDocument;
  // ... flat structure (no data.attributes nesting)
}

export async function getArticles(): Promise<Article[]> {
  const response = await cmsFetch<PaginatedResponse<Article>>('/posts');
  return response.data;
}
```

### 4. TipTap Content Renderer

The custom CMS stores rich text as TipTap JSON instead of HTML. A utility converts this to HTML:

```typescript
// src/utils/tiptap.ts
export function renderTipTapToHtml(document: TipTapDocument): string {
  // Recursively render nodes to HTML
  return document.content.map(renderNode).join('');
}
```

### Architecture Benefits

| Before | After |
|--------|-------|
| 4 different fetch implementations | 1 shared `cmsFetch` |
| Nested Strapi types (`data.attributes`) | Flat custom CMS types |
| HTML content strings | TipTap JSON with renderer |
| Inconsistent error handling | Centralized error throwing |
| Duplicated Media types | Shared in `cms.ts` |

## Consequences

### Positive

1. **DRY Principle** - No duplicated fetch logic
2. **Consistent Error Handling** - All API calls throw on error
3. **Type Safety** - Shared types prevent drift
4. **Easier Maintenance** - Change auth method in one place
5. **Cleaner Components** - API consumers don't handle fetch details
6. **Migration Complete** - Fully adapted to custom CMS response format

### Negative

1. **Refactoring Effort** - Required touching all API modules and pages
2. **Breaking Change** - Not backward compatible with Strapi format
3. **TipTap Dependency** - Frontend now depends on TipTap schema knowledge

### Neutral

1. **Single API Key** - All requests use same authentication
2. **Synchronous Error Throwing** - Callers must use try/catch

## Best Practices

### Error Handling Strategy

API calls throw errors on failure. Pages should wrap calls in try/catch for graceful degradation:

```typescript
// In Astro pages
let articles: Article[] = [];
let error: string | null = null;

try {
  const response = await fetchArticles();
  articles = response.data;
} catch (e) {
  error = 'Failed to load articles';
  // Log for debugging
  console.error('API Error:', e);
}
```

### Data Transformation Patterns

When API structure differs from component needs, use transformation functions:

```typescript
// gallery.ts - transforms nested gallery+media into flat items
export function convertToGalleryItems(galleries: Gallery[]): GalleryItem[] {
  return galleries.flatMap((gallery) =>
    gallery.images.map((image, index) => ({
      id: `${gallery.id}-${index}`,
      src: image.urls?.large || '',
      alt: image.alt || gallery.title,
      category: gallery.category?.name,
      // ...
    }))
  );
}
```

**Rule:** Keep transformations in the API layer, not components.

### Helper Functions

Use exported helpers for presentation formatting:

```typescript
// article.ts
export function formatReadTime(minutes: number): string {
  return `${minutes} min read`;
}

// category.ts
export function formatCategoryName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
```

### Image URL Access

Use helper functions instead of direct property access:

```typescript
// Good
import { getImageUrl } from '@api/article';
const url = getImageUrl(article.featured_media, 'large');

// Avoid
const url = article.featured_media?.urls?.large;
```

### Type Extensions

Extend base types in domain modules for specific use cases:

```typescript
// article.ts
export interface ArticleWithRelations extends Article {
  category: Category | null;
  featured_media: Media | null;
}
```

## Migration Details

### Response Format Changes

**Strapi (old):**
```json
{
  "data": [{
    "id": 1,
    "attributes": {
      "title": "Post Title",
      "content": "HTML string..."
    }
  }]
}
```

**Custom CMS (new):**
```json
{
  "data": [{
    "id": "uuid",
    "title": "Post Title",
    "content": { "type": "doc", "content": [...] }
  }]
}
```

### Files Modified

- `src/api/cms.ts` - **New** - Shared fetch utility and types
- `src/api/article.ts` - Refactored to use `cmsFetch`
- `src/api/category.ts` - Refactored to use `cmsFetch`
- `src/api/gallery.ts` - Refactored to use `cmsFetch`
- `src/api/home.ts` - Refactored to use `cmsFetch`
- `src/utils/tiptap.ts` - **New** - TipTap to HTML renderer
- All page components updated for new data structure

## Alternatives Considered

### 1. Keep Strapi Format Compatibility

**Rejected because:**
- Would require adapter layer in CMS
- Adds complexity for no benefit
- Custom CMS has cleaner API design

### 2. Use tRPC or GraphQL

**Rejected because:**
- Overkill for static site generation
- Adds bundle size and complexity
- REST is sufficient for our needs

### 3. Use React Query / SWR

**Rejected because:**
- Astro SSG doesn't need client-side caching
- Adds unnecessary dependencies
- Server-side fetch is sufficient

### 4. Keep Separate Fetch Implementations

**Rejected because:**
- Already proven problematic
- Hard to maintain
- Inconsistent behavior across modules

## References

- [Commit: Unify API client](https://github.com/ivokun/ivokun.com/commit/54783fc)
- [src/api/cms.ts](../../web/src/api/cms.ts)
- [src/utils/tiptap.ts](../../web/src/utils/tiptap.ts)
- [ADR-007: Migration from Strapi to Custom CMS](./007-strapi-to-custom-cms-migration.md)
- [TipTap Documentation](https://tiptap.dev/)
