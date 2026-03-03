import { createId } from '@paralleldrive/cuid2';
import { Context, Effect, Layer } from 'effect';
import { sql } from 'kysely';
import slugify from 'slugify';

import {
  DatabaseError,
  isUniqueConstraintViolation,
  MediaNotFound,
  NotFound,
  SlugConflict,
} from '../errors';
import type {
  GalleryUpdate,
  GalleryWithCategory,
  GalleryWithImages,
  NewGallery,
  PaginatedResponse,
  Status,
} from '../types';
import { DbService } from './db.service';
import { MediaService } from './media.service';
import { WebhookService } from './webhook.service';

/**
 * Safely coerce a JSONB value returned by pg into a string[].
 * The pg driver may return an object (`{}`) for an empty JS array
 * because it serializes `[]` as a PostgreSQL text array literal,
 * which JSONB then stores as an empty object.
 */
const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value as string[];
  return [];
};

export interface GalleryFilter {
  status?: Status;
  categoryId?: string;
}

export class GalleryService extends Context.Tag('GalleryService')<
  GalleryService,
  {
    readonly create: (
      data: Omit<NewGallery, 'id' | 'created_at' | 'updated_at' | 'slug'> & { slug?: string }
    ) => Effect.Effect<GalleryWithCategory, DatabaseError | SlugConflict | MediaNotFound>;
    readonly update: (
      id: string,
      data: GalleryUpdate
    ) => Effect.Effect<GalleryWithCategory, DatabaseError | NotFound | SlugConflict | MediaNotFound>;
    readonly delete: (id: string) => Effect.Effect<void, DatabaseError | NotFound>;
    readonly findById: (id: string) => Effect.Effect<GalleryWithCategory, DatabaseError | NotFound>;
    readonly findBySlug: (slug: string) => Effect.Effect<GalleryWithCategory, DatabaseError | NotFound>;
    readonly findBySlugWithImages: (slug: string) => Effect.Effect<GalleryWithImages, DatabaseError | NotFound>;
    readonly findAll: (
      options?: {
        limit?: number;
        offset?: number;
        filter?: GalleryFilter;
      }
    ) => Effect.Effect<PaginatedResponse<GalleryWithCategory>, DatabaseError>;
    readonly findAllWithImages: (
      options?: {
        limit?: number;
        offset?: number;
        filter?: GalleryFilter;
      }
    ) => Effect.Effect<PaginatedResponse<GalleryWithImages>, DatabaseError>;
  }
>() {}

