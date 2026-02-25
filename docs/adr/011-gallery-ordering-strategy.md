# ADR-011: Gallery Image Ordering and Resolution Strategy

> **Status:** Accepted  
> **Date:** 2026-02-24  
> **Deciders:** ivokun  
> **Related:** ADR-001 (CMS Architecture), ADR-004 (Image Processing Pipeline), ADR-003 (Admin SPA)

## Context

Photo galleries require the ability to order images in a specific sequence and display a representative cover image. When implementing this feature, we needed to decide:

1. **Ordering mechanism** - How to store and maintain image order
2. **Database schema** - Whether to add a `position` column or use existing structure
3. **API response format** - Whether to resolve media IDs to full objects
4. **Cover image selection** - Explicit field or convention-based

The existing gallery schema stored images as a JSON array of media IDs: `images: string[]`.

## Decision

We implemented an application-layer ordering solution that avoids database migrations while providing a rich API experience.

### 1. Array Position as Order

**Storage Model:** Array index represents order position
```typescript
// Database stores: ["media_123", "media_456", "media_789"]
// Order: media_123 (0), media_456 (1), media_789 (2)
```

**Benefits:**
- No database migration required
- Natural ordering via array operations
- Atomic updates (whole array replaced on save)

**Trade-offs:**
- Cannot query by position in SQL
- Reordering requires updating entire array

### 2. Dual API Response Models

We created two variants of gallery responses for different use cases:

#### Admin API (Structured Entries)
```typescript
interface GalleryImageEntry {
  id: string;      // Synthetic: `${galleryId}-${order}`
  mediaId: string; // Reference to media table
  order: number;   // Computed from array index
}

interface GalleryWithCategory {
  id: string;
  title: string;
  images: GalleryImageEntry[];  // Structured metadata
  // ...
}
```

Used in admin forms for:
- Displaying order numbers
- Reordering operations
- Image management UI

#### Public API (Resolved Media)
```typescript
interface GalleryWithImages {
  id: string;
  title: string;
  images: Media[];  // Fully resolved media objects
  // ...
}
```

Used in public endpoints for:
- Direct frontend consumption
- No additional API calls needed
- Complete image metadata (URLs, alt text, dimensions)

### 3. Service Layer Pattern

The `GalleryService` provides methods for both use cases:

```typescript
class GalleryService {
  // Admin use - returns structured entries
  findAll(): Promise<PaginatedResponse<GalleryWithCategory>>
  findById(id: string): Promise<GalleryWithCategory>
  
  // Public use - returns resolved media
  findAllWithImages(): Promise<PaginatedResponse<GalleryWithImages>>
  findBySlugWithImages(slug: string): Promise<GalleryWithImages>
}
```

### 4. Cover Image Convention

**Decision:** First image in the array serves as the cover/thumbnail.

```typescript
// Cover is always images[0]
const coverImage = gallery.images[0];
```

**Rationale:**
- No additional database field needed
- Intuitive for users (top/first image)
- Matches common gallery UX patterns

### 5. Synthetic ID Generation

For React rendering keys, we generate synthetic IDs:

```typescript
const generateImageId = (galleryId: string, order: number): string =>
  `${galleryId}-${order}`;
```

**Benefits:**
- Stable keys for reordering animations
- Unique within gallery context
- Derived deterministically (no UUID needed)

## Implementation Flow

```
Admin Form Submission:
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  UI State       │────▶│  Extract mediaId │────▶│  Store as    │
│  (ordered       │     │  from entries    │     │  string[]    │
│   entries)      │     │                  │     │              │
└─────────────────┘     └──────────────────┘     └──────────────┘

Public API Response:
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Database       │────▶│  Resolve each    │────▶│  Return      │
│  (string[])     │     │  ID to Media     │     │  Media[]     │
└─────────────────┘     └──────────────────┘     └──────────────┘

Admin API Response:
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Database       │────▶│  Transform to    │────▶│  Return      │
│  (string[])     │     │  GalleryImageEntry│    │  entries[]   │
└─────────────────┘     └──────────────────┘     └──────────────┘
```

## Consequences

### Positive

1. **Zero Database Migration** - Works with existing schema
2. **Clean Separation** - Admin vs public APIs serve different needs
3. **Simple Mental Model** - Array order = display order
4. **No Join Tables** - JSON array is sufficient for galleries
5. **Cover Image Logic** - First image convention is intuitive

### Negative

1. **Dual Service Methods** - Need both `findAll()` and `findAllWithImages()`
2. **Array Updates** - Reordering requires updating entire array
3. **No SQL Ordering** - Cannot sort galleries by image count in database
4. **Synthetic IDs** - React keys are derived, not persistent

### Neutral

1. **Storage vs API Model** - Different structures for different contexts
2. **Client-Side Ordering** - UI handles reordering before save
3. **Eager Loading** - Public API joins with media table

## Code Examples

### Admin Form Reordering

```typescript
// gallery-form.tsx
const moveImage = (index: number, direction: 'up' | 'down') => {
  const newImages = [...images()];
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  
  // Swap positions
  [newImages[index], newImages[targetIndex]] = [
    newImages[targetIndex], 
    newImages[index]
  ];
  
  // Update order numbers
  newImages.forEach((img, i) => img.order = i);
  setImages(newImages);
};
```

### Service Implementation

```typescript
// gallery.service.ts
async findAllWithImages(): Promise<PaginatedResponse<GalleryWithImages>> {
  const galleries = await this.findAllBase();
  
  // Resolve all media IDs in parallel
  const galleriesWithImages = await Promise.all(
    galleries.data.map(async (gallery) => {
      const mediaList = await Promise.all(
        gallery.images.map(id => this.mediaService.findById(id))
      );
      return { ...gallery, images: mediaList.filter(Boolean) };
    })
  );
  
  return { ...galleries, data: galleriesWithImages };
}
```

### Schema Definition

```typescript
// schemas.ts
const GalleryImageInput = Schema.Struct({
  id: Schema.optional(Schema.String),  // Synthetic ID (client-side only)
  mediaId: Cuid2,                      // Actual media reference
  order: Schema.Number,                // Position in array
});
```

## Future Considerations

1. **Drag-and-Drop** - Could add `@thisbeyond/solid-dnd` for more intuitive reordering
2. **Lazy Resolution** - Consider cursor-based loading for galleries with many images
3. **Image Metadata** - May need additional per-image data (captions, focal points)
4. **Gallery Previews** - Could generate thumbnail grid at different breakpoints

## Alternatives Considered

### 1. Add `position` Column to Media Table

**Rejected because:**
- Would require migration
- Media could belong to multiple galleries (position conflicts)
- More complex many-to-many relationship

### 2. Separate Gallery_Images Join Table

**Rejected because:**
- Overkill for JSON array use case
- Adds complexity without benefit
- Slower queries for simple ordering

### 3. Store Full Media Objects in JSON

**Rejected because:**
- Duplicates data from media table
- No referential integrity
- URLs could become stale

### 4. GraphQL with Field Selection

**Rejected because:**
- Overkill for current needs
- Adds bundle size and complexity
- REST with two endpoints is simpler

## References

- [Gallery Service Implementation](../../cms/src/services/gallery.service.ts)
- [Gallery Form Component](../../cms/src/admin/pages/gallery-form.tsx)
- [ADR-004: Image Processing Pipeline](./004-image-processing-pipeline.md)
- [Commit: Gallery management enhancements](https://github.com/ivokun/ivokun.com/commit/00d6426)
