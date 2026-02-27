/**
 * @fileoverview Test Fixtures for E2E Tests
 *
 * Provides reusable test data and factory functions.
 */

import { createId } from '@paralleldrive/cuid2';

// =============================================================================
// POST FIXTURES
// =============================================================================

export interface PostData {
  title: string;
  slug: string;
  excerpt?: string;
  content?: {
    type: 'doc';
    content: Array<Record<string, unknown>>;
  };
  locale?: 'en' | 'id';
}

export const postFixtures: {
  minimal: PostData;
  full: PostData;
  indonesian: PostData;
  create: (override?: Partial<PostData>) => PostData;
} = {
  /** Minimal valid post */
  minimal: {
    title: 'Test Post',
    slug: 'test-post',
    locale: 'en',
  },

  /** Full post with all fields */
  full: {
    title: 'Comprehensive Test Post',
    slug: 'comprehensive-test-post',
    excerpt: 'This is a test excerpt for the post.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello, this is test content!' }],
        },
      ],
    },
    locale: 'en',
  },

  /** Indonesian locale post */
  indonesian: {
    title: 'Posting Uji Coba',
    slug: 'posting-uji-coba',
    locale: 'id',
  },

  /** Generate unique post data */
  create: (override?: Partial<PostData>): PostData => ({
    ...postFixtures.minimal,
    slug: `test-post-${createId().slice(0, 8)}`,
    ...override,
  }),
};

// =============================================================================
// CATEGORY FIXTURES
// =============================================================================

export interface CategoryData {
  name: string;
  slug: string;
  description?: string;
}

export const categoryFixtures: {
  minimal: CategoryData;
  withDescription: CategoryData;
  create: (override?: Partial<CategoryData>) => CategoryData;
} = {
  /** Minimal valid category */
  minimal: {
    name: 'Test Category',
    slug: 'test-category',
  },

  /** Category with description */
  withDescription: {
    name: 'Test Category',
    slug: 'test-category',
    description: 'This is a test category description.',
  },

  /** Generate unique category data */
  create: (override?: Partial<CategoryData>): CategoryData => ({
    ...categoryFixtures.minimal,
    slug: `test-category-${createId().slice(0, 8)}`,
    ...override,
  }),
};

// =============================================================================
// GALLERY FIXTURES
// =============================================================================

export interface GalleryData {
  title: string;
  slug: string;
  description?: string;
}

export const galleryFixtures: {
  minimal: GalleryData;
  withDescription: GalleryData;
  create: (override?: Partial<GalleryData>) => GalleryData;
} = {
  /** Minimal valid gallery */
  minimal: {
    title: 'Test Gallery',
    slug: 'test-gallery',
  },

  /** Gallery with description */
  withDescription: {
    title: 'Test Gallery',
    slug: 'test-gallery',
    description: 'This is a test gallery description.',
  },

  /** Generate unique gallery data */
  create: (override?: Partial<GalleryData>): GalleryData => ({
    ...galleryFixtures.minimal,
    slug: `test-gallery-${createId().slice(0, 8)}`,
    ...override,
  }),
};

// =============================================================================
// USER FIXTURES
// =============================================================================

export interface UserData {
  name: string;
  email?: string;
  password: string;
}

export const userFixtures: {
  standard: Omit<UserData, 'email'>;
  create: (override?: Partial<UserData>) => UserData;
} = {
  /** Standard test user */
  standard: {
    name: 'Test User',
    password: 'TestPassword123!',
  },

  /** Generate unique user data */
  create: (override?: Partial<UserData>): UserData => {
    const id = createId().slice(0, 8);
    return {
      ...userFixtures.standard,
      name: `Test User ${id}`,
      email: `test-${id}@example.com`,
      ...override,
    };
  },
};

// =============================================================================
// API KEY FIXTURES
// =============================================================================

export interface ApiKeyData {
  name: string;
}

export const apiKeyFixtures: {
  standard: ApiKeyData;
  create: (override?: Partial<ApiKeyData>) => ApiKeyData;
} = {
  /** Standard API key */
  standard: {
    name: 'Test API Key',
  },

  /** Generate unique API key data */
  create: (override?: Partial<ApiKeyData>): ApiKeyData => ({
    ...apiKeyFixtures.standard,
    name: `Test API Key ${createId().slice(0, 8)}`,
    ...override,
  }),
};

// =============================================================================
// HOME FIXTURES
// =============================================================================

export const homeFixtures = {
  /** Standard home page data */
  standard: {
    title: 'Test Homepage',
    short_description: 'This is a test short description.',
    description: {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Welcome to the test homepage!' }],
        },
      ],
    },
    keywords: 'test, homepage, cms',
  },
};

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export const validators = {
  /** Check if string is a valid CUID2 ID */
  isCuid2: (id: string): boolean => /^[a-z0-9]{24,}$/.test(id),
};
