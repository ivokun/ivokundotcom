import { Hono } from 'hono';
import { Effect } from 'effect';

import { ContentService, ContentServiceLive } from '@/services/content.service';
import type { CreateCategoryData, UpdateCategoryData, ListCategoriesOptions } from '@/services/content.service';

const categoriesRouter = new Hono();

// Helper function to run Effect programs
const runEffect = async <A, E>(effect: Effect.Effect<A, E>) => {
  const program = Effect.provide(effect, ContentServiceLive);
  return Effect.runPromise(program);
};

// GET /api/categories - List categories
categoriesRouter.get('/', async (c) => {
  try {
    const query = c.req.query();
    const options: ListCategoriesOptions = {
      status: query.status as 'draft' | 'published',
      limit: query.limit ? parseInt(query.limit) : undefined,
      cursor: query.cursor,
    };

    const result = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.listCategories(options);
      })
    );

    return c.json({
      data: result.data,
      meta: {
        cursor: result.cursor,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error('Error listing categories:', error);
    return c.json({ error: 'Failed to list categories' }, 500);
  }
});

// GET /api/categories/:id - Get category by ID
categoriesRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const category = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.getCategory(id);
      })
    );

    return c.json({ data: category });
  } catch (error) {
    console.error('Error getting category:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Category not found' }, 404);
    }
    return c.json({ error: 'Failed to get category' }, 500);
  }
});

// GET /api/categories/slug/:slug - Get category by slug
categoriesRouter.get('/slug/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');

    const category = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.getCategoryBySlug(slug);
      })
    );

    return c.json({ data: category });
  } catch (error) {
    console.error('Error getting category by slug:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Category not found' }, 404);
    }
    return c.json({ error: 'Failed to get category' }, 500);
  }
});

// POST /api/categories - Create category
categoriesRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const data: CreateCategoryData = {
      name: body.name,
      description: body.description,
      status: body.status || 'draft',
      createdBy: body.createdBy,
    };

    const category = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.createCategory(data);
      })
    );

    return c.json({ data: category }, 201);
  } catch (error) {
    console.error('Error creating category:', error);
    return c.json({ error: 'Failed to create category' }, 500);
  }
});

// PUT /api/categories/:id - Update category
categoriesRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const data: UpdateCategoryData = {
      name: body.name,
      description: body.description,
      status: body.status,
      updatedBy: body.updatedBy,
    };

    const category = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.updateCategory(id, data);
      })
    );

    return c.json({ data: category });
  } catch (error) {
    console.error('Error updating category:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Category not found' }, 404);
    }
    return c.json({ error: 'Failed to update category' }, 500);
  }
});

// DELETE /api/categories/:id - Delete category
categoriesRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.deleteCategory(id);
      })
    );

    return c.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Category not found' }, 404);
    }
    return c.json({ error: 'Failed to delete category' }, 500);
  }
});

export { categoriesRouter };