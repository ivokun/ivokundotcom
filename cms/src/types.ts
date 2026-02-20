/**
 * @fileoverview Core type definitions for ivokun CMS
 * @see PRD Section 6 - Data Model
 * @see PRD NFR-4.4.1 - 100% TypeScript with strict mode
 */

import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

// =============================================================================
// DATABASE INTERFACE
// Defines all tables for Kysely type-safe queries
// =============================================================================

/**
 * Main database interface for Kysely
 * Maps to PRD Section 6.2 tables
 */
export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  categories: CategoriesTable;
  posts: PostsTable;
  galleries: GalleriesTable;
  home: HomeTable;
  media: MediaTable;
  api_keys: ApiKeysTable;
}

// =============================================================================
// TABLE INTERFACES
// Each interface maps to PRD Section 6.2.x
// =============================================================================

/**
 * Users table - PRD Section 6.2.1
 * Admin users for CMS access
 */
export interface UsersTable {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: Generated<Date>;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

/**
 * Sessions table - PRD Section 6.2.2
 * User sessions - 7 day expiry (SEC-9.1.3)
 */
export interface SessionsTable {
  id: string;
  user_id: string;
  expires_at: Date;
}

export type Session = Selectable<SessionsTable>;
export type NewSession = Insertable<SessionsTable>;

/**
 * Categories table - PRD Section 6.2.3
 * Content categorization
 */
export interface CategoriesTable {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Category = Selectable<CategoriesTable>;
export type NewCategory = Insertable<CategoriesTable>;
export type CategoryUpdate = Updateable<CategoriesTable>;

/**
 * Media upload/processing status
 */
export type MediaStatus = 'uploading' | 'processing' | 'ready' | 'failed';

/**
 * Media table - PRD Section 6.2.6
 * Uploaded media files with processed variants
 */
export interface MediaTable {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  alt: string | null;
  urls: ColumnType<MediaUrls | null, MediaUrls | null, MediaUrls | null>;
  width: number | null;
  height: number | null;
  status: ColumnType<MediaStatus, MediaStatus, MediaStatus>;
  upload_key: string | null;
  created_at: Generated<Date>;
}

export type Media = Selectable<MediaTable>;
export type NewMedia = Insertable<MediaTable>;
export type MediaUpdate = Updateable<MediaTable>;

/**
 * Posts table - PRD Section 6.2.4
 * Blog posts with i18n support
 */
export interface PostsTable {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: ColumnType<TipTapDocument | null, TipTapDocument | null, TipTapDocument | null>;
  featured_image: string | null;
  read_time_minute: number | null;
  category_id: string | null;
  locale: Locale;
  status: Status;
  published_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Post = Selectable<PostsTable>;
export type NewPost = Insertable<PostsTable>;
export type PostUpdate = Updateable<PostsTable>;

/**
 * Galleries table - PRD Section 6.2.5
 * Photo galleries
 */
export interface GalleriesTable {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  images: ColumnType<string[], string[], string[]>;
  category_id: string | null;
  status: Status;
  published_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Gallery = Selectable<GalleriesTable>;
export type NewGallery = Insertable<GalleriesTable>;
export type GalleryUpdate = Updateable<GalleriesTable>;

/**
 * Home table - PRD Section 6.2.7
 * Singleton for homepage content
 */
export interface HomeTable {
  id: string;
  title: string | null;
  short_description: string | null;
  description: ColumnType<TipTapDocument | null, TipTapDocument | null, TipTapDocument | null>;
  hero: string | null;
  keywords: string | null;
  updated_at: Generated<Date>;
}

export type Home = Selectable<HomeTable>;
export type HomeUpdate = Updateable<HomeTable>;

/**
 * API Keys table - PRD Section 6.2.8
 * API keys for public API access
 */
export interface ApiKeysTable {
  id: string;
  name: string;
  key_hash: string;
  prefix: string;
  last_used_at: Date | null;
  created_at: Generated<Date>;
}

export type ApiKey = Selectable<ApiKeysTable>;
export type NewApiKey = Insertable<ApiKeysTable>;

// =============================================================================
// SHARED TYPES
// =============================================================================

/**
 * Supported locales - PRD Section 3.1.1.9
 * Only English and Indonesian (Constraint #2)
 */
export type Locale = 'en' | 'id';

/**
 * Content status - PRD FR-3.1.1.4, FR-3.1.1.5
 */
export type Status = 'draft' | 'published';

/**
 * Media URLs for image variants - PRD Section 3.2
 * @see Image Processing Requirements table
 */
export interface MediaUrls {
  /** Full size, WebP, 90% quality */
  original: string;
  /** 200px wide, 80% quality */
  thumbnail: string;
  /** 800px wide, 85% quality */
  small: string;
  /** 1920px wide, 85% quality */
  large: string;
}

/**
 * TipTap document structure - PRD FR-3.3.9
 * Simplified type for rich text content
 */
export interface TipTapDocument {
  type: 'doc';
  content: TipTapNode[];
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Application configuration - PRD Appendix 16.2
 */
export interface Config {
  /** Server port (default: 3000) */
  port: number;
  /** PostgreSQL connection string */
  databaseUrl: string;
  /** Session signing secret (min 32 chars) */
  sessionSecret: string;
  /** Cloudflare R2 configuration */
  r2: R2Config;
  /** CORS origin (optional) */
  corsOrigin?: string;
}

export interface R2Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucket: string;
  publicUrl: string;
}

// =============================================================================
// API RESPONSE TYPES
// Used by services and handlers
// =============================================================================

/**
 * Paginated response - PRD Section 7.1.2
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Post with expanded relations
 */
export interface PostWithCategory extends Post {
  category: Category | null;
}

export interface PostWithMedia extends PostWithCategory {
  featured_media: Media | null;
}

/**
 * Gallery with expanded category
 */
export interface GalleryWithCategory extends Gallery {
  category: Category | null;
}
