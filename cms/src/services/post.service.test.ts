import { describe, expect, it, mock } from 'bun:test';
import { Effect, Layer } from 'effect';

import type { Post, PostWithMedia } from '../types';
import { DbService } from './db.service';
import { makePostService, PostService } from './post.service';
import { WebhookService, WebhookServiceLive } from './webhook.service';

const mockDbService = (queryFn: (op: string, fn: any) => Effect.Effect<any, any>) =>
  Layer.succeed(
    DbService,
    DbService.of({
      db: {} as any,
      query: queryFn,
      transaction: (fn) => fn({} as any) as any,
    })
  );

const mockPost = (overrides: Partial<Post> = {}): Post => ({
  id: '123',
  title: 'Test Post',
  slug: 'test-post',
  excerpt: null,
  content: null,
  featured_image: null,
  read_time_minute: null,
  category_id: null,
  locale: 'en',
  status: 'draft',
  published_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const mockWebhookService = Layer.succeed(
  WebhookService,
  WebhookService.of({
    triggerDeploy: () => Effect.void,
  })
);

describe('PostService', () => {
  describe('create', () => {
    it('should create a post', async () => {
    const post = mockPost();
    const queryStub = mock((op: string) => {
      if (op === 'check_post_slug') return Effect.succeed(undefined);
      if (op === 'create_post') return Effect.succeed(post);
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const PostServiceLayer = Layer.effect(PostService, makePostService);

    const program = Effect.gen(function* () {
      const service = yield* PostService;
      return yield* service.create({ title: 'Test Post', locale: 'en', status: 'draft' });
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(PostServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
    );

    expect(result).toEqual(post);
    expect(queryStub).toHaveBeenCalledTimes(2);
  });

  it('should fail on slug conflict', async () => {
    const queryStub = mock((op: string) => {
      if (op === 'check_post_slug') return Effect.succeed({ id: 'existing' });
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const PostServiceLayer = Layer.effect(PostService, makePostService);

    const program = Effect.gen(function* () {
      const service = yield* PostService;
      return yield* service.create({ title: 'Test Post', locale: 'en', status: 'draft' });
    });

    const result = await Effect.runPromiseExit(
      program.pipe(
        Effect.provide(PostServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
    );

    expect(result._tag).toBe('Failure');
  });

  it('should fail on category not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'check_post_slug') return Effect.succeed(undefined);
        if (op === 'check_category_exists') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const PostServiceLayer = Layer.effect(PostService, makePostService);

      const program = Effect.gen(function* () {
        const service = yield* PostService;
        return yield* service.create({
          title: 'Test Post',
          locale: 'en',
          status: 'draft',
          category_id: 'non-existent-category',
        });
      });

      const result = await Effect.runPromiseExit(
        program.pipe(
          Effect.provide(PostServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('findById', () => {
    it('should find post by id with relations', async () => {
    const post = mockPost();
    const resultFromDb = {
      ...post,
      cat_id: 'cat1',
      cat_name: 'Category 1',
      cat_slug: 'cat-1',
      cat_desc: null,
      cat_created_at: new Date(),
      cat_updated_at: new Date(),
      media_id: null,
    };

    const queryStub = mock((op: string) => {
      if (op === 'find_post_by_id') return Effect.succeed(resultFromDb);
      return Effect.die(`Unexpected op: ${op}`);
    });

    const layer = mockDbService(queryStub);
    const PostServiceLayer = Layer.effect(PostService, makePostService);

    const program = Effect.gen(function* () {
      const service = yield* PostService;
      return yield* service.findById('123');
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(PostServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
    );

    expect(result.id).toBe('123');
    expect(result.category?.id).toBe('cat1');
    expect(result.featured_media).toBeNull();
    });

    it('should fail findById if not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'find_post_by_id') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const PostServiceLayer = Layer.effect(PostService, makePostService);

      const program = Effect.gen(function* () {
        const service = yield* PostService;
        return yield* service.findById('non-existent');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(
          Effect.provide(PostServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('findBySlug', () => {
    it('should find post by slug with locale', async () => {
      const post = mockPost();
      const resultFromDb = {
        ...post,
        cat_id: null,
        media_id: null,
      };

      const queryStub = mock((op: string) => {
        if (op === 'find_post_by_slug') return Effect.succeed(resultFromDb);
        return Effect.die(`Unexpected op: ${op}`);
      });

    const layer = mockDbService(queryStub);
    const PostServiceLayer = Layer.effect(PostService, makePostService);

    const program = Effect.gen(function* () {
      const service = yield* PostService;
      return yield* service.findBySlug('test-post', 'en');
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(PostServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
    );

    expect(result.id).toBe('123');
    expect(result.slug).toBe('test-post');
    });

    it('should fail findBySlug if not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'find_post_by_slug') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const PostServiceLayer = Layer.effect(PostService, makePostService);

      const program = Effect.gen(function* () {
        const service = yield* PostService;
        return yield* service.findBySlug('non-existent', 'en');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(
          Effect.provide(PostServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('findAll', () => {
    it('should find all posts with pagination', async () => {
      const post = mockPost();
      const resultFromDb = {
        ...post,
        cat_id: null,
        media_id: null,
      };

      const queryStub = mock((op: string) => {
        if (op === 'find_all_posts') return Effect.succeed([resultFromDb]);
        if (op === 'count_posts') return Effect.succeed({ count: '1' });
        return Effect.die(`Unexpected op: ${op}`);
      });

    const layer = mockDbService(queryStub);
    const PostServiceLayer = Layer.effect(PostService, makePostService);

    const program = Effect.gen(function* () {
      const service = yield* PostService;
      return yield* service.findAll({ limit: 10, offset: 0 });
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(PostServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
    );

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.limit).toBe(10);
    expect(result.meta.offset).toBe(0);
    });

    it('should find all posts with status filter', async () => {
      const post = mockPost({ status: 'published' });
      const resultFromDb = {
        ...post,
        cat_id: null,
        media_id: null,
      };

      const queryStub = mock((op: string) => {
        if (op === 'find_all_posts') return Effect.succeed([resultFromDb]);
        if (op === 'count_posts') return Effect.succeed({ count: '1' });
        return Effect.die(`Unexpected op: ${op}`);
      });

    const layer = mockDbService(queryStub);
    const PostServiceLayer = Layer.effect(PostService, makePostService);

    const program = Effect.gen(function* () {
      const service = yield* PostService;
      return yield* service.findAll({ filter: { status: 'published' } });
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(PostServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
    );

    expect(result.data[0]?.status).toBe('published');
    });

    it('should find all posts with locale filter', async () => {
      const post = mockPost({ locale: 'id' });
      const resultFromDb = {
        ...post,
        cat_id: null,
        media_id: null,
      };

      const queryStub = mock((op: string) => {
        if (op === 'find_all_posts') return Effect.succeed([resultFromDb]);
        if (op === 'count_posts') return Effect.succeed({ count: '1' });
        return Effect.die(`Unexpected op: ${op}`);
      });

    const layer = mockDbService(queryStub);
    const PostServiceLayer = Layer.effect(PostService, makePostService);

    const program = Effect.gen(function* () {
      const service = yield* PostService;
      return yield* service.findAll({ filter: { locale: 'id' } });
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(PostServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
    );

    expect(result.data[0]?.locale).toBe('id');
    });

    it('should find all posts with category filter', async () => {
      const post = mockPost({ category_id: 'cat-123' });
      const resultFromDb = {
        ...post,
        cat_id: 'cat-123',
        cat_name: 'Test Category',
        cat_slug: 'test-cat',
        cat_desc: null,
        cat_created_at: new Date(),
        cat_updated_at: new Date(),
        media_id: null,
      };

      const queryStub = mock((op: string) => {
        if (op === 'find_all_posts') return Effect.succeed([resultFromDb]);
        if (op === 'count_posts') return Effect.succeed({ count: '1' });
        return Effect.die(`Unexpected op: ${op}`);
      });

    const layer = mockDbService(queryStub);
    const PostServiceLayer = Layer.effect(PostService, makePostService);

    const program = Effect.gen(function* () {
      const service = yield* PostService;
      return yield* service.findAll({ filter: { categoryId: 'cat-123' } });
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(PostServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
    );

    const first = result.data[0];
    expect(first?.category_id).toBe('cat-123');
    expect(first?.category?.id).toBe('cat-123');
    });

    it('should find all posts with search filter', async () => {
      const post = mockPost({ title: 'Searchable Title' });
      const resultFromDb = {
        ...post,
        cat_id: null,
        media_id: null,
      };

      const queryStub = mock((op: string) => {
        if (op === 'find_all_posts') return Effect.succeed([resultFromDb]);
        if (op === 'count_posts') return Effect.succeed({ count: '1' });
        return Effect.die(`Unexpected op: ${op}`);
      });

    const layer = mockDbService(queryStub);
    const PostServiceLayer = Layer.effect(PostService, makePostService);

    const program = Effect.gen(function* () {
      const service = yield* PostService;
      return yield* service.findAll({ filter: { search: 'searchable' } });
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(PostServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
    );

    expect(result.data).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('should update a post', async () => {
      const currentPost = mockPost({ title: 'Old Title', slug: 'old-title' });
      const updatedPost = mockPost({ title: 'New Title', slug: 'new-title' });

      const queryStub = mock((op: string) => {
        if (op === 'get_post_for_update') return Effect.succeed(currentPost);
        if (op === 'check_post_slug_update') return Effect.succeed(undefined);
        if (op === 'update_post') return Effect.succeed(updatedPost);
        return Effect.die(`Unexpected op: ${op}`);
      });

    const layer = mockDbService(queryStub);
    const PostServiceLayer = Layer.effect(PostService, makePostService);

    const program = Effect.gen(function* () {
      const service = yield* PostService;
      return yield* service.update('123', { title: 'New Title' });
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(PostServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
    );

    expect(result.title).toBe('New Title');
    expect(result.slug).toBe('new-title');
    });

    it('should fail update if post not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'get_post_for_update') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const PostServiceLayer = Layer.effect(PostService, makePostService);

      const program = Effect.gen(function* () {
        const service = yield* PostService;
        return yield* service.update('non-existent', { title: 'New Title' });
      });

      const result = await Effect.runPromiseExit(
        program.pipe(
          Effect.provide(PostServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result._tag).toBe('Failure');
    });

    it('should fail update on slug conflict', async () => {
      const currentPost = mockPost({ title: 'Old Title', slug: 'old-title' });

      const queryStub = mock((op: string) => {
        if (op === 'get_post_for_update') return Effect.succeed(currentPost);
        if (op === 'check_post_slug_update') return Effect.succeed({ id: 'other-post' });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const PostServiceLayer = Layer.effect(PostService, makePostService);

      const program = Effect.gen(function* () {
        const service = yield* PostService;
        return yield* service.update('123', { title: 'Conflicting Title', slug: 'existing-slug' });
      });

      const result = await Effect.runPromiseExit(
        program.pipe(
          Effect.provide(PostServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result._tag).toBe('Failure');
    });

    it('should fail update on category not found', async () => {
      const currentPost = mockPost({ title: 'Old Title', slug: 'old-title' });

      const queryStub = mock((op: string) => {
        if (op === 'get_post_for_update') return Effect.succeed(currentPost);
        if (op === 'check_post_slug_update') return Effect.succeed(undefined);
        if (op === 'check_category_exists_update') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const PostServiceLayer = Layer.effect(PostService, makePostService);

      const program = Effect.gen(function* () {
        const service = yield* PostService;
        return yield* service.update('123', { category_id: 'non-existent' });
      });

      const result = await Effect.runPromiseExit(
        program.pipe(
          Effect.provide(PostServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result._tag).toBe('Failure');
    });

    it('should update without changing slug when only content changes', async () => {
      const currentPost = mockPost({ title: 'Same Title', slug: 'same-title' });
      const updatedPost = mockPost({
        title: 'Same Title',
        slug: 'same-title',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
      });

      const queryStub = mock((op: string) => {
        if (op === 'get_post_for_update') return Effect.succeed(currentPost);
        if (op === 'update_post') return Effect.succeed(updatedPost);
        return Effect.die(`Unexpected op: ${op}`);
      });

    const layer = mockDbService(queryStub);
    const PostServiceLayer = Layer.effect(PostService, makePostService);

    const program = Effect.gen(function* () {
      const service = yield* PostService;
      return yield* service.update('123', {
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
      });
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(PostServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
    );

    expect(result.slug).toBe('same-title');
    });
  });

  describe('delete', () => {
    it('should delete a post', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'delete_post') return Effect.succeed({ numDeletedRows: 1n });
        return Effect.die(`Unexpected op: ${op}`);
      });

    const layer = mockDbService(queryStub);
    const PostServiceLayer = Layer.effect(PostService, makePostService);

    const program = Effect.gen(function* () {
      const service = yield* PostService;
      return yield* service.delete('123');
    });

    await Effect.runPromise(
      program.pipe(
        Effect.provide(PostServiceLayer),
        Effect.provide(layer),
        Effect.provide(mockWebhookService)
      )
    );

    expect(true).toBe(true);
    });

    it('should fail delete if post not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'delete_post') return Effect.succeed({ numDeletedRows: 0n });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const PostServiceLayer = Layer.effect(PostService, makePostService);

      const program = Effect.gen(function* () {
        const service = yield* PostService;
        return yield* service.delete('non-existent');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(
          Effect.provide(PostServiceLayer),
          Effect.provide(layer),
          Effect.provide(mockWebhookService)
        )
      );

      expect(result._tag).toBe('Failure');
    });
  });
});