export const makeGalleryService = Effect.gen(function* () {
  const { query } = yield* DbService;
  const mediaService = yield* MediaService;
  const webhookService = yield* WebhookService;

  // Helper to trigger deploy in background (fire-and-forget)
  const triggerDeploy = () =>
    webhookService.triggerDeploy().pipe(
      Effect.catchAll((error) =>
        Effect.logWarning(`Deploy webhook failed: ${error.message}`).pipe(Effect.andThen(() => Effect.void))
      ),
      Effect.fork,
      Effect.andThen(() => Effect.void)
    );

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
          images: asStringArray(result.images).map((mediaId, order) => ({
            id: `${result.id}-${order}`,
            mediaId,
            order,
          })),
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
          images: asStringArray(result.images).map((mediaId, order) => ({
            id: `${result.id}-${order}`,
            mediaId,
            order,
          })),
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

      // Validate media existence if images provided
      if (data.images && data.images.length > 0) {
        const mediaIds = data.images;
        const mediaItems = yield* query('check_media_exists', (db) =>
          db
            .selectFrom('media')
            .select(['id', 'status'])
            .where('id', 'in', mediaIds)
            .execute()
        );

        const readyMediaIds = new Set(
          mediaItems.filter((m) => m.status === 'ready').map((m) => m.id)
        );

        for (const mediaId of mediaIds) {
          if (!readyMediaIds.has(mediaId)) {
            return yield* Effect.fail(new MediaNotFound({ mediaId }));
          }
        }
      }

      const id = createId();
      const imagesJson = JSON.stringify(data.images ?? []);

      const result = yield* query('create_gallery', (db) =>
        db
          .insertInto('galleries')
          .values({
            id,
            title: data.title,
            slug,
            description: data.description ?? null,
            // JSON.stringify + sql cast is required because the pg driver
            // does not automatically serialise JS arrays to JSONB – it
            // sends a PostgreSQL array literal instead, which either
            // errors or silently stores the wrong value (e.g. `{}` for `[]`).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            images: sql`${imagesJson}::jsonb` as any,
            category_id: data.category_id ?? null,
            status: data.status,
            published_at: data.published_at ?? null,
          })
          .returningAll()
          .executeTakeFirstOrThrow()
      ).pipe(
        Effect.catchAll((error: DatabaseError) => {
          // If the DB throws a unique constraint violation, convert to SlugConflict
          if (isUniqueConstraintViolation(error.cause)) {
            return Effect.fail(new SlugConflict({ slug })) as Effect.Effect<
              never,
              DatabaseError | SlugConflict
            >;
          }
          return Effect.fail(error) as Effect.Effect<never, DatabaseError | SlugConflict>;
        })
      );

      // Transform images to structured format for response
      const imageIds = asStringArray(result.images);

      // Trigger deploy after successful create
      yield* triggerDeploy();

      return {
        ...result,
        images: imageIds.map((mediaId, order) => ({
          id: `${result.id}-${order}`,
          mediaId,
          order,
        })),
        category: null,
      };
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

      // Validate media existence if images provided
      if (data.images !== undefined && data.images.length > 0) {
        const mediaIds = data.images;
        const mediaItems = yield* query('check_media_exists_update', (db) =>
          db
            .selectFrom('media')
            .select(['id', 'status'])
            .where('id', 'in', mediaIds)
            .execute()
        );

        const readyMediaIds = new Set(
          mediaItems.filter((m) => m.status === 'ready').map((m) => m.id)
        );

        for (const mediaId of mediaIds) {
          if (!readyMediaIds.has(mediaId)) {
            return yield* Effect.fail(new MediaNotFound({ mediaId }));
          }
        }
      }

      const updateData: GalleryUpdate = {
        ...data,
        slug: slug ?? undefined,
        updated_at: new Date(),
      };

      // Remove images from the update data – it will be set separately
      // via sql cast to avoid pg driver JSONB serialisation issues.
      const { images: rawImages, ...updateWithoutImages } = updateData;

      const result = yield* query('update_gallery', (db) => {
        let q = db
          .updateTable('galleries')
          .set(updateWithoutImages)
          .where('id', '=', id);

        if (rawImages !== undefined) {
          const imagesJson = JSON.stringify(rawImages);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          q = q.set({ images: sql`${imagesJson}::jsonb` } as any);
        }

        return q.returningAll().executeTakeFirstOrThrow();
      }).pipe(
        Effect.catchAll((error: DatabaseError) => {
          // If the DB throws a unique constraint violation, convert to SlugConflict
          if (isUniqueConstraintViolation(error.cause)) {
            return Effect.fail(new SlugConflict({ slug: slug ?? current.slug })) as Effect.Effect<
              never,
              DatabaseError | SlugConflict
            >;
          }
          return Effect.fail(error) as Effect.Effect<never, DatabaseError | SlugConflict>;
        })
      );

      // Fetch category separately since the update query doesn't join
      let category = null;
      if (result.category_id) {
        category = yield* query('get_category_for_gallery', (db) =>
          db
            .selectFrom('categories')
            .select(['id', 'name', 'slug', 'description', 'created_at', 'updated_at'])
            .where('id', '=', result.category_id)
            .executeTakeFirst()
        );
      }
      
      // Transform images to structured format for frontend
      const updateImageIds = asStringArray(result.images);

      // Trigger deploy after successful update
      yield* triggerDeploy();

      return {
        ...result,
        images: updateImageIds.map((mediaId, order) => ({
          id: `${result.id}-${order}`,
          mediaId,
          order,
        })),
        category: category
          ? {
              id: category.id,
              name: category.name,
              slug: category.slug,
              description: category.description ?? null,
              created_at: category.created_at,
              updated_at: category.updated_at,
            }
          : null,
      };
    });

  const delete_ = (id: string) =>
    Effect.gen(function* () {
      const result = yield* query('delete_gallery', (db) =>
        db.deleteFrom('galleries').where('id', '=', id).executeTakeFirst()
      );

      if (Number(result.numDeletedRows) === 0) {
        return yield* Effect.fail(new NotFound({ resource: 'Gallery', id }));
      }

      // Trigger deploy after successful delete
      yield* triggerDeploy();
    });

  const findAll = (options?: {
    limit?: number;
    offset?: number;
    filter?: GalleryFilter;
  }) =>
    Effect.gen(function* () {
      const limit = options?.limit ?? 20;
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
          images: asStringArray(row.images).map((mediaId, order) => ({
            id: `${row.id}-${order}`,
            mediaId,
            order,
          })),
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

  // Helper function to resolve image IDs to Media objects
  const resolveImages = (imageIds: string[]) =>
    imageIds.length > 0 ? mediaService.findByIds(imageIds) : Effect.succeed([]);

  const findBySlugWithImages = (slug: string) =>
    Effect.gen(function* () {
      const gallery = yield* findBySlug(slug);
      const imageIds = gallery.images.map((img) => img.mediaId);
      const images = yield* resolveImages(imageIds);
      return { ...gallery, images } as GalleryWithImages;
    });

  const findAllWithImages = (options?: {
    limit?: number;
    offset?: number;
    filter?: GalleryFilter;
  }) =>
    Effect.gen(function* () {
      const result = yield* findAll(options);
      // Collect all unique image IDs
      const allImageIds = [...new Set(result.data.flatMap((g) => g.images.map((img) => img.mediaId)))];
      const allImages = allImageIds.length > 0 ? yield* mediaService.findByIds(allImageIds) : [];
      const imageMap = new Map(allImages.map((m) => [m.id, m]));

      const mappedData: GalleryWithImages[] = result.data.map((gallery) => ({
        ...gallery,
        images: gallery.images.map((img) => imageMap.get(img.mediaId)).filter(Boolean),
      })) as GalleryWithImages[];

      return {
        data: mappedData,
        meta: result.meta,
      };
    });

  return {
    create,
    update,
    delete: delete_,
    findById,
    findBySlug,
    findBySlugWithImages,
    findAll,
    findAllWithImages,
  };
});

export const GalleryServiceLive = Layer.effect(GalleryService, makeGalleryService);
