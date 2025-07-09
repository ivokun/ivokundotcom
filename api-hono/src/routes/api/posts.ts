import { Hono } from 'hono';
import { Effect, Layer } from 'effect';

import { ContentService, ContentServiceLive } from '@/services/content.service';
import type { CreatePostData, UpdatePostData, ListPostsOptions } from '@/services/content.service';

const postsRouter = new Hono();

// Helper function to run Effect programs
const runEffect = async <A, E>(effect: Effect.Effect<A, E>) => {
  const program = Effect.provide(effect, ContentServiceLive);
  return Effect.runPromise(program);
};

// GET /api/posts - List posts
postsRouter.get('/', async (c) => {
  try {
    const query = c.req.query();
    const options: ListPostsOptions = {
      categoryId: query.categoryId,
      status: query.status as 'draft' | 'published',
      locale: query.locale || 'en',
      limit: query.limit ? parseInt(query.limit) : undefined,
      cursor: query.cursor,
    };

    const result = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.listPosts(options);
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
    console.error('Error listing posts:', error);
    return c.json({ error: 'Failed to list posts' }, 500);
  }
});

// GET /api/posts/:id - Get post by ID
postsRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const locale = c.req.query('locale') || 'en';

    const post = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.getPost(id, locale);
      })
    );

    return c.json({ data: post });
  } catch (error) {
    console.error('Error getting post:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Post not found' }, 404);
    }
    return c.json({ error: 'Failed to get post' }, 500);
  }
});

// GET /api/posts/slug/:slug - Get post by slug
postsRouter.get('/slug/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const locale = c.req.query('locale') || 'en';

    const post = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.getPostBySlug(slug, locale);
      })
    );

    return c.json({ data: post });
  } catch (error) {
    console.error('Error getting post by slug:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Post not found' }, 404);
    }
    return c.json({ error: 'Failed to get post' }, 500);
  }
});

// POST /api/posts - Create post
postsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const data: CreatePostData = {
      title: body.title,
      content: body.content,
      richContent: body.richContent,
      excerpt: body.excerpt,
      readTimeMinute: body.readTimeMinute,
      featuredPictureId: body.featuredPictureId,
      categoryId: body.categoryId,
      locale: body.locale || 'en',
      status: body.status || 'draft',
      createdBy: body.createdBy,
    };

    const post = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.createPost(data);
      })
    );

    return c.json({ data: post }, 201);
  } catch (error) {
    console.error('Error creating post:', error);
    return c.json({ error: 'Failed to create post' }, 500);
  }
});

// PUT /api/posts/:id - Update post
postsRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const locale = c.req.query('locale') || 'en';
    const body = await c.req.json();
    
    const data: UpdatePostData = {
      title: body.title,
      content: body.content,
      richContent: body.richContent,
      excerpt: body.excerpt,
      readTimeMinute: body.readTimeMinute,
      featuredPictureId: body.featuredPictureId,
      categoryId: body.categoryId,
      status: body.status,
      updatedBy: body.updatedBy,
    };

    const post = await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.updatePost(id, data, locale);
      })
    );

    return c.json({ data: post });
  } catch (error) {
    console.error('Error updating post:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Post not found' }, 404);
    }
    return c.json({ error: 'Failed to update post' }, 500);
  }
});

// DELETE /api/posts/:id - Delete post
postsRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const locale = c.req.query('locale') || 'en';

    await runEffect(
      Effect.gen(function* () {
        const contentService = yield* ContentService;
        return yield* contentService.deletePost(id, locale);
      })
    );

    return c.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Post not found' }, 404);
    }
    return c.json({ error: 'Failed to delete post' }, 500);
  }
});

export { postsRouter };