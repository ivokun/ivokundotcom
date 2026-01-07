/**
 * @fileoverview CMS HTTP Server
 * @see PRD Section 7 - API Specification
 * @see Implementation Plan Phase 4
 */

import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform';
import { Console, Effect, Layer, Redacted, Schema } from 'effect';

import { AppConfig, AppConfigLive } from './config';
import {
  type AppError,
  isAppError,
  NotFound,
  toHttpStatus,
  toJsonResponse,
  ValidationError,
} from './errors';
import { apiKeyMiddleware, sessionMiddleware, UserContext } from './middleware';
import {
  CreateApiKeyInput,
  CreateCategoryInput,
  CreateGalleryInput,
  CreatePostInput,
  ListQueryParams,
  Locale,
  LoginInput,
  PostListQueryParams,
  UpdateCategoryInput,
  UpdateGalleryInput,
  UpdateHomeInput,
  UpdatePostInput,
} from './schemas';
import type { Home, TipTapDocument } from './types';

// Service Imports
import { AuthService, AuthServiceLive } from './services/auth.service';
import { CategoryService, CategoryServiceLive } from './services/category.service';
import { DbService, makeDbService } from './services/db.service';
import { GalleryService, GalleryServiceLive } from './services/gallery.service';
import { HomeService, HomeServiceLive } from './services/home.service';
import { ImageServiceLive } from './services/image.service';
import { MediaService, MediaServiceLive } from './services/media.service';
import { PostService, PostServiceLive } from './services/post.service';
import {
  makeLocalStorageService,
  makeR2StorageService,
  StorageService,
} from './services/storage.service';

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
    Effect.flatMap(req.json, Schema.decodeUnknown(schema));

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
// ERROR HANDLING
// =============================================================================

const errorHandler = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    return yield* app;
  }).pipe(
    Effect.catchAll((error: unknown) => {
      if (isAppError(error)) {
        const status = toHttpStatus(error);
        const body = toJsonResponse(error);
        return HttpServerResponse.json(body, { status });
      }

      // Handle ParseError from Schema
      if (
        typeof error === 'object' &&
        error !== null &&
        '_tag' in error &&
        (error as { _tag: string })._tag === 'ParseError'
      ) {
        return HttpServerResponse.json(
          {
            error: 'ValidationError',
            message: 'Invalid request data',
            details: error,
          },
          { status: 400 }
        );
      }

      // Unexpected errors - log and return generic response
      console.error('Unexpected error:', error);
      return HttpServerResponse.json(
        {
          error: 'InternalServerError',
          message: 'An unexpected error occurred',
        },
        { status: 500 }
      );
    })
  )
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
      const galleries = yield* galleryService.findAll({
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
      const gallery = yield* galleryService.findBySlug(slug);

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
  HttpRouter.post(
    '/admin/api/login',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = yield* decodeBody(LoginInput)(req);
      const authService = yield* AuthService;
      const user = yield* authService.validateCredentials(body.email, body.password);
      const session = yield* authService.createSession(user.id);

      const response = yield* HttpServerResponse.json({ user, session_id: session.id });

      const isProduction = process.env.NODE_ENV === 'production';
      const cookieValue = `session=${session.id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}${isProduction ? '; Secure' : ''}`;

      return HttpServerResponse.setHeader(response, 'Set-Cookie', cookieValue);
    })
  ),
  HttpRouter.post(
    '/admin/api/logout',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const sessionId = req.cookies['session'];
      const authService = yield* AuthService;
      if (sessionId) {
        yield* authService.destroySession(sessionId);
      }

      const response = HttpServerResponse.empty();
      return HttpServerResponse.setHeader(
        response,
        'Set-Cookie',
        'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
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
      return yield* HttpServerResponse.json(post);
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
      return yield* HttpServerResponse.json(category);
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
      const galleries = yield* galleryService.findAll({
        limit: query.limit,
        offset: query.offset,
      });
      return yield* HttpServerResponse.json(galleries);
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
        images: body.images ? [...body.images] : [],
        category_id: toNullable(body.category_id),
        status: 'draft',
        published_at: null,
      });
      return yield* HttpServerResponse.json(gallery);
    })
  ),
  HttpRouter.get(
    '/admin/api/galleries/:id',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const { id } = yield* decodeParams(Schema.Struct({ id: Schema.String }))(req);
      const galleryService = yield* GalleryService;
      const gallery = yield* galleryService.findById(id);
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
        images: body.images ? [...body.images] : undefined,
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
  HttpRouter.post(
    '/admin/api/media',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const formData = yield* req.multipart;

      const file = formData['file'];

      if (!file || Array.isArray(file)) {
        return yield* Effect.fail(
          new ValidationError({ errors: [{ path: 'file', message: 'File is required and must be single' }] })
        );
      }

      // Handle file data - the type depends on platform implementation
      const f = file as { path?: string; name?: string; filename?: string; type?: string; contentType?: string } | Blob;

      let buffer: Buffer;
      if (f instanceof Blob) {
        buffer = Buffer.from(yield* Effect.promise(() => f.arrayBuffer()));
      } else if (typeof f === 'object' && f.path) {
        const bunFile = Bun.file(f.path);
        buffer = Buffer.from(yield* Effect.promise(() => bunFile.arrayBuffer()));
      } else {
        return yield* Effect.fail(
          new ValidationError({ errors: [{ path: 'file', message: 'Unsupported file format' }] })
        );
      }

      const altField = formData['alt'];
      const alt = Array.isArray(altField) ? altField[0] : altField;
      const filename =
        (f instanceof Blob ? undefined : f.name || f.filename) || 'upload.jpg';
      const mimetype =
        (f instanceof Blob ? f.type : f.type || f.contentType) || 'application/octet-stream';

      const mediaService = yield* MediaService;
      const media = yield* mediaService.create(
        {
          buffer,
          filename: typeof filename === 'string' ? filename : 'upload',
          mimetype: typeof mimetype === 'string' ? mimetype : 'application/octet-stream',
        },
        typeof alt === 'string' ? alt : undefined
      );

      return yield* HttpServerResponse.json(media);
    })
  ),

  // API Keys Admin
  HttpRouter.get(
    '/admin/api/api-keys',
    Effect.gen(function* () {
      const { query } = yield* DbService;
      const keys = yield* query('list_api_keys', (db) =>
        db.selectFrom('api_keys').selectAll().orderBy('created_at', 'desc').execute()
      );
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
            id: crypto.randomUUID(),
            name: body.name,
            prefix: result.prefix,
            key_hash: keyHash,
            created_at: new Date(),
          })
          .returningAll()
          .executeTakeFirstOrThrow()
      );

      return yield* HttpServerResponse.json({ data: { ...apiKey, key: result.key } }, { status: 201 });
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

