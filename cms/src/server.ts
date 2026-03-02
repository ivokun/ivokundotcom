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
import { Console, Effect, Layer, ParseResult, Redacted, Schema } from 'effect';

import { AppConfig, AppConfigLive } from './config';
import {
  isAppError,
  NotFound,
  toHttpStatus,
  toJsonResponse,
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
import type { Home, TipTapDocument } from './types';

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

// Convert TipTap content
const toNullableTipTap = (
  value: typeof UpdatePostInput.Type.content
): TipTapDocument | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value as TipTapDocument;
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
      const post = yield* postService.create({
        title: body.title,
        slug: body.slug,
        excerpt: toNullable(body.excerpt),
        content: toNullable(body.content) as TipTapDocument | null,
        featured_image: toNullable(body.featured_image),
        category_id: toNullable(body.category_id),
        locale: body.locale ?? 'en',
        status: 'draft',
        read_time_minute: null,
        published_at: null,
      });
      return yield* HttpServerResponse.json(post, { status: 201 });
    })
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
      const post = yield* postService.update(id, {
        title: body.title,
        slug: body.slug,
        excerpt: body.excerpt,
        content: toNullableTipTap(body.content),
        featured_image: body.featured_image,
        category_id: body.category_id,
        locale: body.locale,
      });
      return yield* HttpServerResponse.json(post);
    })
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
      const post = yield* postService.update(id, { status: 'draft' });
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
      // Transform response to match frontend expectations
      const transformed = {
        data: result.data.map((g) => ({
          id: g.id,
          title: g.title,
          slug: g.slug,
          status: g.status,
          imageCount: g.images.length,
          publishedAt: g.published_at,
          createdAt: g.created_at,
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
    })
  ),
  HttpRouter.get(
    '/admin/api/galleries/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const galleryService = yield* GalleryService;
      const gallery = yield* galleryService.findById(id);
      // Transform snake_case dates to camelCase for frontend
      const transformed = {
        ...gallery,
        publishedAt: gallery.published_at,
        createdAt: gallery.created_at,
        updatedAt: gallery.updated_at,
      };
      return yield* HttpServerResponse.json(transformed);
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
    })
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
      const gallery = yield* galleryService.update(id, { status: 'draft' });
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
        description: body.description as TipTapDocument | null | undefined,
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
      const body = yield* Effect.flatMap(
        req.json,
        Schema.decodeUnknown(
          Schema.Struct({
            filename: Schema.String,
            contentType: Schema.String,
            size: Schema.Number,
            alt: Schema.optional(Schema.String),
          })
        )
      );

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
      // Transform snake_case to camelCase for frontend
      const transformedKeys = keys.map((key) => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        lastUsedAt: key.last_used_at,
        createdAt: key.created_at,
      }));
      return yield* HttpServerResponse.json({ data: transformedKeys });
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

      // Transform snake_case to camelCase and include the generated key
      const transformedKey = {
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        lastUsedAt: apiKey.last_used_at,
        createdAt: apiKey.created_at,
        key: result.key, // Include the plaintext key (only returned once)
      };

      return yield* HttpServerResponse.json({ data: transformedKey }, { status: 201 });
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
      // Transform snake_case to camelCase for frontend
      const transformedUsers = users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at,
      }));
      return yield* HttpServerResponse.json({ data: transformedUsers });
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
    return yield* makeDbService(Redacted.value(config.databaseUrl));
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

// Final app layer with server
const AppLive = serverEffect.pipe(Layer.provide(ServerLive), Layer.provide(AllServices));

const program = Effect.gen(function* () {
  yield* Console.log('Starting CMS server...');
  return yield* Layer.launch(AppLive);
});

// Only start server if this file is run directly (not imported)
if (import.meta.main) {
  BunRuntime.runMain(program);
}
