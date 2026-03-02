/**
 * @fileoverview CMS HTTP Server
 * @see PRD Section 7 - API Specification
 * @see Implementation Plan Phase 4
 */

import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform';
import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import { createId } from '@paralleldrive/cuid2';
import { Console, Duration, Effect, Layer, ParseResult, Redacted, Schema, Schedule } from 'effect';

import { AppConfig, AppConfigLive } from './config';
import {
  CategoryNotFound,
  isAppError,
  MediaNotFound,
  NotFound,
  toHttpStatus,
  toJsonResponse,
  Unauthorized,
  ValidationError,
} from './errors';
import { apiKeyMiddleware, loginRateLimitMiddleware, sessionMiddleware, UserContext } from './middleware';
import {
  CreateApiKeyInput,
  CreateCategoryInput,
  CreateGalleryInput,
  CreatePostInput,
  InviteUserInput,
  ListQueryParams,
  Locale,
  LoginInput,
  MediaUploadInput,
  PostListQueryParams,
  UpdateCategoryInput,
  UpdateGalleryInput,
  UpdateHomeInput,
  UpdateMediaInput,
  UpdatePostInput,
} from './schemas';
// Service Imports
import { AuthService, AuthServiceLive } from './services/auth.service';
import { CategoryService, CategoryServiceLive } from './services/category.service';
import { DbService, makeDbService } from './services/db.service';
import { GalleryService, GalleryServiceLive } from './services/gallery.service';
import { HomeService, HomeServiceLive } from './services/home.service';
import { ImageServiceLive } from './services/image.service';
import { MediaService, MediaServiceLive } from './services/media.service';
import { MediaProcessorQueueLive } from './services/media-processor';
import { PostService, PostServiceLive } from './services/post.service';
import { makeR2StorageService, StorageService } from './services/storage.service';
import { UserService, UserServiceLive } from './services/user.service';
import type { Home, TipTapDocument, TipTapNode } from './types';

// =============================================================================
// EXPORTS FOR TESTING
// =============================================================================

/**
 * Create the CMS application layer with custom configuration.
 * Used by E2E tests to create isolated server instances.
 *
 * @example
 * ```typescript
 * // Create app with test database
 * const testApp = createAppLayer({
 *   databaseUrl: 'postgres://test@localhost/test_db'
 * });
 *
 * // Launch the server
 * yield* Layer.launch(testApp);
 * ```
 */
export const createAppLayer = (
  config?: Partial<{
    port: number;
    databaseUrl: string;
    sessionSecret: string;
    r2: {
      accessKeyId: string;
      secretAccessKey: string;
      endpoint: string;
      bucket: string;
      publicUrl: string;
    };
    corsOrigin?: string;
  }>
): Layer.Layer<never, unknown, never> => {
  // Determine environment
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';

  // Build config layer with defaults merged with provided config
  const configValue = {
    port: config?.port ?? 3000,
    nodeEnv,
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production',
    databaseUrl: Redacted.make(
      config?.databaseUrl ??
        process.env['DATABASE_URL'] ??
        'postgres://postgres:postgres@localhost:5432/ivokundotcom_dev?sslmode=disable'
    ),
    sessionSecret: Redacted.make(
      config?.sessionSecret ??
        process.env['SESSION_SECRET'] ??
        'dev-secret-min-32-chars-long!!!'
    ),
    r2: {
      accessKeyId: Redacted.make(
        config?.r2?.accessKeyId ?? process.env['R2_ACCESS_KEY_ID'] ?? ''
      ),
      secretAccessKey: Redacted.make(
        config?.r2?.secretAccessKey ?? process.env['R2_ACCESS_SECRET'] ?? ''
      ),
      endpoint: config?.r2?.endpoint ?? process.env['R2_ENDPOINT'] ?? '',
      bucket: config?.r2?.bucket ?? process.env['R2_BUCKET'] ?? '',
      publicUrl: config?.r2?.publicUrl ?? process.env['R2_PUBLIC_URL'] ?? '',
    },
    corsOrigin: config?.corsOrigin ?? process.env['CORS_ORIGIN'] ?? '*',
  };

  const ConfigLive = Layer.succeed(AppConfig, configValue as unknown as AppConfig);

  // Build all layers with the config
  const DbWithConfig = DbLive.pipe(Layer.provide(ConfigLive));
  const StorageWithConfig = StorageLive.pipe(Layer.provide(ConfigLive));
  const ImageWithStorage = ImageServiceLive.pipe(Layer.provide(StorageWithConfig));
  const ProcessorQueueWithDeps = MediaProcessorQueueLive.pipe(
    Layer.provide(DbWithConfig),
    Layer.provide(ImageWithStorage),
    Layer.provide(StorageWithConfig)
  );
  const MediaWithDeps = MediaServiceLive.pipe(
    Layer.provide(DbWithConfig),
    Layer.provide(ImageWithStorage),
    Layer.provide(StorageWithConfig),
    Layer.provide(ProcessorQueueWithDeps)
  );

  const AllServices = Layer.mergeAll(
    ConfigLive,
    DbWithConfig,
    StorageWithConfig,
    ImageWithStorage,
    ProcessorQueueWithDeps,
    MediaWithDeps,
    CategoryServiceLive.pipe(Layer.provide(DbWithConfig)),
    PostServiceLive.pipe(Layer.provide(DbWithConfig)),
    GalleryServiceLive.pipe(Layer.provide(DbWithConfig), Layer.provide(MediaWithDeps)),
    HomeServiceLive.pipe(Layer.provide(DbWithConfig)),
    AuthServiceLive.pipe(Layer.provide(DbWithConfig)),
    UserServiceLive.pipe(Layer.provide(DbWithConfig))
  );

  // Create server with the configured port
  const ServerLive = BunHttpServer.layer({ port: configValue.port });

  return serverEffect.pipe(
    Layer.provide(ServerLive),
    Layer.provide(AllServices)
  );
};

