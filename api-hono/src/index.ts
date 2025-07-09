import { serve } from '@hono/node-server';

import app from '@/app';
import { config } from '@/config/environment';

console.log(`🚀 Starting Hono API server...`);
console.log(`📦 Environment: ${config.nodeEnv}`);
console.log(`🗄️  Database: ${config.database.tableName}`);
console.log(`🌐 CORS Origin: ${config.cors.origin}`);

const port = config.port;

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`✅ Server running at http://localhost:${info.port}`);
  console.log(`📚 API Documentation: http://localhost:${info.port}/health`);
  console.log(`🎯 Ready to handle requests!`);
});