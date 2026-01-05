import { describe, expect, it, mock } from 'bun:test';
import { Effect, Layer } from 'effect';

import type { Post, PostWithMedia } from '../types';

import { DbService } from './db.service';
import { PostService, makePostService } from './post.service';

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

describe('PostService', () => {
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
      program.pipe(Effect.provide(PostServiceLayer), Effect.provide(layer))
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
      program.pipe(Effect.provide(PostServiceLayer), Effect.provide(layer))
    );

    expect(result._tag).toBe('Failure');
  });

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
      program.pipe(Effect.provide(PostServiceLayer), Effect.provide(layer))
    );

    expect(result.id).toBe('123');
    expect(result.category?.id).toBe('cat1');
    expect(result.featured_media).toBeNull();
  });
});