// =============================================================================
// HELPERS
// =============================================================================

const decodeQuery =
  <A, I>(schema: Schema.Schema<A, I>) =>
  (req: HttpServerRequest.HttpServerRequest) => {
    const url = new URL(req.url, 'http://localhost');
    const params = Object.fromEntries(url.searchParams.entries());
    return Schema.decodeUnknown(schema)(params);
  };

const decodeBody =
  <A, I>(schema: Schema.Schema<A, I>) =>
  (req: HttpServerRequest.HttpServerRequest) =>
    Effect.gen(function* () {
      const json = yield* req.json;
      const decoded = yield* Schema.decodeUnknown(schema)(json).pipe(
        Effect.catchAll((error) => {
          // Convert ParseError to our ValidationError
          const parseError = error as ParseResult.ParseError;
          let errorMessage: string;
          try {
            errorMessage = ParseResult.TreeFormatter.formatErrorSync(parseError);
          } catch {
            errorMessage = 'Validation failed';
          }
          return Effect.fail(
            new ValidationError({
              errors: [{ path: 'body', message: errorMessage }],
            })
          );
        })
      );
      return decoded;
    });

const decodeParams =
  <A, I>(schema: Schema.Schema<A, I>) =>
  (_req: HttpServerRequest.HttpServerRequest) =>
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      return yield* Schema.decodeUnknown(schema)(params);
    });

// Convert optional to nullable for DB compatibility
const toNullable = <T>(value: T | undefined): T | null => (value === undefined ? null : value);

// Convert TipTap content safely - validates shape before casting
const toTipTapContent = (value: unknown): TipTapDocument | null => {
  if (value === null) return null;
  if (typeof value !== 'object' || value === null) return null;
  const obj = value as Record<string, unknown>;
  // TipTap document must have type: 'doc' and content array
  if (obj['type'] !== 'doc') return null;
  if (!Array.isArray(obj['content'])) return null;
  return value as TipTapDocument;
};

// Convert TipTap content for update (allows undefined)
const toNullableTipTap = (
  value: typeof UpdatePostInput.Type.content
): TipTapDocument | null | undefined => {
  if (value === undefined) return undefined;
  return toTipTapContent(value);
};

/**
 * Recursively extract text from TipTap document nodes
 */
const extractTextFromTipTap = (node: TipTapNode): string => {
  if (!node) return '';

  // If it's a text node, return the text
  if (node.text) {
    return node.text;
  }

  // If it has content, recursively extract from children
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromTipTap).join(' ');
  }

  return '';
};

/**
 * Calculate read time in minutes from TipTap content
 * Assumes average reading speed of 200 words per minute
 */
const calculateReadTime = (content: TipTapDocument | null | undefined): number | null => {
  if (!content || !content.content) return null;

  const text = content.content.map(extractTextFromTipTap).join(' ');
  const wordCount = text.trim().split(/\s+/).filter((word) => word.length > 0).length;

  if (wordCount === 0) return null;

  // Round up to nearest minute, minimum 1 minute
  return Math.max(1, Math.ceil(wordCount / 200));
};

// Default home content
const defaultHome: Home = {
  id: 'singleton',
  title: null,
  short_description: null,
  description: null,
  hero: null,
  keywords: null,
  updated_at: new Date(),
};

// =============================================================================
// SECURITY HEADERS
// =============================================================================

