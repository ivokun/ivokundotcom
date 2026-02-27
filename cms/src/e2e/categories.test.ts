/**
 * @fileoverview Categories E2E Tests - Simplified
 *
 * Tests basic CRUD operations for categories.
 */

import { afterAll, beforeAll, beforeEach,describe, expect, test } from 'bun:test';

import {
  apiClient,
  cleanDatabase,
  createTestUser,
  startTestServer,
  stopTestServer,
} from '../test/e2e-setup';
import { categoryFixtures, validators } from '../test/fixtures';

describe('Categories E2E', () => {
  let adminSession: string;

  beforeAll(async () => {
    await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await cleanDatabase();
    const { sessionCookie } = await createTestUser();
    adminSession = sessionCookie;
  });

  test('creates a new category', async () => {
    const categoryData = categoryFixtures.create();

    const response = await apiClient.post('/admin/api/categories', categoryData, {
      session: adminSession,
    });

    expect(response.status).toBe(201);
    const category = await response.json();

    expect(category).toMatchObject({
      name: categoryData.name,
      slug: categoryData.slug,
    });
    expect(validators.isCuid2(category.id)).toBe(true);
  });

  test('lists categories', async () => {
    await apiClient.post('/admin/api/categories', categoryFixtures.create(), {
      session: adminSession,
    });

    const response = await apiClient.get('/admin/api/categories', {
      session: adminSession,
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('updates category', async () => {
    const createResponse = await apiClient.post(
      '/admin/api/categories',
      categoryFixtures.create(),
      { session: adminSession }
    );
    const { id } = await createResponse.json();

    const response = await apiClient.patch(
      `/admin/api/categories/${id}`,
      { name: 'Updated Name' },
      { session: adminSession }
    );

    expect(response.status).toBe(200);
    const category = await response.json();
    expect(category.name).toBe('Updated Name');
  });

  test('deletes category', async () => {
    const createResponse = await apiClient.post(
      '/admin/api/categories',
      categoryFixtures.create(),
      { session: adminSession }
    );
    const { id } = await createResponse.json();

    const deleteResponse = await apiClient.del(`/admin/api/categories/${id}`, {
      session: adminSession,
    });

    expect(deleteResponse.status).toBe(204);
  });
});
