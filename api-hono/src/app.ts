import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { handle } from 'hono/aws-lambda';

import { config } from '@/config/environment';
import { categoriesRouter } from '@/routes/api/categories';
import { galleriesRouter } from '@/routes/api/galleries';
import { homeRouter } from '@/routes/api/home';
import { mediaRouter } from '@/routes/api/media';
import { postsRouter } from '@/routes/api/posts';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', secureHeaders());

// CORS configuration
app.use('*', cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API routes
app.route('/api/posts', postsRouter);
app.route('/api/categories', categoriesRouter);
app.route('/api/galleries', galleriesRouter);
app.route('/api/home', homeRouter);
app.route('/api/media', mediaRouter);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: config.isDevelopment ? err.message : 'Something went wrong',
    },
    500
  );
});

// Lambda handler
export const handler = handle(app)

export default app;
