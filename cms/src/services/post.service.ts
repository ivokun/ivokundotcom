import { createId } from '@paralleldrive/cuid2';
import { Context, Effect, Layer } from 'effect';
import slugify from 'slugify';

import {
  CategoryNotFound,
  DatabaseError,
  isUniqueConstraintViolation,
  NotFound,
  SlugConflict,
} from '../errors';
import type {
  Locale,
  MediaStatus,
  NewPost,
  PaginatedResponse,
  Post,
  PostUpdate,
  PostWithCategory,
  PostWithMedia,
  Status,
} from '../types';
import { DbService } from './db.service';
import { WebhookService } from './webhook.service';

export interface PostFilter {
  locale?: Locale;
  status?: Status;
  categoryId?: string;
  search?: string;
}

/**
 * Raw query result with aliased columns from joins.
 * Kysely doesn't automatically type aliased columns in the result.
 */
interface PostQueryResult {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: unknown;
  featured_image: string | null;
  read_time_minute: number | null;
  category_id: string | null;
  locale: Locale;
  status: Status;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // Category fields (aliased)
  cat_id: string | null;
  cat_name: string | null;
  cat_slug: string | null;
  cat_desc: string | null;
  cat_created_at: Date | null;
  cat_updated_at: Date | null;
  // Media fields (aliased)
  media_id: string | null;
  media_filename: string | null;
  media_mime_type: string | null;
  media_size: number | null;
  media_alt: string | null;
  media_urls: unknown;
  media_width: number | null;
  media_height: number | null;
  media_status: MediaStatus | null;
  media_upload_key: string | null;
  media_created_at: Date | null;
}

export class PostService extends Context.Tag('PostService')<
  PostService,
  {
    readonly create: (
      data: Omit<NewPost, 'id' | 'created_at' | 'updated_at' | 'slug'> & { slug?: string }
    ) => Effect.Effect<Post, DatabaseError | SlugConflict | CategoryNotFound>;
    readonly update: (
      id: string,
      data: PostUpdate
    ) => Effect.Effect<Post, DatabaseError | NotFound | SlugConflict | CategoryNotFound>;
    readonly delete: (id: string) => Effect.Effect<void, DatabaseError | NotFound>;
    readonly findById: (id: string) => Effect.Effect<PostWithMedia, DatabaseError | NotFound>;
    readonly findBySlug: (
      slug: string,
      locale?: Locale
    ) => Effect.Effect<PostWithMedia, DatabaseError | NotFound>;
    readonly findAll: (
      options?: {
        limit?: number;
        offset?: number;
        filter?: PostFilter;
      }
    ) => Effect.Effect<PaginatedResponse<PostWithCategory>, DatabaseError>;
  }
>() {}

