import { createId } from '@paralleldrive/cuid2';
import { Context, Effect, Layer } from 'effect';
import slugify from 'slugify';

import {
  DatabaseError,
  isUniqueConstraintViolation,
  NotFound,
  SlugConflict,
  ValidationError,
} from '../errors';
import type { Category, CategoryUpdate, NewCategory, PaginatedResponse } from '../types';
import { DbService } from './db.service';

export class CategoryService extends Context.Tag('CategoryService')<
  CategoryService,
  {
    readonly create: (
      data: Omit<NewCategory, 'id' | 'created_at' | 'updated_at' | 'slug'> & { slug?: string }
    ) => Effect.Effect<Category, DatabaseError | SlugConflict>;
    readonly update: (
      id: string,
      data: CategoryUpdate
    ) => Effect.Effect<Category, DatabaseError | NotFound | SlugConflict>;
    readonly delete: (id: string) => Effect.Effect<void, DatabaseError | NotFound | ValidationError>;
    readonly findById: (id: string) => Effect.Effect<Category, DatabaseError | NotFound>;
    readonly findBySlug: (slug: string) => Effect.Effect<Category, DatabaseError | NotFound>;
    readonly findAll: (options?: {
      limit?: number;
      offset?: number;
    }) => Effect.Effect<PaginatedResponse<Category>, DatabaseError>;
  }
>() {}

export const makeCategoryService = Effect.gen(function* () {
  const { query } = yield* DbService;

  const generateSlug = (name: string, override?: string): string => {
    return slugify(override || name, { lower: true, strict: true });
  };

  const findById = (id: string) =>
    query('find_category_by_id', (db) =>
      db.selectFrom('categories').selectAll().where('id', '=', id).executeTakeFirst()
    ).pipe(
      Effect.flatMap((category) =>
        category
          ? Effect.succeed(category)
          : Effect.fail(new NotFound({ resource: 'Category', id }))
      )
    );

  const findBySlug = (slug: string) =>
    query('find_category_by_slug', (db) =>
      db.selectFrom('categories').selectAll().where('slug', '=', slug).executeTakeFirst()
    ).pipe(
      Effect.flatMap((category) =>
        category
          ? Effect.succeed(category)
          : Effect.fail(new NotFound({ resource: 'Category', id: slug }))
      )
    );

  const create = (
    data: Omit<NewCategory, 'id' | 'created_at' | 'updated_at' | 'slug'> & { slug?: string }
  ) =>
    Effect.gen(function* () {
      const slug = generateSlug(data.name, data.slug);

      // Check for slug conflict
      const existing = yield* query('check_slug', (db) =>
        db.selectFrom('categories').select('id').where('slug', '=', slug).executeTakeFirst()
      );

      if (existing) {
        return yield* Effect.fail(new SlugConflict({ slug }));
      }

      const newCategory: NewCategory = {
        id: createId(),
        name: data.name,
        slug,
        description: data.description ?? null,
      };

      return yield* query('create_category', (db) =>
        db.insertInto('categories').values(newCategory).returningAll().executeTakeFirstOrThrow()
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
    });

  const update = (id: string, data: CategoryUpdate) =>
    Effect.gen(function* () {
      const current = yield* findById(id);

      let slug = undefined;
      if (data.name || data.slug) {
        const candidate = generateSlug(data.name ?? current.name, data.slug);
        if (candidate !== current.slug) {
          const existing = yield* query('check_slug_update', (db) =>
            db
              .selectFrom('categories')
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

      const updateData: CategoryUpdate = {
        ...data,
        slug: slug ?? undefined,
        updated_at: new Date(),
      };

      return yield* query('update_category', (db) =>
        db
          .updateTable('categories')
          .set(updateData)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow()
      ).pipe(
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
    });

  const delete_ = (id: string) =>
    Effect.gen(function* () {
      // Verify category exists
      yield* findById(id);

      // Check if any posts reference this category
      const postsUsingCategory = yield* query('check_category_usage', (db) =>
        db
          .selectFrom('posts')
          .select((eb) => eb.fn.count<string>('id').as('count'))
          .where('category_id', '=', id)
          .executeTakeFirstOrThrow()
      );

      if (Number(postsUsingCategory.count) > 0) {
        return yield* Effect.fail(
          new ValidationError({
            errors: [{
              path: 'category_id',
              message: `Cannot delete category: ${postsUsingCategory.count} post(s) still reference it`,
            }],
          })
        );
      }

      yield* query('delete_category', (db) =>
        db.deleteFrom('categories').where('id', '=', id).executeTakeFirst()
      );
    });

  const findAll = (options?: { limit?: number; offset?: number }) =>
    Effect.gen(function* () {
      const limit = options?.limit ?? 20;
      const offset = options?.offset ?? 0;

      const [data, countResult] = yield* Effect.all([
        query('find_all_categories', (db) =>
          db
            .selectFrom('categories')
            .selectAll()
            .orderBy('created_at', 'desc')
            .limit(limit)
            .offset(offset)
            .execute()
        ),
        query('count_categories', (db) =>
          db
            .selectFrom('categories')
            .select((eb) => eb.fn.count<string>('id').as('count'))
            .executeTakeFirstOrThrow()
        ),
      ]);

      return {
        data,
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

export const CategoryServiceLive = Layer.effect(CategoryService, makeCategoryService);