const isProduction = process.env.NODE_ENV === 'production';

const applySecurityHeaders = (
  response: HttpServerResponse.HttpServerResponse
): HttpServerResponse.HttpServerResponse => {
  let result = response;
  result = HttpServerResponse.setHeader(result, 'X-Content-Type-Options', 'nosniff');
  result = HttpServerResponse.setHeader(result, 'X-Frame-Options', 'DENY');
  result = HttpServerResponse.setHeader(result, 'Referrer-Policy', 'strict-origin-when-cross-origin');
  result = HttpServerResponse.setHeader(result, 'X-DNS-Prefetch-Control', 'off');
  result = HttpServerResponse.setHeader(
    result,
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );
  result = HttpServerResponse.setHeader(
    result,
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  if (isProduction) {
    result = HttpServerResponse.setHeader(
      result,
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }
  return result;
};

// =============================================================================
// ERROR HANDLING
// =============================================================================

const errorHandler = HttpMiddleware.make((app) =>
  Effect.matchEffect(app, {
    onSuccess: (response) => Effect.succeed(applySecurityHeaders(response)),
    onFailure: (error: unknown) => {
      if (isAppError(error)) {
        const status = toHttpStatus(error);
        const body = toJsonResponse(error);
        return HttpServerResponse.json(body, { status });
      }

      // Handle unexpected errors
      console.error('Unexpected error:', error);
      return HttpServerResponse.json(
        {
          error: 'InternalServerError',
          message: 'An unexpected error occurred',
        },
        { status: 500 }
      );
    },
  })
);

// =============================================================================
// PUBLIC API ROUTER
// =============================================================================

const publicRouter = HttpRouter.empty.pipe(
  // Posts
  HttpRouter.get(
    '/api/posts',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const query = yield* decodeQuery(PostListQueryParams)(req);
      const postService = yield* PostService;
      const posts = yield* postService.findAll({
        limit: query.limit,
        offset: query.offset,
        filter: {
          locale: query.locale,
          status: 'published',
          categoryId: query.category_id,
        },
      });
      return yield* HttpServerResponse.json(posts);
    })
  ),
  HttpRouter.get(
    '/api/posts/:slug',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { slug } = yield* decodeParams(Schema.Struct({ slug: Schema.String }))(req);
      const query = yield* decodeQuery(Schema.Struct({ locale: Schema.optional(Locale) }))(req);
      const postService = yield* PostService;
      const post = yield* postService.findBySlug(slug, query.locale);

      if (post.status !== 'published') {
        return yield* Effect.fail(new NotFound({ resource: 'Post', id: slug }));
      }

      return yield* HttpServerResponse.json(post);
    })
  ),

  // Categories
  HttpRouter.get(
    '/api/categories',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const query = yield* decodeQuery(ListQueryParams)(req);
      const categoryService = yield* CategoryService;
      const categories = yield* categoryService.findAll({
        limit: query.limit,
        offset: query.offset,
      });
      return yield* HttpServerResponse.json(categories);
    })
  ),
  HttpRouter.get(
    '/api/categories/:slug',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { slug } = yield* decodeParams(Schema.Struct({ slug: Schema.String }))(req);
      const categoryService = yield* CategoryService;
      const category = yield* categoryService.findBySlug(slug);
      return yield* HttpServerResponse.json(category);
    })
  ),

  // Galleries
  HttpRouter.get(
    '/api/galleries',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const query = yield* decodeQuery(ListQueryParams)(req);
      const galleryService = yield* GalleryService;
      const galleries = yield* galleryService.findAllWithImages({
        limit: query.limit,
        offset: query.offset,
        filter: { status: 'published' },
      });
      return yield* HttpServerResponse.json(galleries);
    })
  ),
  HttpRouter.get(
    '/api/galleries/:slug',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { slug } = yield* decodeParams(Schema.Struct({ slug: Schema.String }))(req);
      const galleryService = yield* GalleryService;
      const gallery = yield* galleryService.findBySlugWithImages(slug);

      if (gallery.status !== 'published') {
        return yield* Effect.fail(new NotFound({ resource: 'Gallery', id: slug }));
      }

      return yield* HttpServerResponse.json(gallery);
    })
  ),

  // Home
  HttpRouter.get(
    '/api/home',
    Effect.gen(function* () {
      const homeService = yield* HomeService;
      const home = yield* homeService.get().pipe(Effect.catchTag('NotFound', () => Effect.succeed(defaultHome)));
      return yield* HttpServerResponse.json(home);
    })
  ),

  HttpRouter.use(apiKeyMiddleware)
);