export const makePostService = Effect.gen(function* () {
  const { query } = yield* DbService;
  const webhookService = yield* WebhookService;

  // Helper to trigger deploy in background (fire-and-forget)
  const triggerDeploy = () =>
    Effect.gen(function* () {
      yield* Effect.log('[PostService] Calling webhookService.triggerDeploy()');
      const forkedFiber = yield* webhookService.triggerDeploy().pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(`[PostService] Deploy webhook failed: ${error.message}`).pipe(Effect.andThen(() => Effect.void))
        ),
        Effect.fork
      );
      yield* Effect.log(`[PostService] webhookService.triggerDeploy() forked, fiber id: ${forkedFiber.id()}`);
    });

  const generateSlug = (title: string, override?: string): string => {
    return slugify(override || title, { lower: true, strict: true });
  };

  // Helper to map category from query result
  const mapCategory = (row: PostQueryResult) =>
    row.cat_id
      ? {
          id: row.cat_id,
          name: row.cat_name!,
          slug: row.cat_slug!,
          description: row.cat_desc ?? null,
          created_at: row.cat_created_at!,
          updated_at: row.cat_updated_at!,
        }
      : null;

  // Helper to map featured media from query result
  const mapFeaturedMedia = (row: PostQueryResult) =>
    row.media_id
      ? {
          id: row.media_id,
          filename: row.media_filename!,
          mime_type: row.media_mime_type!,
          size: row.media_size!,
          alt: row.media_alt ?? null,
          urls: (row.media_urls as import('../types').MediaUrls | null) ?? null,
          width: row.media_width ?? null,
          height: row.media_height ?? null,
          status: row.media_status ?? 'ready',
          upload_key: row.media_upload_key ?? null,
          created_at: row.media_created_at!,
        }
      : null;

  // Helper to map DB row to PostWithMedia (for findById/findBySlug with joins)
  const mapPostDetailRow = (row: PostQueryResult): PostWithMedia => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content as import('../types').TipTapDocument | null,
    featured_image: row.featured_image,
    read_time_minute: row.read_time_minute,
    category_id: row.category_id,
    locale: row.locale,
    status: row.status,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: mapCategory(row),
    featured_media: mapFeaturedMedia(row),
  });

  // Helper to map DB row to PostWithCategory (for findAll with joins)
  const mapPostListRow = (row: PostQueryResult): PostWithCategory => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content as import('../types').TipTapDocument | null,
    featured_image: row.featured_image,
    read_time_minute: row.read_time_minute,
    category_id: row.category_id,
    locale: row.locale,
    status: row.status,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: mapCategory(row),
    featured_media: mapFeaturedMedia(row),
  });

  const findById = (id: string) =>
    query('find_post_by_id', (db) =>
      db
        .selectFrom('posts')
        .leftJoin('categories', 'posts.category_id', 'categories.id')
        .leftJoin('media', 'posts.featured_image', 'media.id')
        .select([
          'posts.id',
          'posts.title',
          'posts.slug',
          'posts.excerpt',
          'posts.content',
          'posts.featured_image',
          'posts.read_time_minute',
          'posts.category_id',
          'posts.locale',
          'posts.status',
          'posts.published_at',
          'posts.created_at',
          'posts.updated_at',
          // Category fields
          'categories.id as cat_id',
          'categories.name as cat_name',
          'categories.slug as cat_slug',
          'categories.description as cat_desc',
          'categories.created_at as cat_created_at',
          'categories.updated_at as cat_updated_at',
          // Media fields
          'media.id as media_id',
          'media.filename as media_filename',
          'media.mime_type as media_mime_type',
          'media.size as media_size',
          'media.alt as media_alt',
          'media.urls as media_urls',
          'media.width as media_width',
          'media.height as media_height',
          'media.status as media_status',
          'media.upload_key as media_upload_key',
          'media.created_at as media_created_at',
        ])
        .where('posts.id', '=', id)
        .executeTakeFirst()
    ).pipe(
      Effect.flatMap((result) => {
        if (!result) return Effect.fail(new NotFound({ resource: 'Post', id }));
        return Effect.succeed(mapPostDetailRow(result as PostQueryResult));
      })
    );

  const findBySlug = (slug: string, locale: Locale = 'en') =>
    query('find_post_by_slug', (db) =>
      db
        .selectFrom('posts')
        .leftJoin('categories', 'posts.category_id', 'categories.id')
        .leftJoin('media', 'posts.featured_image', 'media.id')
        .select([
          'posts.id',
          'posts.title',
          'posts.slug',
          'posts.excerpt',
          'posts.content',
          'posts.featured_image',
          'posts.read_time_minute',
          'posts.category_id',
          'posts.locale',
          'posts.status',
          'posts.published_at',
          'posts.created_at',
          'posts.updated_at',
          // Category fields
          'categories.id as cat_id',
          'categories.name as cat_name',
          'categories.slug as cat_slug',
          'categories.description as cat_desc',
          'categories.created_at as cat_created_at',
          'categories.updated_at as cat_updated_at',
          // Media fields
          'media.id as media_id',
          'media.filename as media_filename',
          'media.mime_type as media_mime_type',
          'media.size as media_size',
          'media.alt as media_alt',
          'media.urls as media_urls',
          'media.width as media_width',
          'media.height as media_height',
          'media.status as media_status',
          'media.upload_key as media_upload_key',
          'media.created_at as media_created_at',
        ])
        .where('posts.slug', '=', slug)
        .where('posts.locale', '=', locale)
        .executeTakeFirst()
    ).pipe(
      Effect.flatMap((result) => {
        if (!result) return Effect.fail(new NotFound({ resource: 'Post', id: slug }));
        return Effect.succeed(mapPostDetailRow(result as PostQueryResult));
      })
    );

  const create = (
    data: Omit<NewPost, 'id' | 'created_at' | 'updated_at' | 'slug'> & { slug?: string }
  ) =>
    Effect.gen(function* () {
      const slug = generateSlug(data.title, data.slug);
      const locale = data.locale;

      // Check for slug conflict in same locale
      const existing = yield* query('check_post_slug', (db) =>
        db
          .selectFrom('posts')
          .select('id')
          .where('slug', '=', slug)
          .where('locale', '=', locale)
          .executeTakeFirst()
      );

      if (existing) {
        return yield* Effect.fail(new SlugConflict({ slug, locale }));
      }

      // Validate category_id if provided
      if (data.category_id) {
        const category = yield* query('check_category_exists', (db) =>
          db.selectFrom('categories').select('id').where('id', '=', data.category_id!).executeTakeFirst()
        );
        if (!category) {
          return yield* Effect.fail(new CategoryNotFound({ categoryId: data.category_id }));
        }
      }

      const newPost: NewPost = {
        id: createId(),
        title: data.title,
        slug,
        excerpt: data.excerpt ?? null,
        content: data.content ?? null,
        featured_image: data.featured_image ?? null,
        read_time_minute: data.read_time_minute ?? null,
        category_id: data.category_id ?? null,
        locale,
        status: data.status,
        published_at: data.published_at ?? null,
      };

      const result = yield* query('create_post', (db) =>
        db.insertInto('posts').values(newPost).returningAll().executeTakeFirstOrThrow()
      ).pipe(
        Effect.catchAll((error: DatabaseError) => {
          // If the DB throws a unique constraint violation, convert to SlugConflict
          if (isUniqueConstraintViolation(error.cause)) {
            return Effect.fail(new SlugConflict({ slug, locale })) as Effect.Effect<
              never,
              DatabaseError | SlugConflict
            >;
          }
          return Effect.fail(error) as Effect.Effect<never, DatabaseError | SlugConflict>;
        })
      );

      // Trigger deploy after successful create
      yield* Effect.log('[PostService] Post created successfully, about to trigger deploy');
      yield* triggerDeploy();

      return result;
    });

  const update = (id: string, data: PostUpdate) =>
    Effect.gen(function* () {
      const current = yield* query('get_post_for_update', (db) =>
        db.selectFrom('posts').select(['title', 'slug', 'locale']).where('id', '=', id).executeTakeFirst()
      );

      if (!current) return yield* Effect.fail(new NotFound({ resource: 'Post', id }));

      let slug = undefined;
      const locale = data.locale ?? current.locale;

      if (data.title || data.slug || data.locale) {
        const candidate = generateSlug(data.title ?? current.title, data.slug);

        // If slug changed OR locale changed (conflict scope changed), check conflict
        if (candidate !== current.slug || locale !== current.locale) {
          const existing = yield* query('check_post_slug_update', (db) =>
            db
              .selectFrom('posts')
              .select('id')
              .where('slug', '=', candidate)
              .where('locale', '=', locale)
              .where('id', '!=', id)
              .executeTakeFirst()
          );

          if (existing) {
            return yield* Effect.fail(new SlugConflict({ slug: candidate, locale }));
          }
          slug = candidate;
        }
      }

      // Validate category_id if provided
      if (data.category_id !== undefined && data.category_id !== null) {
        const category = yield* query('check_category_exists_update', (db) =>
          db.selectFrom('categories').select('id').where('id', '=', data.category_id!).executeTakeFirst()
        );
        if (!category) {
          return yield* Effect.fail(new CategoryNotFound({ categoryId: data.category_id }));
        }
      }

      const updateData: PostUpdate = {
        ...data,
        slug: slug ?? undefined,
        updated_at: new Date(),
      };

      const result = yield* query('update_post', (db) =>
        db
          .updateTable('posts')
          .set(updateData)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow()
      ).pipe(
        Effect.catchAll((error: DatabaseError) => {
          // If the DB throws a unique constraint violation, convert to SlugConflict
          if (isUniqueConstraintViolation(error.cause)) {
            return Effect.fail(new SlugConflict({ slug: slug ?? current.slug, locale })) as Effect.Effect<
              never,
              DatabaseError | SlugConflict
            >;
          }
          return Effect.fail(error) as Effect.Effect<never, DatabaseError | SlugConflict>;
        })
      );

      // Trigger deploy after successful update
      yield* Effect.log('[PostService] Post updated successfully, about to trigger deploy');
      yield* triggerDeploy();

      return result;
    });

  const delete_ = (id: string) =>
    Effect.gen(function* () {
      const result = yield* query('delete_post', (db) =>
        db.deleteFrom('posts').where('id', '=', id).executeTakeFirst()
      );

      if (Number(result.numDeletedRows) === 0) {
        return yield* Effect.fail(new NotFound({ resource: 'Post', id }));
      }

      // Trigger deploy after successful delete
      yield* Effect.log('[PostService] Post deleted successfully, about to trigger deploy');
      yield* triggerDeploy();
    });

  const findAll = (options?: {
    limit?: number;
    offset?: number;
    filter?: PostFilter;
  }) =>
    Effect.gen(function* () {
      const limit = options?.limit ?? 20;
      const offset = options?.offset ?? 0;
      const filter = options?.filter;

      const [data, countResult] = yield* Effect.all([
        query('find_all_posts', (db) => {
          let q = db
            .selectFrom('posts')
            .leftJoin('categories', 'posts.category_id', 'categories.id')
            .leftJoin('media', 'posts.featured_image', 'media.id')
            .select([
              'posts.id',
              'posts.title',
              'posts.slug',
              'posts.excerpt',
              'posts.content',
              'posts.featured_image',
              'posts.read_time_minute',
              'posts.category_id',
              'posts.locale',
              'posts.status',
              'posts.published_at',
              'posts.created_at',
              'posts.updated_at',
              // Category fields
              'categories.id as cat_id',
              'categories.name as cat_name',
              'categories.slug as cat_slug',
              'categories.description as cat_desc',
              'categories.created_at as cat_created_at',
              'categories.updated_at as cat_updated_at',
              // Media fields
              'media.id as media_id',
              'media.filename as media_filename',
              'media.mime_type as media_mime_type',
              'media.size as media_size',
              'media.alt as media_alt',
              'media.urls as media_urls',
              'media.width as media_width',
              'media.height as media_height',
              'media.status as media_status',
              'media.upload_key as media_upload_key',
              'media.created_at as media_created_at',
            ])
            .orderBy('posts.created_at', 'desc')
            .limit(limit)
            .offset(offset);

          if (filter?.locale) {
            q = q.where('posts.locale', '=', filter.locale);
          }
          if (filter?.status) {
            q = q.where('posts.status', '=', filter.status);
          }
          if (filter?.categoryId) {
            q = q.where('posts.category_id', '=', filter.categoryId);
          }
          if (filter?.search) {
            const term = `%${filter.search}%`;
            q = q.where((eb) =>
              eb.or([eb('posts.title', 'ilike', term), eb('posts.excerpt', 'ilike', term)])
            );
          }

          return q.execute();
        }),
        query('count_posts', (db) => {
          let q = db.selectFrom('posts').select((eb) => eb.fn.count<string>('id').as('count'));

          if (filter?.locale) {
            q = q.where('locale', '=', filter.locale);
          }
          if (filter?.status) {
            q = q.where('status', '=', filter.status);
          }
          if (filter?.categoryId) {
            q = q.where('category_id', '=', filter.categoryId);
          }
          if (filter?.search) {
            const term = `%${filter.search}%`;
            q = q.where((eb) =>
              eb.or([eb('title', 'ilike', term), eb('excerpt', 'ilike', term)])
            );
          }

          return q.executeTakeFirstOrThrow();
        }),
      ]);

      const mappedData: PostWithCategory[] = data.map((row) =>
        mapPostListRow(row as PostQueryResult)
      );

      return {
        data: mappedData,
        meta: {
          total: Number(countResult.count),
          limit,
          offset,
        },
      };
    });

  return {
    create,
    update,
    delete: delete_,
    findById,
    findBySlug,
    findAll,
  };
});

export const PostServiceLive = Layer.effect(PostService, makePostService);
