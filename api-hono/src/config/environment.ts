import { Resource } from "sst";

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  database: {
    tableName: Resource.apiHonoTable.name,
  },
  
  auth: {
    secret: process.env.AUTH_SECRET || 'development-secret',
    providers: {
      google: {
        clientId: process.env.OAUTH_GOOGLE_CLIENT_ID,
        clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET,
      },
      github: {
        clientId: process.env.OAUTH_GITHUB_CLIENT_ID,
        clientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET,
      },
    },
  },
  
  upload: {
    maxFileSize: Number(process.env.MAX_FILE_SIZE) || 10485760,
    allowedExtensions: process.env.ALLOWED_EXTENSIONS?.split(',') || ['jpg', 'png', 'gif', 'webp'],
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:4321',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
  
  email: {
    region: process.env.SES_REGION || 'us-east-1',
    fromEmail: process.env.SES_FROM_EMAIL || 'noreply@localhost',
    endpoint: process.env.SES_ENDPOINT,
  },
  
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW) || 900000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
  },
  
  webhook: {
    secret: process.env.WEBHOOK_SECRET || 'development-webhook-secret',
    timeout: Number(process.env.WEBHOOK_TIMEOUT) || 30000,
  },
};
