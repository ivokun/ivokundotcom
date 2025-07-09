import { Hono } from 'hono';
import { Effect } from 'effect';

import { ContentService, ContentServiceLive } from '@/services/content.service';
import type { UpdateHomeData } from '@/services/content.service';

const homeRouter = new Hono();

// Helper function to run Effect programs
const runEffect = async <A, E>(effect: Effect.Effect<A, E>) => {
  const program = Effect.provide(effect, ContentServiceLive);
  return Effect.runPromise(program);
};

// GET /api/home - Get home page content
homeRouter.get('/', async (c) => {
  try {
    const home = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.getHome();
      })
    );

    return c.json({ data: home });
  } catch (error) {
    console.error('Error getting home:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Home page not found' }, 404);
    }
    return c.json({ error: 'Failed to get home page' }, 500);
  }
});

// PUT /api/home - Update home page content
homeRouter.put('/', async (c) => {
  try {
    const body = await c.req.json();
    
    const data: UpdateHomeData = {
      title: body.title,
      description: body.description,
      shortDescription: body.shortDescription,
      keywords: body.keywords,
      heroImageId: body.heroImageId,
      status: body.status,
      updatedBy: body.updatedBy,
    };

    const home = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.updateHome(data);
      })
    );

    return c.json({ data: home });
  } catch (error) {
    console.error('Error updating home:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Home page not found' }, 404);
    }
    return c.json({ error: 'Failed to update home page' }, 500);
  }
});

export { homeRouter };