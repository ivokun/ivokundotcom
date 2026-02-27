-- migrate:up

-- =============================================================================
-- COMPOSITE INDEXES FOR PUBLIC API PERFORMANCE (L3)
-- =============================================================================

-- Partial composite index for published posts listing
-- Optimizes: SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC
CREATE INDEX IF NOT EXISTS idx_posts_status_published
    ON posts (status, published_at DESC NULLS LAST)
    WHERE status = 'published';

-- Partial composite index for published galleries listing
-- Optimizes: SELECT * FROM galleries WHERE status = 'published' ORDER BY published_at DESC
CREATE INDEX IF NOT EXISTS idx_galleries_status_published
    ON galleries (status, published_at DESC NULLS LAST)
    WHERE status = 'published';

-- Note: idx_media_status already exists from 20260220102009_media_upload_status.sql

-- migrate:down

DROP INDEX IF EXISTS idx_galleries_status_published;
DROP INDEX IF EXISTS idx_posts_status_published;