// =============================================================================
// AUTH ROUTER
// =============================================================================

const authRouter = HttpRouter.empty.pipe(
  HttpRouter.use(loginRateLimitMiddleware),
  HttpRouter.post(
    '/admin/api/login',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = yield* decodeBody(LoginInput)(req);
      const authService = yield* AuthService;
      const user = yield* authService.validateCredentials(body.email, body.password);
      const session = yield* authService.createSession(user.id);

      const response = yield* HttpServerResponse.json({ user });

      // Use __Host- prefix in production for added security (prevents subdomain override)
      const cookieName = isProduction ? '__Host-session' : 'session';
      const cookieValue = `${cookieName}=${session.id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}${isProduction ? '; Secure' : ''}`;

      return HttpServerResponse.setHeader(response, 'Set-Cookie', cookieValue);
    }).pipe(
      Effect.catchAll((error) => {
        // For security, always return generic "Invalid email or password" message
        // This prevents information leakage about whether email exists or password is wrong
        if (isAppError(error)) {
          // Check if it's an auth error (InvalidCredentials, SessionExpired, etc.)
          const status = toHttpStatus(error);
          // Return generic message for all auth/validation errors
          return HttpServerResponse.json(
            {
              error: 'InvalidCredentials',
              message: 'Invalid email or password',
            },
            { status }
          );
        }
        // For non-AppError, still return generic message
        return HttpServerResponse.json(
          {
            error: 'InvalidCredentials',
            message: 'Invalid email or password',
          },
          { status: 401 }
        );
      })
    )
  ),
  HttpRouter.post(
    '/admin/api/logout',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      // Check both cookie names (production uses __Host- prefix)
      const cookieName = isProduction ? '__Host-session' : 'session';
      const sessionId = req.cookies[cookieName] ?? req.cookies['session'];
      const authService = yield* AuthService;
      if (sessionId) {
        yield* authService.destroySession(sessionId);
      }

      const secureSuffix = isProduction ? '; Secure' : '';
      // __Host- prefix requires Secure flag even when clearing
      const response = HttpServerResponse.empty();
      return HttpServerResponse.setHeader(
        response,
        'Set-Cookie',
        `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureSuffix}`
      );
    })
  )
);

// =============================================================================
// ADMIN ROUTERS
// =============================================================================

const adminMeRouter = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/admin/api/me',
    Effect.gen(function* () {
      const { session } = yield* UserContext;
      const { query } = yield* DbService;

      const user = yield* query('get_me', (db) =>
        db
          .selectFrom('users')
          .select(['id', 'email', 'name', 'created_at'])
          .where('id', '=', session.user_id)
          .executeTakeFirst()
      );

      if (!user) {
        return yield* Effect.fail(new NotFound({ resource: 'User', id: session.user_id }));
      }

      return yield* HttpServerResponse.json(user);
    })
  )
);

const adminPostRouter = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/admin/api/posts',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const query = yield* decodeQuery(PostListQueryParams)(req);
      const postService = yield* PostService;
      const posts = yield* postService.findAll({
        limit: query.limit,
        offset: query.offset,
        filter: {
          locale: query.locale,
          status: query.status,
          categoryId: query.category_id,
        },
      });
      return yield* HttpServerResponse.json(posts);
    })
  ),
  HttpRouter.post(
    '/admin/api/posts',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = yield* decodeBody(CreatePostInput)(req);
      const postService = yield* PostService;
      const content = toTipTapContent(body.content);
      const post = yield* postService.create({
        title: body.title,
        slug: body.slug,
        excerpt: toNullable(body.excerpt),
        content: content,
        featured_image: toNullable(body.featured_image),
        category_id: toNullable(body.category_id),
        locale: body.locale ?? 'en',
        status: 'draft',
        read_time_minute: calculateReadTime(content),
        published_at: null,
      });
      return yield* HttpServerResponse.json(post, { status: 201 });
    }).pipe(
      Effect.catchTag('CategoryNotFound', (error) =>
        HttpServerResponse.json(
          { error: 'CategoryNotFound', message: error.message },
          { status: 422 }
        )
      )
    )
  ),
  HttpRouter.get(
    '/admin/api/posts/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const postService = yield* PostService;
      const post = yield* postService.findById(id);
      return yield* HttpServerResponse.json(post);
    })
  ),
  HttpRouter.patch(
    '/admin/api/posts/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const body = yield* decodeBody(UpdatePostInput)(req);
      const postService = yield* PostService;
      const content = toNullableTipTap(body.content);
      const post = yield* postService.update(id, {
        title: body.title,
        slug: body.slug,
        excerpt: body.excerpt,
        content: content,
        featured_image: body.featured_image,
        category_id: body.category_id,
        locale: body.locale,
        read_time_minute: content !== undefined ? calculateReadTime(content) : undefined,
      });
      return yield* HttpServerResponse.json(post);
    }).pipe(
      Effect.catchTag('CategoryNotFound', (error) =>
        HttpServerResponse.json(
          { error: 'CategoryNotFound', message: error.message },
          { status: 422 }
        )
      )
    )
  ),
  HttpRouter.del(
    '/admin/api/posts/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const postService = yield* PostService;
      yield* postService.delete(id);
      return yield* HttpServerResponse.empty();
    })
  ),
  HttpRouter.post(
    '/admin/api/posts/:id/publish',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const postService = yield* PostService;
      const post = yield* postService.update(id, { status: 'published', published_at: new Date() });
      return yield* HttpServerResponse.json(post);
    })
  ),
  HttpRouter.post(
    '/admin/api/posts/:id/unpublish',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const postService = yield* PostService;
      const post = yield* postService.update(id, { status: 'draft', published_at: null });
      return yield* HttpServerResponse.json(post);
    })
  )
);

