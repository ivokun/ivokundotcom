/**
 * @fileoverview Posts E2E Tests - Simplified
 *
 * Tests basic CRUD operations for posts.
 */

import { afterAll, beforeAll, beforeEach,describe, expect, test } from 'bun:test';

import {
  apiClient,
  cleanDatabase,
  createTestUser,
  startTestServer,
  stopTestServer,
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
  });

  test('lists posts', async () => {
    // Create a post first
    await apiClient.post('/admin/api/posts', postFixtures.create(), {
      session: adminSession,
    });

    const response = await apiClient.get('/admin/api/posts', {
      session: adminSession,
    });

    expect(response.status).toBe(200);
    const posts = await response.json();
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThanOrEqual(1);
  });

  test('gets post by ID', async () => {
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

  test('updates post', async () => {
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

  test('deletes post', async () => {
    const createResponse = await apiClient.post('/admin/api/posts', postFixtures.create(), {
      session: adminSession,
    });
    const { id } = await createResponse.json();

    const deleteResponse = await apiClient.del(`/admin/api/posts/${id}`, {
      session: adminSession,
    });

    expect(deleteResponse.status).toBe(204);
  });

  test('publishes a post', async () => {
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
  });
});
