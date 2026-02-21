import { createId } from '@paralleldrive/cuid2';
import { Context, Effect, Layer } from 'effect';
import slugify from 'slugify';

import { DatabaseError, NotFound, SlugConflict } from '../errors';
import type {
  Gallery,
  GalleryUpdate,
  GalleryWithCategory,
  NewGallery,
  PaginatedResponse,
  Status,
} from '../types';
import { DbService } from './db.service';

export interface GalleryFilter {
  status?: Status;
  categoryId?: string;
}

export class GalleryService extends Context.Tag('GalleryService')<
  GalleryService,
  {
    readonly create: (
      data: Omit<NewGallery, 'id' | 'created_at' | 'updated_at' | 'slug'> & { slug?: string }
    ) => Effect.Effect<Gallery, DatabaseError | SlugConflict>;
    readonly update: (
      id: string,
      data: GalleryUpdate
    ) => Effect.Effect<Gallery, DatabaseError | NotFound | SlugConflict>;
    readonly delete: (id: string) => Effect.Effect<void, DatabaseError | NotFound>;
    readonly findById: (id: string) => Effect.Effect<GalleryWithCategory, DatabaseError | NotFound>;
    readonly findBySlug: (slug: string) => Effect.Effect<GalleryWithCategory, DatabaseError | NotFound>;
    readonly findAll: (
      options?: {
        limit?: number;
        offset?: number;
        filter?: GalleryFilter;
      }
    ) => Effect.Effect<PaginatedResponse<GalleryWithCategory>, DatabaseError>;
  }
>() {}