const adminCategoryRouter = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/admin/api/categories',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const query = yield* decodeQuery(ListQueryParams)(req);
      const categoryService = yield* CategoryService;
      const categories = yield* categoryService.findAll({
        limit: query.limit,
        offset: query.offset,
      });
      return yield* HttpServerResponse.json(categories);
    })
  ),
  HttpRouter.post(
    '/admin/api/categories',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = yield* decodeBody(CreateCategoryInput)(req);
      const categoryService = yield* CategoryService;
      const category = yield* categoryService.create({
        name: body.name,
        slug: body.slug,
        description: toNullable(body.description),
      });
      return yield* HttpServerResponse.json(category, { status: 201 });
    })
  ),
  HttpRouter.get(
    '/admin/api/categories/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const categoryService = yield* CategoryService;
      const category = yield* categoryService.findById(id);
      return yield* HttpServerResponse.json(category);
    })
  ),
  HttpRouter.patch(
    '/admin/api/categories/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const body = yield* decodeBody(UpdateCategoryInput)(req);
      const categoryService = yield* CategoryService;
      const category = yield* categoryService.update(id, {
        name: body.name,
        slug: body.slug,
        description: body.description,
      });
      return yield* HttpServerResponse.json(category);
    })
  ),
  HttpRouter.del(
    '/admin/api/categories/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const categoryService = yield* CategoryService;
      yield* categoryService.delete(id);
      return yield* HttpServerResponse.empty();
    })
  )
);

const adminGalleryRouter = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/admin/api/galleries',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const query = yield* decodeQuery(ListQueryParams)(req);
      const galleryService = yield* GalleryService;
      const result = yield* galleryService.findAll({
        limit: query.limit,
        offset: query.offset,
      });
      // Return snake_case to match DB and other endpoints
      const transformed = {
        data: result.data.map((g) => ({
          id: g.id,
          title: g.title,
          slug: g.slug,
          status: g.status,
          image_count: g.images.length,
          published_at: g.published_at,
          created_at: g.created_at,
        })),
        meta: result.meta,
      };
      return yield* HttpServerResponse.json(transformed);
    })
  ),
  HttpRouter.post(
    '/admin/api/galleries',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = yield* decodeBody(CreateGalleryInput)(req);
      const galleryService = yield* GalleryService;
      const gallery = yield* galleryService.create({
        title: body.title,
        slug: body.slug,
        description: toNullable(body.description),
        images: body.images ? body.images.map((img) => img.mediaId) : [],
        category_id: toNullable(body.category_id),
        status: 'draft',
        published_at: null,
      });
      return yield* HttpServerResponse.json(gallery, { status: 201 });
    }).pipe(
      Effect.catchTag('MediaNotFound', (error) =>
        HttpServerResponse.json(
          { error: 'MediaNotFound', message: error.message },
          { status: 422 }
        )
      )
    )
  ),
  HttpRouter.get(
    '/admin/api/galleries/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const galleryService = yield* GalleryService;
      const gallery = yield* galleryService.findById(id);
      // Return snake_case consistently
      return yield* HttpServerResponse.json(gallery);
    })
  ),
  HttpRouter.patch(
    '/admin/api/galleries/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const body = yield* decodeBody(UpdateGalleryInput)(req);
      const galleryService = yield* GalleryService;
      const gallery = yield* galleryService.update(id, {
        title: body.title,
        slug: body.slug,
        description: body.description,
        images: body.images
          ? body.images
              .slice()
              .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
              .map((img: { mediaId: string }) => img.mediaId)
          : undefined,
        category_id: body.category_id,
      });
      return yield* HttpServerResponse.json(gallery);
    }).pipe(
      Effect.catchTag('MediaNotFound', (error) =>
        HttpServerResponse.json(
          { error: 'MediaNotFound', message: error.message },
          { status: 422 }
        )
      )
    )
  ),
  HttpRouter.del(
    '/admin/api/galleries/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const galleryService = yield* GalleryService;
      yield* galleryService.delete(id);
      return yield* HttpServerResponse.empty();
    })
  ),
  HttpRouter.post(
    '/admin/api/galleries/:id/publish',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const galleryService = yield* GalleryService;
      const gallery = yield* galleryService.update(id, {
        status: 'published',
        published_at: new Date(),
      });
      return yield* HttpServerResponse.json(gallery);
    })
  ),
  HttpRouter.post(
    '/admin/api/galleries/:id/unpublish',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const galleryService = yield* GalleryService;
      const gallery = yield* galleryService.update(id, { status: 'draft', published_at: null });
      return yield* HttpServerResponse.json(gallery);
    })
  )
);

