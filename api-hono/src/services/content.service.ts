import { Context, Effect, Layer } from 'effect';
import { nanoid } from 'nanoid';
import slugify from 'slugify';

import { DatabaseService } from '@/config/database';
import type { PostModel } from '@/models/post.model';
import type { CategoryModel } from '@/models/category.model';
import type { GalleryModel } from '@/models/gallery.model';
import type { HomeModel } from '@/models/home.model';

// Helper function to wrap ElectroDB promises with Effect.tryPromise
const tryElectroDB = <T>(
  operation: () => Promise<T>,
  errorMessage: string
) =>
  Effect.tryPromise({
    try: operation,
    catch: (error) => new ContentValidationError(`${errorMessage}: ${String(error)}`),
  });

export class ContentNotFoundError extends Error {
  readonly _tag = 'ContentNotFoundError';
  constructor(type: string, id: string) {
    super(`${type} with id ${id} not found`);
  }
}

export class ContentValidationError extends Error {
  readonly _tag = 'ContentValidationError';
  constructor(message: string) {
    super(message);
  }
}

export class SlugConflictError extends Error {
  readonly _tag = 'SlugConflictError';
  constructor(slug: string) {
    super(`Content with slug ${slug} already exists`);
  }
}

export type ContentError = ContentNotFoundError | ContentValidationError | SlugConflictError;

export interface ContentService {
  // Posts
  readonly createPost: (data: CreatePostData) => Effect.Effect<Post, ContentError>;
  readonly getPost: (id: string, locale?: string) => Effect.Effect<Post, ContentError>;
  readonly getPostBySlug: (slug: string, locale?: string) => Effect.Effect<Post, ContentError>;
  readonly updatePost: (id: string, data: UpdatePostData, locale?: string) => Effect.Effect<Post, ContentError>;
  readonly deletePost: (id: string, locale?: string) => Effect.Effect<void, ContentError>;
  readonly listPosts: (options?: ListPostsOptions) => Effect.Effect<PostList, ContentError>;
  
  // Categories
  readonly createCategory: (data: CreateCategoryData) => Effect.Effect<Category, ContentError>;
  readonly getCategory: (id: string) => Effect.Effect<Category, ContentError>;
  readonly getCategoryBySlug: (slug: string) => Effect.Effect<Category, ContentError>;
  readonly updateCategory: (id: string, data: UpdateCategoryData) => Effect.Effect<Category, ContentError>;
  readonly deleteCategory: (id: string) => Effect.Effect<void, ContentError>;
  readonly listCategories: (options?: ListCategoriesOptions) => Effect.Effect<CategoryList, ContentError>;
  
  // Galleries
  readonly createGallery: (data: CreateGalleryData) => Effect.Effect<Gallery, ContentError>;
  readonly getGallery: (id: string) => Effect.Effect<Gallery, ContentError>;
  readonly getGalleryBySlug: (slug: string) => Effect.Effect<Gallery, ContentError>;
  readonly updateGallery: (id: string, data: UpdateGalleryData) => Effect.Effect<Gallery, ContentError>;
  readonly deleteGallery: (id: string) => Effect.Effect<void, ContentError>;
  readonly listGalleries: (options?: ListGalleriesOptions) => Effect.Effect<GalleryList, ContentError>;
  
  // Home
  readonly getHome: () => Effect.Effect<Home, ContentError>;
  readonly updateHome: (data: UpdateHomeData) => Effect.Effect<Home, ContentError>;
}

export const ContentService = Context.GenericTag<ContentService>('ContentService');

// Type definitions
export type Post = typeof PostModel.data;
export type Category = typeof CategoryModel.data;
export type Gallery = typeof GalleryModel.data;
export type Home = typeof HomeModel.data;

export interface CreatePostData {
  title: string;
  content?: string;
  richContent?: any;
  excerpt?: string;
  readTimeMinute?: number;
  featuredPictureId?: string;
  categoryId?: string;
  locale?: string;
  status?: 'draft' | 'published';
  createdBy?: string;
}

export interface UpdatePostData {
  title?: string;
  content?: string;
  richContent?: any;
  excerpt?: string;
  readTimeMinute?: number;
  featuredPictureId?: string;
  categoryId?: string;
  status?: 'draft' | 'published';
  updatedBy?: string;
}

export interface ListPostsOptions {
  categoryId?: string;
  status?: 'draft' | 'published';
  locale?: string;
  limit?: number;
  cursor?: string;
}

export interface PostList {
  data: Post[];
  cursor?: string;
  hasMore: boolean;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  status?: 'draft' | 'published';
  createdBy?: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  status?: 'draft' | 'published';
  updatedBy?: string;
}

export interface ListCategoriesOptions {
  status?: 'draft' | 'published';
  limit?: number;
  cursor?: string;
}

export interface CategoryList {
  data: Category[];
  cursor?: string;
  hasMore: boolean;
}

