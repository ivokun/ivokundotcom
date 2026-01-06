# ADR-004: Image Processing Pipeline

> **Status:** Accepted  
> **Date:** 2025-01-06  
> **Deciders:** ivokun  
> **Related:** ADR-001 (CMS Architecture)

## Context

The CMS handles media uploads for:
- Featured images on blog posts
- Inline images in rich text content
- Photo galleries with multiple images
- Hero images on homepage

Requirements:
1. **Multiple Sizes** - Different variants for different contexts (thumbnails, mobile, desktop)
2. **Modern Format** - WebP for better compression
3. **Fast Delivery** - CDN-friendly URLs
4. **Storage Efficiency** - Reasonable file sizes
5. **Alt Text** - Accessibility support

## Decision

We implemented a Sharp-based image processing pipeline that generates 4 variants for every upload.

### Variant Specification

| Variant | Max Width | Quality | Use Case |
|---------|-----------|---------|----------|
| `original` | unchanged | 90% | Full-size view, downloads |
| `thumbnail` | 200px | 80% | Admin lists, previews |
| `small` | 800px | 85% | Mobile devices |
| `large` | 1920px | 85% | Desktop, featured images |

All variants are converted to **WebP format** regardless of input format (JPEG, PNG, GIF).

### Storage Structure

Files are stored in Cloudflare R2 with the following key pattern:

```
media/{id}/original.webp
media/{id}/thumbnail.webp
media/{id}/small.webp
media/{id}/large.webp
```

Where `{id}` is a CUID2 identifier generated at upload time.

### Database Schema

```sql
CREATE TABLE media (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,        -- Original filename
  mime_type TEXT NOT NULL,       -- Always 'image/webp' after processing
  size INTEGER NOT NULL,         -- Size of original variant in bytes
  alt TEXT,                      -- Accessibility text
  urls JSONB NOT NULL,           -- { original, thumbnail, small, large }
  width INTEGER,                 -- Original dimensions
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Example `urls` JSON:

```json
{
  "original": "https://static.ivokun.com/media/clx123/original.webp",
  "thumbnail": "https://static.ivokun.com/media/clx123/thumbnail.webp",
  "small": "https://static.ivokun.com/media/clx123/small.webp",
  "large": "https://static.ivokun.com/media/clx123/large.webp"
}
```

### Implementation

```typescript
// Image processing service
const IMAGE_VARIANTS = [
  { name: 'original', width: null, quality: 90 },
  { name: 'thumbnail', width: 200, quality: 80 },
  { name: 'small', width: 800, quality: 85 },
  { name: 'large', width: 1920, quality: 85 },
] as const

export const processImage = (
  id: string,
  buffer: Buffer,
  filename: string
): Effect.Effect<ProcessedImage, ImageProcessingError, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const image = sharp(buffer)
    
    // Get original metadata
    const metadata = yield* Effect.tryPromise({
      try: () => image.metadata(),
      catch: (e) => new ImageProcessingError({ cause: e })
    })

    const urls: Record<string, string> = {}

    // Process all variants in parallel
    yield* Effect.all(
      IMAGE_VARIANTS.map((variant) =>
        Effect.gen(function* () {
          let pipeline = image.clone().webp({ quality: variant.quality })
          
          if (variant.width !== null) {
            pipeline = pipeline.resize(variant.width, null, {
              withoutEnlargement: true,
              fit: 'inside',
            })
          }
          
          const buffer = yield* Effect.tryPromise({
            try: () => pipeline.toBuffer(),
            catch: (e) => new ImageProcessingError({ cause: e })
          })
          
          const key = `media/${id}/${variant.name}.webp`
          urls[variant.name] = yield* storage.upload(key, buffer, 'image/webp')
        })
      ),
      { concurrency: 4 }
    )

    return {
      urls: urls as MediaUrls,
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      size: /* original variant size */,
    }
  })