const adminMiscRouter = HttpRouter.empty.pipe(
  // Home Admin
  HttpRouter.get(
    '/admin/api/home',
    Effect.gen(function* () {
      const homeService = yield* HomeService;
      const home = yield* homeService.get().pipe(Effect.catchTag('NotFound', () => Effect.succeed(defaultHome)));
      return yield* HttpServerResponse.json(home);
    })
  ),
  HttpRouter.patch(
    '/admin/api/home',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = yield* decodeBody(UpdateHomeInput)(req);
      const homeService = yield* HomeService;
      const home = yield* homeService.update({
        title: body.title,
        short_description: body.short_description,
        description: toTipTapContent(body.description),
        hero: body.hero,
        keywords: body.keywords,
      });
      return yield* HttpServerResponse.json(home);
    })
  ),

  // Media Admin
  HttpRouter.get(
    '/admin/api/media',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const query = yield* decodeQuery(ListQueryParams)(req);
      const mediaService = yield* MediaService;
      const media = yield* mediaService.findAll({ limit: query.limit, offset: query.offset });
      return yield* HttpServerResponse.json(media);
    })
  ),
  HttpRouter.get(
    '/admin/api/media/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const mediaService = yield* MediaService;
      const media = yield* mediaService.findById(id);
      return yield* HttpServerResponse.json(media);
    })
  ),
  HttpRouter.patch(
    '/admin/api/media/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const body = yield* decodeBody(UpdateMediaInput)(req);
      const mediaService = yield* MediaService;
      const media = yield* mediaService.update(id, { alt: body.alt });
      return yield* HttpServerResponse.json(media);
    })
  ),
  HttpRouter.del(
    '/admin/api/media/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const mediaService = yield* MediaService;
      yield* mediaService.delete(id);
      return yield* HttpServerResponse.empty();
    })
  ),
  // Presigned upload: step 1 — get a presigned URL
  HttpRouter.post(
    '/admin/api/media/upload',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = yield* decodeBody(MediaUploadInput)(req);

      const mediaService = yield* MediaService;
      const result = yield* mediaService.initUpload({
        filename: body.filename,
        contentType: body.contentType,
        size: body.size,
        alt: body.alt,
      });

      return yield* HttpServerResponse.json(result);
    })
  ),
  // Presigned upload: step 2 — confirm upload complete, kick off processing
  HttpRouter.post(
    '/admin/api/media/:id/uploaded',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);

      const mediaService = yield* MediaService;
      const media = yield* mediaService.confirmUpload(id);

      return yield* HttpServerResponse.json(media);
    })
  ),

  // API Keys Admin
  HttpRouter.get(
    '/admin/api/api-keys',
    Effect.gen(function* () {
      const { query } = yield* DbService;
      const keys = yield* query('list_api_keys', (db) =>
        db
          .selectFrom('api_keys')
          .select(['id', 'name', 'prefix', 'last_used_at', 'created_at'])
          .orderBy('created_at', 'desc')
          .execute()
      );
      // Return snake_case consistently
      return yield* HttpServerResponse.json({ data: keys });
    })
  ),
  HttpRouter.post(
    '/admin/api/api-keys',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = yield* decodeBody(CreateApiKeyInput)(req);
      const authService = yield* AuthService;
      const result = authService.generateApiKey();
      const keyHash = yield* result.hash;
      const { query } = yield* DbService;

      const apiKey = yield* query('create_api_key', (db) =>
        db
          .insertInto('api_keys')
          .values({
            id: createId(),
            name: body.name,
            prefix: result.prefix,
            key_hash: keyHash,
            created_at: new Date(),
          })
          .returningAll()
          .executeTakeFirstOrThrow()
      );

      // Return snake_case consistently, include the generated key
      const responseKey = {
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        last_used_at: apiKey.last_used_at,
        created_at: apiKey.created_at,
        key: result.key, // Include the plaintext key (only returned once)
      };

      return yield* HttpServerResponse.json({ data: responseKey }, { status: 201 });
    })
  ),
  HttpRouter.del(
    '/admin/api/api-keys/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const { query } = yield* DbService;
      yield* query('delete_api_key', (db) => db.deleteFrom('api_keys').where('id', '=', id).execute());
      return yield* HttpServerResponse.empty();
    })
  ),

  // Users Admin
  HttpRouter.get(
    '/admin/api/users',
    Effect.gen(function* () {
      const userService = yield* UserService;
      const users = yield* userService.findAll();
      // Return snake_case consistently
      return yield* HttpServerResponse.json({ data: users });
    })
  ),
  HttpRouter.post(
    '/admin/api/users/invite',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = yield* decodeBody(InviteUserInput)(req);
      const userService = yield* UserService;
      const user = yield* userService.invite(body.name, body.email);
      return yield* HttpServerResponse.json({ data: user }, { status: 201 });
    })
  ),
  HttpRouter.del(
    '/admin/api/users/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const { session } = yield* UserContext;

      // Prevent self-deletion
      if (id === session.user_id) {
        return yield* HttpServerResponse.json(
          { error: 'Forbidden', message: 'Cannot delete your own account' },
          { status: 403 }
        );
      }

      const userService = yield* UserService;
      yield* userService.deleteUser(id);
      return yield* HttpServerResponse.empty();
    })
  )
);

