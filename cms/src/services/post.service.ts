import slugify from 'slugify';
import { createId } from '@paralleldrive/cuid2';
import { Context, Effect, Layer } from 'effect';

import { DatabaseError, NotFound, SlugConflict } from '../errors';
import type {
  Locale,
  NewPost,
  PaginatedResponse,
  Post,
  PostUpdate,
  PostWithCategory,
  PostWithMedia,
  Status,
} from '../types';

import { DbService } from './db.service';

export interface PostFilter {
  locale?: Locale;
  status?: Status;
  categoryId?: string;
  search?: string;
}

export class PostService extends Context.Tag('PostService')<
  PostService,
  {
    readonly create: (
      data: Omit<NewPost, 'id' | 'created_at' | 'updated_at' | 'slug'> & { slug?: string }
    ) => Effect.Effect<Post, DatabaseError | SlugConflict>;
    readonly update: (
      id: string,
      data: PostUpdate
    ) => Effect.Effect<Post, DatabaseError | NotFound | SlugConflict>;
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

  const generateSlug = (title: string, override?: string): string => {
    return slugify(override || title, { lower: true, strict: true });
  };

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
          'media.created_at as media_created_at',
        ])
        .where('posts.id', '=', id)
        .executeTakeFirst()
    ).pipe(
      Effect.flatMap((result) => {
        if (!result) return Effect.fail(new NotFound({ resource: 'Post', id }));

        const category = result.cat_id
          ? {
              id: result.cat_id,
              name: result.cat_name!,
              slug: result.cat_slug!,
              description: result.cat_desc ?? null,
              created_at: result.cat_created_at!,
              updated_at: result.cat_updated_at!,
            }
          : null;

        const featured_media = result.media_id
          ? {
              id: result.media_id,
              filename: result.media_filename!,
              mime_type: result.media_mime_type!,
              size: result.media_size!,
              alt: result.media_alt ?? null,
              urls: result.media_urls!,
              width: result.media_width ?? null,
              height: result.media_height ?? null,
              created_at: result.media_created_at!,
            }
          : null;

        const post: PostWithMedia = {
          id: result.id,
          title: result.title,
          slug: result.slug,
          excerpt: result.excerpt,
          content: result.content,
          featured_image: result.featured_image,
          read_time_minute: result.read_time_minute,
          category_id: result.category_id,
          locale: result.locale,
          status: result.status,
          published_at: result.published_at,
          created_at: result.created_at,
          updated_at: result.updated_at,
          category,
          featured_media,
        };

        return Effect.succeed(post);
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
          'media.created_at as media_created_at',
        ])
        .where('posts.slug', '=', slug)
        .where('posts.locale', '=', locale)
        .executeTakeFirst()
    ).pipe(
      Effect.flatMap((result) => {
        if (!result) return Effect.fail(new NotFound({ resource: 'Post', id: slug }));

        const category = result.cat_id
          ? {
              id: result.cat_id,
              name: result.cat_name!,
              slug: result.cat_slug!,
              description: result.cat_desc ?? null,
              created_at: result.cat_created_at!,
              updated_at: result.cat_updated_at!,
            }
          : null;

        const featured_media = result.media_id
          ? {
              id: result.media_id,
              filename: result.media_filename!,
              mime_type: result.media_mime_type!,
              size: result.media_size!,
              alt: result.media_alt ?? null,
              urls: result.media_urls!,
              width: result.media_width ?? null,
              height: result.media_height ?? null,
              created_at: result.media_created_at!,
            }
          : null;

        const post: PostWithMedia = {
          id: result.id,
          title: result.title,
          slug: result.slug,
          excerpt: result.excerpt,
          content: result.content,
          featured_image: result.featured_image,
          read_time_minute: result.read_time_minute,
          category_id: result.category_id,
          locale: result.locale,
          status: result.status,
          published_at: result.published_at,
          created_at: result.created_at,
          updated_at: result.updated_at,
          category,
          featured_media,
        };

        return Effect.succeed(post);
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

      return yield* query('create_post', (db) =>
        db.insertInto('posts').values(newPost).returningAll().executeTakeFirstOrThrow()
      );
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

      const updateData: PostUpdate = {
        ...data,
        slug: slug ?? undefined,
        updated_at: new Date(),
      };

      return yield* query('update_post', (db) =>
        db
          .updateTable('posts')
          .set(updateData)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow()
      );
    });

  const delete_ = (id: string) =>
    Effect.gen(function* () {
      const result = yield* query('delete_post', (db) =>
        db.deleteFrom('posts').where('id', '=', id).executeTakeFirst()
      );

      if (Number(result.numDeletedRows) === 0) {
        return yield* Effect.fail(new NotFound({ resource: 'Post', id }));
      }
    });

  const findAll = (options?: {
    limit?: number;
    offset?: number;
    filter?: PostFilter;
  }) =>
    Effect.gen(function* () {
      const limit = options?.limit ?? 10;
      const offset = options?.offset ?? 0;
      const filter = options?.filter;

      const [data, countResult] = yield* Effect.all([
        query('find_all_posts', (db) => {
          let q = db
            .selectFrom('posts')
            .leftJoin('categories', 'posts.category_id', 'categories.id')
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

      const mappedData: PostWithCategory[] = data.map((row) => {
        const category = row.cat_id
          ? {
              id: row.cat_id,
              name: row.cat_name!,
              slug: row.cat_slug!,
              description: row.cat_desc ?? null,
              created_at: row.cat_created_at!,
              updated_at: row.cat_updated_at!,
            }
          : null;

        return {
          id: row.id,
          title: row.title,
          slug: row.slug,
          excerpt: row.excerpt,
          content: row.content,
          featured_image: row.featured_image,
          read_time_minute: row.read_time_minute,
          category_id: row.category_id,
          locale: row.locale,
          status: row.status,
          published_at: row.published_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
          category,
        };
      });

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
