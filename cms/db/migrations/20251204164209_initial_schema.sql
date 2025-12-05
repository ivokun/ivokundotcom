-- migrate:up

-- =============================================================================
-- ENUMS (PRD Section 6.1)
-- =============================================================================

CREATE TYPE content_status AS ENUM ('draft', 'published');
CREATE TYPE content_locale AS ENUM ('en', 'id');

-- =============================================================================
-- USERS TABLE (PRD Section 6.2.1)
-- Admin users for CMS access
-- =============================================================================

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE INDEX idx_users_email ON users (email);

COMMENT ON TABLE users IS 'Admin users for CMS access (PRD 6.2.1)';
COMMENT ON COLUMN users.id IS 'CUID2 identifier';
COMMENT ON COLUMN users.password_hash IS 'Argon2id hash (PRD SEC-9.1.1)';

-- =============================================================================
-- SESSIONS TABLE (PRD Section 6.2.2)
-- User sessions for admin authentication
-- =============================================================================

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    
    CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) 
        REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

COMMENT ON TABLE sessions IS 'User sessions - 7 day expiry (PRD 6.2.2, SEC-9.1.3)';

-- =============================================================================
-- CATEGORIES TABLE (PRD Section 6.2.3)
-- Content categorization
-- =============================================================================

CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT categories_slug_unique UNIQUE (slug)
);

CREATE INDEX idx_categories_slug ON categories (slug);

COMMENT ON TABLE categories IS 'Content categories (PRD 6.2.3)';

-- =============================================================================
-- MEDIA TABLE (PRD Section 6.2.6)
-- Uploaded media files with processed variants
-- =============================================================================

CREATE TABLE media (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    alt TEXT,
    urls JSONB NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_created_at ON media (created_at DESC);

COMMENT ON TABLE media IS 'Media files with variants (PRD 6.2.6)';
COMMENT ON COLUMN media.urls IS 'JSON: {original, thumbnail, small, large}';

-- =============================================================================
-- POSTS TABLE (PRD Section 6.2.4)
-- Blog posts with i18n support
-- =============================================================================

CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    excerpt TEXT,
    content JSONB,
    featured_image TEXT,
    read_time_minute INTEGER,
    category_id TEXT,
    locale content_locale NOT NULL DEFAULT 'en',
    status content_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT posts_slug_locale_unique UNIQUE (slug, locale),
    CONSTRAINT posts_featured_image_fk FOREIGN KEY (featured_image) 
        REFERENCES media (id) ON DELETE SET NULL,
    CONSTRAINT posts_category_fk FOREIGN KEY (category_id) 
        REFERENCES categories (id) ON DELETE SET NULL
);

CREATE INDEX idx_posts_slug_locale ON posts (slug, locale);
CREATE INDEX idx_posts_status ON posts (status);
CREATE INDEX idx_posts_locale ON posts (locale);
CREATE INDEX idx_posts_category_id ON posts (category_id);
CREATE INDEX idx_posts_published_at ON posts (published_at DESC NULLS LAST);
CREATE INDEX idx_posts_created_at ON posts (created_at DESC);

COMMENT ON TABLE posts IS 'Blog posts with i18n (PRD 6.2.4)';
COMMENT ON COLUMN posts.content IS 'TipTap JSON document';

-- =============================================================================
-- GALLERIES TABLE (PRD Section 6.2.5)
-- Photo galleries
-- =============================================================================

CREATE TABLE galleries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    images JSONB NOT NULL DEFAULT '[]',
    category_id TEXT,
    status content_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT galleries_slug_unique UNIQUE (slug),
    CONSTRAINT galleries_category_fk FOREIGN KEY (category_id) 
        REFERENCES categories (id) ON DELETE SET NULL
);

CREATE INDEX idx_galleries_slug ON galleries (slug);
CREATE INDEX idx_galleries_status ON galleries (status);
CREATE INDEX idx_galleries_category_id ON galleries (category_id);
CREATE INDEX idx_galleries_published_at ON galleries (published_at DESC NULLS LAST);

COMMENT ON TABLE galleries IS 'Photo galleries (PRD 6.2.5)';
COMMENT ON COLUMN galleries.images IS 'Array of media IDs';

-- =============================================================================
-- HOME TABLE (PRD Section 6.2.7)
-- Singleton for homepage content
-- =============================================================================

CREATE TABLE home (
    id TEXT PRIMARY KEY DEFAULT 'singleton',
    title TEXT,
    short_description TEXT,
    description JSONB,
    hero TEXT,
    keywords TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT home_singleton CHECK (id = 'singleton'),
    CONSTRAINT home_hero_fk FOREIGN KEY (hero) 
        REFERENCES media (id) ON DELETE SET NULL
);

-- Insert singleton row
INSERT INTO home (id) VALUES ('singleton');

COMMENT ON TABLE home IS 'Homepage content singleton (PRD 6.2.7)';

-- =============================================================================
-- API_KEYS TABLE (PRD Section 6.2.8)
-- API keys for public API access
-- =============================================================================

CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    prefix TEXT NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_prefix ON api_keys (prefix);

COMMENT ON TABLE api_keys IS 'API keys for public API (PRD 6.2.8)';
COMMENT ON COLUMN api_keys.key_hash IS 'Argon2id hash (PRD SEC-9.1.5)';
COMMENT ON COLUMN api_keys.prefix IS 'First 8 chars for lookup';

-- =============================================================================
-- TRIGGERS FOR updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_galleries_updated_at
    BEFORE UPDATE ON galleries
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_home_updated_at
    BEFORE UPDATE ON home
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- migrate:down

-- Drop triggers
DROP TRIGGER IF EXISTS set_home_updated_at ON home;
DROP TRIGGER IF EXISTS set_galleries_updated_at ON galleries;
DROP TRIGGER IF EXISTS set_categories_updated_at ON categories;
DROP TRIGGER IF EXISTS set_posts_updated_at ON posts;
DROP FUNCTION IF EXISTS trigger_set_updated_at();

-- Drop tables (order matters for foreign keys)
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS home;
DROP TABLE IF EXISTS galleries;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

-- Drop types
DROP TYPE IF EXISTS content_locale;
DROP TYPE IF EXISTS content_status;