// Combine Admin Routes and apply middleware
const adminRouter = HttpRouter.empty.pipe(
  HttpRouter.concat(adminMeRouter),
  HttpRouter.concat(adminPostRouter),
  HttpRouter.concat(adminCategoryRouter),
  HttpRouter.concat(adminGalleryRouter),
  HttpRouter.concat(adminMiscRouter),
  HttpRouter.use(sessionMiddleware)
);

// =============================================================================
// STATIC FILE SERVING
// =============================================================================

// Resolve paths for static files and migrations
// Supports NixOS deployment via environment variables
const getPublicPath = (relativePath: string): string => {
  // Check for NixOS environment variable first
  const publicDir = process.env['CMS_PUBLIC_DIR'];
  if (publicDir) {
    // relativePath is like "public/admin/index.html", strip "public/" prefix
    return `${publicDir}/${relativePath.replace(/^public\//, '')}`;
  }
  // In production (compiled binary), use import.meta.dir
  // In development, use process.cwd()
  const basePath = process.env['NODE_ENV'] === 'production' ? import.meta.dir : process.cwd();
  return `${basePath}/${relativePath}`;
};

// Serve admin SPA
const adminStaticRouter = HttpRouter.empty.pipe(
  // Serve index.html for the admin root
  HttpRouter.get(
    '/admin',
    HttpServerResponse.file(getPublicPath('public/admin/index.html'), {
      contentType: 'text/html',
    })
  ),
  // Serve static assets (js, css, etc.)
  HttpRouter.get(
    '/admin/assets/*',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const url = new URL(req.url, 'http://localhost');
      const filePath = url.pathname.replace('/admin/', 'public/admin/');
      return yield* HttpServerResponse.file(getPublicPath(filePath));
    })
  ),
  // SPA fallback - serve index.html for all other /admin/* routes
  HttpRouter.get(
    '/admin/*',
    HttpServerResponse.file(getPublicPath('public/admin/index.html'), {
      contentType: 'text/html',
    })
  )
);

// No local uploads router — all media is served from R2 via public URL
const uploadsRouter = HttpRouter.empty;

// =============================================================================
// APP ASSEMBLY
// =============================================================================

const healthRouter = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/health',
    Effect.gen(function* () {
      return yield* HttpServerResponse.json({ status: 'ok' });
    })
  ),
  HttpRouter.get(
    '/health/db',
    Effect.gen(function* () {
      const { query } = yield* DbService;
      yield* query('health_check', (db) => db.selectFrom('users').select('id').limit(1).execute());
      return yield* HttpServerResponse.json({ status: 'ok', database: 'connected' });
    })
  )
);

const appRouter = healthRouter.pipe(
  HttpRouter.concat(authRouter),
  HttpRouter.concat(publicRouter),
  HttpRouter.concat(adminRouter),
  HttpRouter.concat(adminStaticRouter),
  HttpRouter.concat(uploadsRouter)
);

