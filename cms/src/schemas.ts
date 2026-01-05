/**
 * @fileoverview Effect Schema definitions for all CMS entities
 * @see PRD Section 6 - Data Model
 * @see PRD Section 7 - API Specification
 */

import { Schema } from 'effect';

// =============================================================================
// PRIMITIVES & ENUMS
// =============================================================================

/** Content locale - PRD Section 3.1.1.9 */
export const Locale = Schema.Literal('en', 'id');
export type Locale = typeof Locale.Type;

/** Content status - PRD FR-3.1.1.4, FR-3.1.1.5 */
export const Status = Schema.Literal('draft', 'published');
export type Status = typeof Status.Type;

/** CUID2 identifier pattern */
export const Cuid2 = Schema.String.pipe(Schema.pattern(/^[a-z0-9]{24,}$/), Schema.brand('Cuid2'));
export type Cuid2 = typeof Cuid2.Type;

/** URL-safe slug */
export const Slug = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  Schema.minLength(1),
  Schema.maxLength(200),
  Schema.brand('Slug')
);
export type Slug = typeof Slug.Type;

/** Email address */
export const Email = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.brand('Email')
);
export type Email = typeof Email.Type;

/** Non-empty string */
export const NonEmptyString = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(10000));

/** Positive integer */
export const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.positive());

// =============================================================================
// MEDIA SCHEMAS - PRD Section 3.2
// =============================================================================

/** Media URLs for image variants */
export const MediaUrls = Schema.Struct({
  original: Schema.String,
  thumbnail: Schema.String,
  small: Schema.String,
  large: Schema.String,
});
export type MediaUrls = typeof MediaUrls.Type;

/** Media entity - PRD Section 6.2.6 */
export const Media = Schema.Struct({
  id: Cuid2,
  filename: NonEmptyString,
  mime_type: Schema.String,
  size: PositiveInt,
  alt: Schema.NullOr(Schema.String),
  urls: MediaUrls,
  width: Schema.NullOr(PositiveInt),
  height: Schema.NullOr(PositiveInt),
  created_at: Schema.Date,
});
export type Media = typeof Media.Type;

// =============================================================================
// CATEGORY SCHEMAS - PRD Section 6.2.3
// =============================================================================

export const Category = Schema.Struct({
  id: Cuid2,
  name: NonEmptyString,
  slug: Slug,
  description: Schema.NullOr(Schema.String),
  created_at: Schema.Date,
  updated_at: Schema.Date,
});
export type Category = typeof Category.Type;

export const CreateCategoryInput = Schema.Struct({
  name: NonEmptyString,
  slug: Slug,
  description: Schema.optional(Schema.String),
});
export type CreateCategoryInput = typeof CreateCategoryInput.Type;

export const UpdateCategoryInput = Schema.Struct({
  name: Schema.optional(NonEmptyString),
  slug: Schema.optional(Slug),
  description: Schema.optional(Schema.NullOr(Schema.String)),
});
export type UpdateCategoryInput = typeof UpdateCategoryInput.Type;

// =============================================================================
// TIPTAP DOCUMENT - PRD FR-3.3.9
// =============================================================================

export const TipTapMark: Schema.Schema<TipTapMarkType> = Schema.Struct({
  type: Schema.String,
  attrs: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});
type TipTapMarkType = {
  type: string;
  attrs?: Record<string, unknown>;
};

export const TipTapNode: Schema.Schema<TipTapNodeType> = Schema.Struct({
  type: Schema.String,
  attrs: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  content: Schema.optional(Schema.Array(Schema.suspend(() => TipTapNode))),
  marks: Schema.optional(Schema.Array(TipTapMark)),
  text: Schema.optional(Schema.String),
});
type TipTapNodeType = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: readonly TipTapNodeType[];
  marks?: readonly TipTapMarkType[];
  text?: string;
};

export const TipTapDocument = Schema.Struct({
  type: Schema.Literal('doc'),
  content: Schema.Array(TipTapNode),
});
export type TipTapDocument = typeof TipTapDocument.Type;

// =============================================================================
// POST SCHEMAS - PRD Section 6.2.4
// =============================================================================

export const Post = Schema.Struct({
  id: Cuid2,
  title: NonEmptyString,
  slug: Slug,
  excerpt: Schema.NullOr(Schema.String),
  content: Schema.NullOr(TipTapDocument),
  featured_image: Schema.NullOr(Cuid2),
  read_time_minute: Schema.NullOr(PositiveInt),
  category_id: Schema.NullOr(Cuid2),
  locale: Locale,
  status: Status,
  published_at: Schema.NullOr(Schema.Date),
  created_at: Schema.Date,
  updated_at: Schema.Date,
});
export type Post = typeof Post.Type;

export const CreatePostInput = Schema.Struct({
  title: NonEmptyString,
  slug: Slug,
  excerpt: Schema.optional(Schema.String),
  content: Schema.optional(TipTapDocument),
  featured_image: Schema.optional(Cuid2),
  category_id: Schema.optional(Cuid2),
  locale: Schema.optionalWith(Locale, { default: () => 'en' as const }),
});
export type CreatePostInput = typeof CreatePostInput.Type;