export const makeGalleryService = Effect.gen(function* () {
  const { query } = yield* DbService;

  const generateSlug = (title: string, override?: string): string => {
    return slugify(override || title, { lower: true, strict: true });
  };

  const findById = (id: string) =>
    query('find_gallery_by_id', (db) =>
      db
        .selectFrom('galleries')
        .leftJoin('categories', 'galleries.category_id', 'categories.id')
        .select([
          'galleries.id',
          'galleries.title',
          'galleries.slug',
          'galleries.description',
          'galleries.images',
          'galleries.category_id',
          'galleries.status',
          'galleries.published_at',
          'galleries.created_at',
          'galleries.updated_at',
          // Category fields
          'categories.id as cat_id',
          'categories.name as cat_name',
          'categories.slug as cat_slug',
          'categories.description as cat_desc',
          'categories.created_at as cat_created_at',
          'categories.updated_at as cat_updated_at',
        ])
        .where('galleries.id', '=', id)
        .executeTakeFirst()
    ).pipe(
      Effect.flatMap((result) => {
        if (!result) return Effect.fail(new NotFound({ resource: 'Gallery', id }));

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

        const gallery: GalleryWithCategory = {
          id: result.id,
          title: result.title,
          slug: result.slug,
          description: result.description,
          images: result.images,
          category_id: result.category_id,
          status: result.status,
          published_at: result.published_at,
          created_at: result.created_at,
          updated_at: result.updated_at,
          category,
        };

        return Effect.succeed(gallery);
      })
    );

  const findBySlug = (slug: string) =>
    query('find_gallery_by_slug', (db) =>
      db
        .selectFrom('galleries')
        .leftJoin('categories', 'galleries.category_id', 'categories.id')
        .select([
          'galleries.id',
          'galleries.title',
          'galleries.slug',
          'galleries.description',
          'galleries.images',
          'galleries.category_id',
          'galleries.status',
          'galleries.published_at',
          'galleries.created_at',
          'galleries.updated_at',
          // Category fields
          'categories.id as cat_id',
          'categories.name as cat_name',
          'categories.slug as cat_slug',
          'categories.description as cat_desc',
          'categories.created_at as cat_created_at',
          'categories.updated_at as cat_updated_at',
        ])
        .where('galleries.slug', '=', slug)
        .executeTakeFirst()
    ).pipe(
      Effect.flatMap((result) => {
        if (!result) return Effect.fail(new NotFound({ resource: 'Gallery', id: slug }));

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

        const gallery: GalleryWithCategory = {
          id: result.id,
          title: result.title,
          slug: result.slug,
          description: result.description,
          images: result.images,
          category_id: result.category_id,
          status: result.status,
          published_at: result.published_at,
          created_at: result.created_at,
          updated_at: result.updated_at,
          category,
        };

        return Effect.succeed(gallery);
      })
    );

  const create = (
    data: Omit<NewGallery, 'id' | 'created_at' | 'updated_at' | 'slug'> & { slug?: string }
  ) =>
    Effect.gen(function* () {
      const slug = generateSlug(data.title, data.slug);

      // Check for slug conflict
      const existing = yield* query('check_gallery_slug', (db) =>
        db.selectFrom('galleries').select('id').where('slug', '=', slug).executeTakeFirst()
      );

      if (existing) {
        return yield* Effect.fail(new SlugConflict({ slug }));
      }

      const newGallery: NewGallery = {
        id: createId(),
        title: data.title,
        slug,
        description: data.description ?? null,
        images: data.images ?? [],
        category_id: data.category_id ?? null,
        status: data.status,
        published_at: data.published_at ?? null,
      };

      return yield* query('create_gallery', (db) =>
        db.insertInto('galleries').values(newGallery).returningAll().executeTakeFirstOrThrow()
      );
    });

  const update = (id: string, data: GalleryUpdate) =>
    Effect.gen(function* () {
      const current = yield* query('get_gallery_for_update', (db) =>
        db.selectFrom('galleries').select(['title', 'slug']).where('id', '=', id).executeTakeFirst()
      );

      if (!current) return yield* Effect.fail(new NotFound({ resource: 'Gallery', id }));

      let slug = undefined;

      if (data.title || data.slug) {
        const candidate = generateSlug(data.title ?? current.title, data.slug);

        if (candidate !== current.slug) {
          const existing = yield* query('check_gallery_slug_update', (db) =>
            db
              .selectFrom('galleries')
              .select('id')
              .where('slug', '=', candidate)
              .where('id', '!=', id)
              .executeTakeFirst()
          );

          if (existing) {
            return yield* Effect.fail(new SlugConflict({ slug: candidate }));
          }
          slug = candidate;
        }
      }

      const updateData: GalleryUpdate = {
        ...data,
        slug: slug ?? undefined,
        updated_at: new Date(),
      };

      return yield* query('update_gallery', (db) =>
        db
          .updateTable('galleries')
          .set(updateData)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow()
      );
    });

  const delete_ = (id: string) =>
    Effect.gen(function* () {
      const result = yield* query('delete_gallery', (db) =>
        db.deleteFrom('galleries').where('id', '=', id).executeTakeFirst()
      );

      if (Number(result.numDeletedRows) === 0) {
        return yield* Effect.fail(new NotFound({ resource: 'Gallery', id }));
      }
    });

  const findAll = (options?: {
    limit?: number;
    offset?: number;
    filter?: GalleryFilter;
  }) =>
    Effect.gen(function* () {
      const limit = options?.limit ?? 10;
      const offset = options?.offset ?? 0;
      const filter = options?.filter;

      const [data, countResult] = yield* Effect.all([
        query('find_all_galleries', (db) => {
          let q = db
            .selectFrom('galleries')
            .leftJoin('categories', 'galleries.category_id', 'categories.id')
            .select([
              'galleries.id',
              'galleries.title',
              'galleries.slug',
              'galleries.description',
              'galleries.images',
              'galleries.category_id',
              'galleries.status',
              'galleries.published_at',
              'galleries.created_at',
              'galleries.updated_at',
              // Category fields
              'categories.id as cat_id',
              'categories.name as cat_name',
              'categories.slug as cat_slug',
              'categories.description as cat_desc',
              'categories.created_at as cat_created_at',
              'categories.updated_at as cat_updated_at',
            ])
            .orderBy('galleries.created_at', 'desc')
            .limit(limit)
            .offset(offset);

          if (filter?.status) {
            q = q.where('galleries.status', '=', filter.status);
          }
          if (filter?.categoryId) {
            q = q.where('galleries.category_id', '=', filter.categoryId);
          }

          return q.execute();
        }),
        query('count_galleries', (db) => {
          let q = db
            .selectFrom('galleries')
            .select((eb) => eb.fn.count<string>('id').as('count'));

          if (filter?.status) {
            q = q.where('status', '=', filter.status);
          }
          if (filter?.categoryId) {
            q = q.where('category_id', '=', filter.categoryId);
          }

          return q.executeTakeFirstOrThrow();
        }),
      ]);

      const mappedData: GalleryWithCategory[] = data.map((row) => {
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
          description: row.description,
          images: row.images,
          category_id: row.category_id,
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

export const GalleryServiceLive = Layer.effect(GalleryService, makeGalleryService);