// =============================================================================
// LAYER COMPOSITION
// =============================================================================

// Storage layer - always R2 (dev bucket in dev, prod bucket in prod)
const StorageLive = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    return yield* makeR2StorageService({
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
      endpoint: config.r2.endpoint,
      bucket: config.r2.bucket,
      publicUrl: config.r2.publicUrl,
    });
  })
);

// Database layer with config
const DbLive = Layer.scoped(
  DbService,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    return yield* makeDbService({
      connectionString: Redacted.value(config.databaseUrl),
      poolMax: config.dbPoolMax,
    });
  })
);

// =============================================================================
// SERVER STARTUP
// =============================================================================

// Read port from environment or use default
const PORT = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3000;

const ServerLive = BunHttpServer.layer({ port: PORT });

const serverEffect = appRouter.pipe(HttpServer.serve(errorHandler), HttpServer.withLogAddress);

// Build the complete layer hierarchy
// DbLive needs AppConfig
const DbWithConfig = DbLive.pipe(Layer.provide(AppConfigLive));

// StorageLive needs AppConfig (for R2 in prod)
const StorageWithConfig = StorageLive.pipe(Layer.provide(AppConfigLive));

// ImageServiceLive needs StorageService
const ImageWithStorage = ImageServiceLive.pipe(Layer.provide(StorageWithConfig));

// MediaProcessorQueueLive needs DbService, ImageService, StorageService
const ProcessorQueueWithDeps = MediaProcessorQueueLive.pipe(
  Layer.provide(DbWithConfig),
  Layer.provide(ImageWithStorage),
  Layer.provide(StorageWithConfig)
);

// MediaServiceLive needs DbService, ImageService, StorageService, MediaProcessorQueue
const MediaWithDeps = MediaServiceLive.pipe(
  Layer.provide(DbWithConfig),
  Layer.provide(ImageWithStorage),
  Layer.provide(StorageWithConfig),
  Layer.provide(ProcessorQueueWithDeps)
);

// Content services need DbService
const CategoryWithDb = CategoryServiceLive.pipe(Layer.provide(DbWithConfig));
const PostWithDb = PostServiceLive.pipe(Layer.provide(DbWithConfig));
// GalleryService also needs MediaService for image resolution
const GalleryWithDb = GalleryServiceLive.pipe(Layer.provide(DbWithConfig), Layer.provide(MediaWithDeps));
const HomeWithDb = HomeServiceLive.pipe(Layer.provide(DbWithConfig));

// AuthServiceLive needs DbService
const AuthWithDb = AuthServiceLive.pipe(Layer.provide(DbWithConfig));

// UserServiceLive needs DbService
const UserWithDb = UserServiceLive.pipe(Layer.provide(DbWithConfig));

// Combine all service layers
const AllServices = Layer.mergeAll(
  AppConfigLive,
  DbWithConfig,
  StorageWithConfig,
  ImageWithStorage,
  ProcessorQueueWithDeps,
  MediaWithDeps,
  CategoryWithDb,
  PostWithDb,
  GalleryWithDb,
  HomeWithDb,
  AuthWithDb,
  UserWithDb
);

// =============================================================================
// ORPHANED UPLOAD CLEANUP JOB (DATA-013)
// =============================================================================

/** Effect that cleans up orphaned uploads and logs any errors */
const orphanedUploadCleanupJob = Effect.gen(function* () {
  const mediaService = yield* MediaService;
  const count = yield* mediaService.cleanupOrphanedUploads();
  if (count > 0) {
    yield* Effect.log(`Cleaned up ${count} orphaned uploads`);
  }
}).pipe(
  Effect.catchAll((error) =>
    Effect.logError(`Orphaned upload cleanup failed: ${error}`)
  )
);

/** Scheduled cleanup job that runs every hour */
const scheduledCleanupJob = Effect.repeat(
  orphanedUploadCleanupJob,
  Schedule.fixed(Duration.hours(1))
);

// Final app layer with server
const AppLive = serverEffect.pipe(Layer.provide(ServerLive), Layer.provide(AllServices));

const program = Effect.gen(function* () {
  yield* Console.log('Starting CMS server...');

  // Start the cleanup job in the background (providing the same services as the server)
  yield* scheduledCleanupJob.pipe(
    Effect.provide(AllServices),
    Effect.forkDaemon
  );

  yield* Effect.log('Orphaned upload cleanup job started (runs every hour)');

  return yield* Layer.launch(AppLive);
});

// Only start server if this file is run directly (not imported)
if (import.meta.main) {
  BunRuntime.runMain(program);
}