export const UpdatePostInput = Schema.Struct({
  title: Schema.optional(NonEmptyString),
  slug: Schema.optional(Slug),
  excerpt: Schema.optional(Schema.NullOr(Schema.String)),
  content: Schema.optional(Schema.NullOr(TipTapDocument)),
  featured_image: Schema.optional(Schema.NullOr(Cuid2)),
  category_id: Schema.optional(Schema.NullOr(Cuid2)),
  locale: Schema.optional(Locale),
});
export type UpdatePostInput = typeof UpdatePostInput.Type;

// =============================================================================
// GALLERY SCHEMAS - PRD Section 6.2.5
// =============================================================================

export const Gallery = Schema.Struct({
  id: Cuid2,
  title: NonEmptyString,
  slug: Slug,
  description: Schema.NullOr(Schema.String),
  images: Schema.Array(Cuid2),
  category_id: Schema.NullOr(Cuid2),
  status: Status,
  published_at: Schema.NullOr(Schema.Date),
  created_at: Schema.Date,
  updated_at: Schema.Date,
});
export type Gallery = typeof Gallery.Type;

export const CreateGalleryInput = Schema.Struct({
  title: NonEmptyString,
  slug: Slug,
  description: Schema.optional(Schema.String),
  images: Schema.optional(Schema.Array(Cuid2)),
  category_id: Schema.optional(Cuid2),
});
export type CreateGalleryInput = typeof CreateGalleryInput.Type;

export const UpdateGalleryInput = Schema.Struct({
  title: Schema.optional(NonEmptyString),
  slug: Schema.optional(Slug),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  images: Schema.optional(Schema.Array(Cuid2)),
  category_id: Schema.optional(Schema.NullOr(Cuid2)),
});
export type UpdateGalleryInput = typeof UpdateGalleryInput.Type;

// =============================================================================
// HOME SCHEMAS - PRD Section 6.2.7
// =============================================================================

export const Home = Schema.Struct({
  id: Schema.Literal('singleton'),
  title: Schema.NullOr(Schema.String),
  short_description: Schema.NullOr(Schema.String),
  description: Schema.NullOr(TipTapDocument),
  hero: Schema.NullOr(Cuid2),
  keywords: Schema.NullOr(Schema.String),
  updated_at: Schema.Date,
});
export type Home = typeof Home.Type;

export const UpdateHomeInput = Schema.Struct({
  title: Schema.optional(Schema.NullOr(Schema.String)),
  short_description: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(TipTapDocument)),
  hero: Schema.optional(Schema.NullOr(Cuid2)),
  keywords: Schema.optional(Schema.NullOr(Schema.String)),
});
export type UpdateHomeInput = typeof UpdateHomeInput.Type;

// =============================================================================
// API KEY SCHEMAS - PRD Section 6.2.8
// =============================================================================

export const ApiKey = Schema.Struct({
  id: Cuid2,
  name: NonEmptyString,
  prefix: Schema.String.pipe(Schema.length(8)),
  last_used_at: Schema.NullOr(Schema.Date),
  created_at: Schema.Date,
});
export type ApiKey = typeof ApiKey.Type;

export const CreateApiKeyInput = Schema.Struct({
  name: NonEmptyString,
});
export type CreateApiKeyInput = typeof CreateApiKeyInput.Type;

// =============================================================================
// USER SCHEMAS - PRD Section 6.2.1
// =============================================================================

export const User = Schema.Struct({
  id: Cuid2,
  email: Email,
  name: Schema.NullOr(Schema.String),
  created_at: Schema.Date,
});
export type User = typeof User.Type;

// =============================================================================
// SESSION SCHEMAS - PRD Section 6.2.2
// =============================================================================

export const Session = Schema.Struct({
  id: Cuid2,
  user_id: Cuid2,
  expires_at: Schema.Date,
});
export type Session = typeof Session.Type;

// =============================================================================
// API RESPONSE SCHEMAS - PRD Section 7.1
// =============================================================================

export const PaginationMeta = Schema.Struct({
  total: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  limit: PositiveInt,
  offset: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
});
export type PaginationMeta = typeof PaginationMeta.Type;

export const PaginatedResponse = <T extends Schema.Schema.Any>(itemSchema: T) =>
  Schema.Struct({
    data: Schema.Array(itemSchema),
    meta: PaginationMeta,
  });

export const ListQueryParams = Schema.Struct({
  limit: Schema.optionalWith(PositiveInt, { default: () => 20 }),
  offset: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.nonNegative()), {
    default: () => 0,
  }),
});
export type ListQueryParams = typeof ListQueryParams.Type;

export const PostListQueryParams = Schema.Struct({
  ...ListQueryParams.fields,
  locale: Schema.optional(Locale),
  status: Schema.optional(Status),
  category_id: Schema.optional(Cuid2),
});
export type PostListQueryParams = typeof PostListQueryParams.Type;

// =============================================================================
// AUTH SCHEMAS
// =============================================================================

export const LoginInput = Schema.Struct({
  email: Email,
  password: Schema.String.pipe(Schema.minLength(8)),
});
export type LoginInput = typeof LoginInput.Type;

export const LoginResponse = Schema.Struct({
  user: User,
  session_id: Cuid2,
});
export type LoginResponse = typeof LoginResponse.Type;