```

### Upload Flow

```
┌────────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────┐
│   Admin    │     │   Server    │     │   Sharp     │     │    R2    │
│    SPA     │     │   (Hono)    │     │  Pipeline   │     │ Storage  │
└─────┬──────┘     └──────┬──────┘     └──────┬──────┘     └────┬─────┘
      │                   │                   │                 │
      │ POST /admin/api/media                 │                 │
      │ (multipart/form-data)                 │                 │
      │─────────────────►│                   │                 │
      │                   │                   │                 │
      │                   │ Read buffer       │                 │
      │                   │──────────────────►│                 │
      │                   │                   │                 │
      │                   │    ┌──────────────┴──────────────┐  │
      │                   │    │ For each variant:           │  │
      │                   │    │ 1. Resize (if needed)       │  │
      │                   │    │ 2. Convert to WebP          │  │
      │                   │    │ 3. Upload to R2             │──►│
      │                   │    └──────────────┬──────────────┘  │
      │                   │                   │                 │
      │                   │ Return URLs       │                 │
      │                   │◄──────────────────│                 │
      │                   │                   │                 │
      │                   │ Insert into DB    │                 │
      │                   │ (media table)     │                 │
      │                   │                   │                 │
      │   Return media    │                   │                 │
      │◄──────────────────│                   │                 │
      │                   │                   │                 │
```

### Frontend Usage

The blog frontend selects appropriate variant based on context:

```typescript
// In Astro component
const featuredImage = post.featured_media?.urls

// Responsive image with srcset
<img 
  src={featuredImage?.large}
  srcset={`
    ${featuredImage?.small} 800w,
    ${featuredImage?.large} 1920w
  `}
  sizes="(max-width: 800px) 100vw, 1920px"
  alt={post.featured_media?.alt || post.title}
/>

// Thumbnail in list
<img src={featuredImage?.thumbnail} alt={post.title} />
```

## Consequences

### Positive

1. **Optimized Delivery** - WebP reduces file size by 25-35% vs JPEG
2. **Responsive Images** - Multiple sizes for different devices
3. **CDN-Friendly** - Static URLs cacheable by Cloudflare
4. **Consistent Format** - All images in WebP regardless of upload format
5. **Parallel Processing** - 4 variants processed concurrently

### Negative

1. **Storage Cost** - 4x files per upload (mitigated by WebP compression)
2. **Upload Latency** - Processing adds ~2-5 seconds per upload
3. **No GIF Animation** - WebP conversion loses animation (acceptable tradeoff)
4. **No Original Format** - Cannot download original JPEG/PNG

### Neutral

1. **Fixed Sizes** - No dynamic resizing (sufficient for blog use case)
2. **No Art Direction** - Same crop for all variants
3. **Synchronous Processing** - Could be async with job queue if latency becomes issue

## Size Comparison

Example image upload (4032×3024 JPEG, 3.2MB):

| Variant | Dimensions | Size | Reduction |
|---------|------------|------|-----------|
| Original JPEG | 4032×3024 | 3.2 MB | - |
| original.webp | 4032×3024 | 2.1 MB | 34% |
| large.webp | 1920×1440 | 420 KB | 87% |
| small.webp | 800×600 | 85 KB | 97% |
| thumbnail.webp | 200×150 | 8 KB | 99.7% |

**Total storage per image:** ~2.6 MB (vs 3.2 MB original)

## Alternatives Considered

### 1. On-Demand Resizing (Cloudflare Images / imgproxy)

**Rejected because:**
- Additional service to manage
- Cost per transformation
- Latency on first request
- Over-engineered for low-traffic blog

### 2. Client-Side Resizing Before Upload

**Rejected because:**
- Inconsistent browser implementations
- Would still need server-side processing for quality control
- Doesn't solve storage format issue

### 3. Keep Original Format, Resize Only

**Rejected because:**
- Misses WebP compression benefits
- Would need to handle JPEG, PNG, GIF separately
- Larger file sizes

### 4. Single Size + CSS Scaling

**Rejected because:**
- Wastes bandwidth on mobile
- Poor Core Web Vitals scores
- Not responsive-friendly

### 5. More Variants (6-8 sizes)

**Rejected because:**
- Diminishing returns beyond 4 sizes
- Increased storage cost
- Longer upload times
- 4 variants cover common breakpoints adequately

## Future Considerations

1. **AVIF Support** - Consider adding AVIF variant when browser support improves
2. **Lazy Processing** - Generate variants on first access instead of upload
3. **Smart Cropping** - AI-based focal point detection for thumbnails
4. **Video Thumbnails** - Extract frames from video uploads

## References

- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [WebP Compression Study](https://developers.google.com/speed/webp/docs/webp_study)
- [Responsive Images MDN](https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
