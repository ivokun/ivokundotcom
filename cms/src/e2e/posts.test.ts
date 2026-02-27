/**
 * @fileoverview Posts E2E Tests
 *
 * Tests CRUD operations for posts including publishing workflow.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  startTestServer,
  stopTestServer,
  cleanDatabase,
  createTestUser,
  createTestApiKey,
  apiClient,
} from '../test/e2e-setup';
import { postFixtures, validators } from '../test/fixtures';

describe('Posts E2E', () => {
  let adminSession: string;

  beforeAll(async () => {
    await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await cleanDatabase();
    const { sessionCookie } = await createTestUser('Test Admin');
    adminSession = sessionCookie;
  });

  describe('POST /admin/api/posts', () => {
    test('creates a new post with 201 status', async () => {
      const postData = postFixtures.create();

      const response = await apiClient.post('/admin/api/posts', postData, {
        session: adminSession,
      });

      expect(response.status).toBe(201);
      const post = await response.json();

      expect(post).toMatchObject({
        title: postData.title,
        slug: postData.slug,
        status: 'draft',
        locale: 'en',
      });
      expect(validators.isCuid2(post.id)).toBe(true);
      expect(post.created_at).toBeDefined();
      expect(post.updated_at).toBeDefined();
    });

    test('creates post with all fields', async () => {
      const response = await apiClient.post('/admin/api/posts', postFixtures.full, {
        session: adminSession,
      });

      expect(response.status).toBe(201);
      const post = await response.json();

      expect(post.excerpt).toBe(postFixtures.full.excerpt);
      expect(post.content).toEqual(postFixtures.full.content);
    });

    test('returns 400 on invalid data', async () => {
      const response = await apiClient.post(
        '/admin/api/posts',
        { title: '' }, // Invalid: empty title
        { session: adminSession }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('ValidationError');
    });

    test('returns 401 without session', async () => {
      const response = await apiClient.post('/admin/api/posts', postFixtures.minimal);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /admin/api/posts', () => {
    test('lists posts with pagination', async () => {
      // Create multiple posts
      for (let i = 0; i < 5; i++) {
        await apiClient.post('/admin/api/posts', postFixtures.create({ title: `Post ${i}` }), {
          session: adminSession,
        });
      }

      const response = await apiClient.get('/admin/api/posts?limit=3&offset=0', {
        session: adminSession,
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(3);
    });

    test('filters by status', async () => {
      // Create draft post
      const draftResponse = await apiClient.post('/admin/api/posts', postFixtures.create(), {
        session: adminSession,
      });
      const draft = await draftResponse.json();

      // Create and publish post
      const publishResponse = await apiClient.post('/admin/api/posts', postFixtures.create(), {
        session: adminSession,
      });
      const { id } = await publishResponse.json();
      await apiClient.post(`/admin/api/posts/${id}/publish`, {}, { session: adminSession });

      // Filter by published status
      const response = await apiClient.get('/admin/api/posts?status=published', {
        session: adminSession,
      });

      const posts = await response.json();
      expect(posts.every((p: any) => p.status === 'published')).toBe(true);
    });
  });

  describe('GET /admin/api/posts/:id', () => {
    test('returns post by ID', async () => {
      const createResponse = await apiClient.post('/admin/api/posts', postFixtures.create(), {
        session: adminSession,
      });
      const { id } = await createResponse.json();

      const response = await apiClient.get(`/admin/api/posts/${id}`, {
        session: adminSession,
      });

      expect(response.status).toBe(200);
      const post = await response.json();
      expect(post.id).toBe(id);
    });

    test('returns 404 for non-existent post', async () => {
      const response = await apiClient.get('/admin/api/posts/nonexistentid', {
        session: adminSession,
      });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /admin/api/posts/:id', () => {
    test('updates post fields', async () => {
      const createResponse = await apiClient.post('/admin/api/posts', postFixtures.create(), {
        session: adminSession,
      });
      const { id } = await createResponse.json();

      const response = await apiClient.patch(
        `/admin/api/posts/${id}`,
        { title: 'Updated Title' },
        { session: adminSession }
      );

      expect(response.status).toBe(200);
      const post = await response.json();
      expect(post.title).toBe('Updated Title');
    });

    test('prevents duplicate slug conflicts', async () => {
      const post1 = await apiClient.post('/admin/api/posts', postFixtures.create(), {
        session: adminSession,
      });
      const { slug } = await post1.json();

      const post2 = await apiClient.post('/admin/api/posts', postFixtures.create(), {
        session: adminSession,
      });
      const { id: id2 } = await post2.json();

      // Try to update post2 with post1's slug
      const response = await apiClient.patch(
        `/admin/api/posts/${id2}`,
        { slug },
        { session: adminSession }
      );

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('SlugConflict');
    });
  });

  describe('DELETE /admin/api/posts/:id', () => {
    test('deletes post', async () => {
      const createResponse = await apiClient.post('/admin/api/posts', postFixtures.create(), {
        session: adminSession,
      });
      const { id } = await createResponse.json();

      const deleteResponse = await apiClient.del(`/admin/api/posts/${id}`, {
        session: adminSession,
      });

      expect(deleteResponse.status).toBe(204);

      // Verify deletion
      const getResponse = await apiClient.get(`/admin/api/posts/${id}`, {
        session: adminSession,
      });
      expect(getResponse.status).toBe(404);
    });
  });

  describe('POST /admin/api/posts/:id/publish', () => {
    test('publishes a draft post', async () => {
      const createResponse = await apiClient.post('/admin/api/posts', postFixtures.create(), {
        session: adminSession,
      });
      const { id } = await createResponse.json();

      const response = await apiClient.post(`/admin/api/posts/${id}/publish`, {}, {
        session: adminSession,
      });

      expect(response.status).toBe(200);
      const post = await response.json();
      expect(post.status).toBe('published');
      expect(post.published_at).toBeDefined();
    });

    test('published post appears in public API', async () => {
      // Create and publish post
      const createResponse = await apiClient.post('/admin/api/posts', postFixtures.create(), {
        session: adminSession,
      });
      const { id } = await createResponse.json();
      await apiClient.post(`/admin/api/posts/${id}/publish`, {}, { session: adminSession });

      // Create API key
      const apiKey = await createTestApiKey(adminSession);

      // Verify in public API
      const response = await apiClient.get(`/api/posts?limit=100`, { apiKey });
      const posts = await response.json();

      expect(posts.some((p: any) => p.id === id)).toBe(true);
    });
  });

  describe('POST /admin/api/posts/:id/unpublish', () => {
    test('unpublishes a post', async () => {
      // Create and publish
      const createResponse = await apiClient.post('/admin/api/posts', postFixtures.create(), {
        session: adminSession,
      });
      const { id } = await createResponse.json();
      await apiClient.post(`/admin/api/posts/${id}/publish`, {}, { session: adminSession });

      // Unpublish
      const response = await apiClient.post(`/admin/api/posts/${id}/unpublish`, {}, {
        session: adminSession,
      });

      expect(response.status).toBe(200);
      const post = await response.json();
      expect(post.status).toBe('draft');
    });
  });

  describe('Public API /api/posts', () => {
    test('returns only published posts', async () => {
      // Create draft
      await apiClient.post('/admin/api/posts', postFixtures.create(), {
        session: adminSession,
      });

      // Create and publish
      const publishResponse = await apiClient.post('/admin/api/posts', postFixtures.create(), {
        session: adminSession,
      });
      const { id } = await publishResponse.json();
      await apiClient.post(`/admin/api/posts/${id}/publish`, {}, { session: adminSession });

      // Get API key
      const apiKey = await createTestApiKey(adminSession);

      // Public API should only see published
      const response = await apiClient.get('/api/posts', { apiKey });
      const posts = await response.json();

      expect(posts.every((p: any) => p.status === 'published')).toBe(true);
    });

    test('requires API key', async () => {
      const response = await apiClient.get('/api/posts');
      expect(response.status).toBe(401);
    });

    test('validates API key', async () => {
      const response = await apiClient.get('/api/posts', { apiKey: 'invalid-key' });
      expect(response.status).toBe(401);
    });
  });
});
