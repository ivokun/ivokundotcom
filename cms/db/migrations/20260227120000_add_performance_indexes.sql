-- migrate:up

-- =============================================================================
-- COMPOSITE INDEXES FOR PUBLIC API PERFORMANCE (L3)
-- =============================================================================

-- Partial composite index for published posts listing
-- Optimizes: SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC
CREATE INDEX idx_posts_status_published
    ON posts (status, published_at DESC NULLS LAST)
    WHERE status = 'published';

-- Partial composite index for published galleries listing
-- Optimizes: SELECT * FROM galleries WHERE status = 'published' ORDER BY published_at DESC
CREATE INDEX idx_galleries_status_published
    ON galleries (status, published_at DESC NULLS LAST)
    WHERE status = 'published';

-- Index on media status for finding pending/processing items
CREATE INDEX idx_media_status ON media (status) WHERE status != 'ready';

-- migrate:down

DROP INDEX IF EXISTS idx_media_status;
DROP INDEX IF EXISTS idx_galleries_status_published;
DROP INDEX IF EXISTS idx_posts_status_published;
