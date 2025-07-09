import { Hono } from 'hono';
import { Effect } from 'effect';

import { ContentService, ContentServiceLive } from '@/services/content.service';
import type { CreateGalleryData, UpdateGalleryData, ListGalleriesOptions } from '@/services/content.service';

const galleriesRouter = new Hono();

// Helper function to run Effect programs
const runEffect = async <A, E>(effect: Effect.Effect<A, E>) => {
  const program = Effect.provide(effect, ContentServiceLive);
  return Effect.runPromise(program);
};

// GET /api/galleries - List galleries
galleriesRouter.get('/', async (c) => {
  try {
    const query = c.req.query();
    const options: ListGalleriesOptions = {
      categoryId: query.categoryId,
      status: query.status as 'draft' | 'published',
      limit: query.limit ? parseInt(query.limit) : undefined,
      cursor: query.cursor,
    };

    const result = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.listGalleries(options);
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
    console.error('Error listing galleries:', error);
    return c.json({ error: 'Failed to list galleries' }, 500);
  }
});

// GET /api/galleries/:id - Get gallery by ID
galleriesRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const gallery = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.getGallery(id);
      })
    );

    return c.json({ data: gallery });
  } catch (error) {
    console.error('Error getting gallery:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Gallery not found' }, 404);
    }
    return c.json({ error: 'Failed to get gallery' }, 500);
  }
});

// GET /api/galleries/slug/:slug - Get gallery by slug
galleriesRouter.get('/slug/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');

    const gallery = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.getGalleryBySlug(slug);
      })
    );

    return c.json({ data: gallery });
  } catch (error) {
    console.error('Error getting gallery by slug:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Gallery not found' }, 404);
    }
    return c.json({ error: 'Failed to get gallery' }, 500);
  }
});

// POST /api/galleries - Create gallery
galleriesRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const data: CreateGalleryData = {
      title: body.title,
      description: body.description,
      imageIds: body.imageIds || [],
      categoryId: body.categoryId,
      status: body.status || 'draft',
      createdBy: body.createdBy,
    };

    const gallery = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.createGallery(data);
      })
    );

    return c.json({ data: gallery }, 201);
  } catch (error) {
    console.error('Error creating gallery:', error);
    return c.json({ error: 'Failed to create gallery' }, 500);
  }
});

// PUT /api/galleries/:id - Update gallery
galleriesRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const data: UpdateGalleryData = {
      title: body.title,
      description: body.description,
      imageIds: body.imageIds,
      categoryId: body.categoryId,
      status: body.status,
      updatedBy: body.updatedBy,
    };

    const gallery = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.updateGallery(id, data);
      })
    );

    return c.json({ data: gallery });
  } catch (error) {
    console.error('Error updating gallery:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Gallery not found' }, 404);
    }
    return c.json({ error: 'Failed to update gallery' }, 500);
  }
});

// DELETE /api/galleries/:id - Delete gallery
galleriesRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.deleteGallery(id);
      })
    );

    return c.json({ message: 'Gallery deleted successfully' });
  } catch (error) {
    console.error('Error deleting gallery:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Gallery not found' }, 404);
    }
    return c.json({ error: 'Failed to delete gallery' }, 500);
  }
});

export { galleriesRouter };