export interface CreateGalleryData {
  title: string;
  description?: string;
  imageIds?: string[];
  categoryId?: string;
  status?: 'draft' | 'published';
  createdBy?: string;
}

export interface UpdateGalleryData {
  title?: string;
  description?: string;
  imageIds?: string[];
  categoryId?: string;
  status?: 'draft' | 'published';
  updatedBy?: string;
}

export interface ListGalleriesOptions {
  categoryId?: string;
  status?: 'draft' | 'published';
  limit?: number;
  cursor?: string;
}

export interface GalleryList {
  data: Gallery[];
  cursor?: string;
  hasMore: boolean;
}

export interface UpdateHomeData {
  title?: string;
  description?: string;
  shortDescription?: string;
  keywords?: string;
  heroImageId?: string;
  status?: 'draft' | 'published';
  updatedBy?: string;
}

// Implementation helpers
const generateSlug = (text: string): string => {
  return slugify(text, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });
};

export const ContentServiceLive = Layer.succeed(
  ContentService,
  ContentService.of({
    // Posts implementation
    createPost: (data) =>
      Effect.gen(function* () {
        const id = nanoid();
        const slug = generateSlug(data.title);
        const locale = data.locale || 'en';
        
        const result = yield* tryElectroDB(
          () => DatabaseService.entities.posts.create({
            id,
            ...data,
            slug,
            locale,
            publishedAt: data.status === 'published' ? new Date().toISOString() : undefined,
          }).go(),
          'Failed to create post'
        );
        
        return result.data;
      }),

    getPost: (id, locale = 'en') =>
      Effect.gen(function* () {
        const result = yield* tryElectroDB(
          () => DatabaseService.entities.posts.get({ id, locale }).go(),
          'Failed to get post'
        );
        
        if (!result.data) {
          yield* Effect.fail(new ContentNotFoundError('Post', id));
        }
        return result.data;
      }),

    getPostBySlug: (slug, locale = 'en') =>
      Effect.gen(function* () {
        const results = yield* tryElectroDB(
          () => DatabaseService.entities.posts.scan
            .where((attr, op) => op.eq(attr.slug, slug) && op.eq(attr.locale, locale))
            .go(),
          'Failed to get post by slug'
        );
        
        if (results.data.length === 0) {
          yield* Effect.fail(new ContentNotFoundError('Post', slug));
        }
        
        return results.data[0];
      }),

    updatePost: (id, data, locale = 'en') =>
      Effect.gen(function* () {
        const updateData: any = { ...data };
        
        if (data.title) {
          updateData.slug = generateSlug(data.title);
        }
        
        if (data.status === 'published' && !updateData.publishedAt) {
          updateData.publishedAt = new Date().toISOString();
        }
        
        const result = yield* tryElectroDB(
          () => DatabaseService.entities.posts.update({ id, locale })
            .set(updateData)
            .go(),
          'Failed to update post'
        );
          
        return result.data;
      }),

    deletePost: (id, locale = 'en') =>
      Effect.gen(function* () {
        yield* tryElectroDB(
          () => DatabaseService.entities.posts.delete({ id, locale }).go(),
          'Failed to delete post'
        );
      }),

    listPosts: (options = {}) =>
      Effect.gen(function* () {
        const results = yield* tryElectroDB(
          async () => {
            let query;
            
            if (options.categoryId) {
              query = DatabaseService.entities.posts.query.byCategory({
                categoryId: options.categoryId,
              });
            } else if (options.status) {
              query = DatabaseService.entities.posts.query.byStatus({
                status: options.status,
              });
            } else {
              query = DatabaseService.entities.posts.scan;
            }
            
            if (options.limit) {
              query = query.pages(undefined, options.limit);
            }
            
            return await query.go();
          },
          'Failed to list posts'
        );
        
        return {
          data: results.data,
          cursor: results.cursor,
          hasMore: !!results.cursor,
        };
      }),

    // Categories implementation
    createCategory: (data) =>
      Effect.gen(function* () {
        const id = nanoid();
        const slug = generateSlug(data.name);
        
        const result = yield* tryElectroDB(
          () => DatabaseService.entities.categories.create({
            id,
            ...data,
            slug,
            publishedAt: data.status === 'published' ? new Date().toISOString() : undefined,
          }).go(),
          'Failed to create category'
        );
        
        return result.data;
      }),

    getCategory: (id) =>
      Effect.gen(function* () {
        const result = yield* tryElectroDB(
          () => DatabaseService.entities.categories.get({ id }).go(),
          'Failed to get category'
        );
        
        if (!result.data) {
          yield* Effect.fail(new ContentNotFoundError('Category', id));
        }
        return result.data;
      }),

    getCategoryBySlug: (slug) =>
      Effect.gen(function* () {
        const results = yield* tryElectroDB(
          () => DatabaseService.entities.categories.scan
            .where((attr, op) => op.eq(attr.slug, slug))
            .go(),
          'Failed to get category by slug'
        );
        
        if (results.data.length === 0) {
          yield* Effect.fail(new ContentNotFoundError('Category', slug));
        }
        
        return results.data[0];
      }),

    updateCategory: (id, data) =>
      Effect.gen(function* () {
        const updateData: any = { ...data };
        
        if (data.name) {
          updateData.slug = generateSlug(data.name);
        }
        
        if (data.status === 'published' && !updateData.publishedAt) {
          updateData.publishedAt = new Date().toISOString();
        }
        
        const result = yield* tryElectroDB(
          () => DatabaseService.entities.categories.update({ id })
            .set(updateData)
            .go(),
          'Failed to update category'
        );
          
        return result.data;
      }),

    deleteCategory: (id) =>
      Effect.gen(function* () {
        yield* tryElectroDB(
          () => DatabaseService.entities.categories.delete({ id }).go(),
          'Failed to delete category'
        );
      }),

    listCategories: (options = {}) =>
      Effect.gen(function* () {
        const results = yield* tryElectroDB(
          async () => {
            let query = DatabaseService.entities.categories.scan;
            
            if (options.status) {
              query = query.where((attr, op) => op.eq(attr.status, options.status));
            }
            
            if (options.limit) {
              query = query.pages(undefined, options.limit);
            }
            
            return await query.go();
          },
          'Failed to list categories'
        );
        
        return {
          data: results.data,
          cursor: results.cursor,
          hasMore: !!results.cursor,
        };
      }),

    // Galleries implementation (simplified for now)
    createGallery: (data) =>
      Effect.gen(function* () {
        const id = nanoid();
        const slug = generateSlug(data.title);
        
        const result = yield* tryElectroDB(
          () => DatabaseService.entities.galleries.create({
            id,
            ...data,
            slug,
            publishedAt: data.status === 'published' ? new Date().toISOString() : undefined,
          }).go(),
          'Failed to create gallery'
        );
        
        return result.data;
      }),

    getGallery: (id) =>
      Effect.gen(function* () {
        const result = yield* tryElectroDB(
          () => DatabaseService.entities.galleries.get({ id }).go(),
          'Failed to get gallery'
        );
        
        if (!result.data) {
          yield* Effect.fail(new ContentNotFoundError('Gallery', id));
        }
        return result.data;
      }),

    getGalleryBySlug: (slug) =>
      Effect.gen(function* () {
        const results = yield* tryElectroDB(
          () => DatabaseService.entities.galleries.scan
            .where((attr, op) => op.eq(attr.slug, slug))
            .go(),
          'Failed to get gallery by slug'
        );
        
        if (results.data.length === 0) {
          yield* Effect.fail(new ContentNotFoundError('Gallery', slug));
        }
        
        return results.data[0];
      }),

    updateGallery: (id, data) =>
      Effect.gen(function* () {
        const updateData: any = { ...data };
        
        if (data.title) {
          updateData.slug = generateSlug(data.title);
        }
        
        if (data.status === 'published' && !updateData.publishedAt) {
          updateData.publishedAt = new Date().toISOString();
        }
        
        const result = yield* tryElectroDB(
          () => DatabaseService.entities.galleries.update({ id })
            .set(updateData)
            .go(),
          'Failed to update gallery'
        );
          
        return result.data;
      }),

    deleteGallery: (id) =>
      Effect.gen(function* () {
        yield* tryElectroDB(
          () => DatabaseService.entities.galleries.delete({ id }).go(),
          'Failed to delete gallery'
        );
      }),

    listGalleries: (options = {}) =>
      Effect.gen(function* () {
        const results = yield* tryElectroDB(
          async () => {
            let query;
            
            if (options.categoryId) {
              query = DatabaseService.entities.galleries.query.byCategory({
                categoryId: options.categoryId,
              });
            } else {
              query = DatabaseService.entities.galleries.scan;
            }
            
            if (options.status) {
              query = query.where((attr, op) => op.eq(attr.status, options.status));
            }
            
            if (options.limit) {
              query = query.pages(undefined, options.limit);
            }
            
            return await query.go();
          },
          'Failed to list galleries'
        );
        
        return {
          data: results.data,
          cursor: results.cursor,
          hasMore: !!results.cursor,
        };
      }),

    // Home implementation
    getHome: () =>
      Effect.gen(function* () {
        const result = yield* tryElectroDB(
          () => DatabaseService.entities.home.get({ id: 'home' }).go(),
          'Failed to get home'
        );
        
        if (!result.data) {
          yield* Effect.fail(new ContentNotFoundError('Home', 'home'));
        }
        return result.data;
      }),

    updateHome: (data) =>
      Effect.gen(function* () {
        const updateData: any = { ...data };
        
        if (data.status === 'published' && !updateData.publishedAt) {
          updateData.publishedAt = new Date().toISOString();
        }
        
        const result = yield* tryElectroDB(
          () => DatabaseService.entities.home.update({ id: 'home' })
            .set(updateData)
            .go(),
          'Failed to update home'
        );
          
        return result.data;
      }),
  })
);