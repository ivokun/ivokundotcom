import { Hono } from 'hono';

const mediaRouter = new Hono();

// GET /api/media - List media files
mediaRouter.get('/', async (c) => {
  // TODO: Implement media listing with MediaService
  return c.json({
    data: [],
    meta: {
      cursor: null,
      hasMore: false,
    },
  });
});

// GET /api/media/:id - Get media file by ID
mediaRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  // TODO: Implement media retrieval
  return c.json({ error: 'Media service not yet implemented' }, 501);
});

// POST /api/media - Upload media file
mediaRouter.post('/', async (c) => {
  // TODO: Implement file upload with Sharp processing
  return c.json({ error: 'Media upload not yet implemented' }, 501);
});

// DELETE /api/media/:id - Delete media file
mediaRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  
  // TODO: Implement media deletion
  return c.json({ error: 'Media deletion not yet implemented' }, 501);
});

export { mediaRouter };