// For uploads in development mode
const getUploadsPath = (relativePath: string): string => {
  const basePath = process.cwd();
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

// Serve local uploads in development
const uploadsRouter =
  process.env.NODE_ENV !== 'production'
    ? HttpRouter.empty.pipe(
        HttpRouter.get(
          '/uploads/*',
          Effect.gen(function* () {
            const req = yield* HttpServerRequest.HttpServerRequest;
            const url = new URL(req.url, 'http://localhost');
            const filePath = url.pathname.slice(1); // Remove leading /
            return yield* HttpServerResponse.file(getUploadsPath(filePath));
          })
        )
      )
    : HttpRouter.empty;

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

// Storage layer - local for dev, R2 for prod
const StorageLive =
  process.env.NODE_ENV === 'production'
    ? Layer.effect(
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
      )
    : Layer.effect(StorageService, makeLocalStorageService('./uploads', 'http://localhost:3000/uploads'));

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

const ServerLive = BunHttpServer.layer({ port: 3000 });

const serverEffect = appRouter.pipe(HttpServer.serve(errorHandler), HttpServer.withLogAddress);

// Build the complete layer hierarchy
// DbLive needs AppConfig
const DbWithConfig = DbLive.pipe(Layer.provide(AppConfigLive));

// StorageLive needs AppConfig (for R2 in prod)
const StorageWithConfig = StorageLive.pipe(Layer.provide(AppConfigLive));

// ImageServiceLive needs StorageService
const ImageWithStorage = ImageServiceLive.pipe(Layer.provide(StorageWithConfig));

// MediaServiceLive needs DbService and ImageService
const MediaWithDeps = MediaServiceLive.pipe(Layer.provide(DbWithConfig), Layer.provide(ImageWithStorage));

// Content services need DbService
const CategoryWithDb = CategoryServiceLive.pipe(Layer.provide(DbWithConfig));
const PostWithDb = PostServiceLive.pipe(Layer.provide(DbWithConfig));
const GalleryWithDb = GalleryServiceLive.pipe(Layer.provide(DbWithConfig));
const HomeWithDb = HomeServiceLive.pipe(Layer.provide(DbWithConfig));

// AuthServiceLive needs DbService
const AuthWithDb = AuthServiceLive.pipe(Layer.provide(DbWithConfig));

// Combine all service layers
const AllServices = Layer.mergeAll(
  AppConfigLive,
  DbWithConfig,
  StorageWithConfig,
  ImageWithStorage,
  MediaWithDeps,
  CategoryWithDb,
  PostWithDb,
  GalleryWithDb,
  HomeWithDb,
  AuthWithDb
);

// Final app layer with server
const AppLive = serverEffect.pipe(Layer.provide(ServerLive), Layer.provide(AllServices));

const program = Effect.gen(function* () {
  yield* Console.log('Starting CMS server...');
  return yield* Layer.launch(AppLive);
});

BunRuntime.runMain(program);
