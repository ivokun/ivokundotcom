/**
 * @fileoverview Categories E2E Tests
 *
 * Tests CRUD operations for categories including deletion constraints.
 */

import { afterAll, beforeAll, beforeEach,describe, expect, test } from 'bun:test';

import {
  apiClient,
  cleanDatabase,
  createTestUser,
  startTestServer,
  stopTestServer,
} from '../test/e2e-setup';
import { categoryFixtures, postFixtures, validators } from '../test/fixtures';

describe('Categories E2E', () => {
  let adminSession: string;

  beforeAll(async () => {
    await startTestServer();
  }, 60000);

  afterAll(async () => {
    await stopTestServer();
  }, 10000);

  beforeEach(async () => {
    await cleanDatabase();
    const { sessionCookie } = await createTestUser();
    adminSession = sessionCookie;
  }, 10000);

  describe('POST /admin/api/categories', () => {
    test('creates a new category with 201 status', async () => {
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

    test('prevents duplicate slug', async () => {
      const data = categoryFixtures.create();

      // First creation succeeds
      const response1 = await apiClient.post('/admin/api/categories', data, {
        session: adminSession,
      });
      expect(response1.status).toBe(201);

      // Second creation with same slug fails
      const response2 = await apiClient.post('/admin/api/categories', data, {
        session: adminSession,
      });
      expect(response2.status).toBe(409);
      const error = await response2.json();
      expect(error.error).toBe('SlugConflict');
    });
  });

  describe('GET /admin/api/categories', () => {
    test('lists all categories', async () => {
      // Create categories
      for (let i = 0; i < 3; i++) {
        await apiClient.post(
          '/admin/api/categories',
          categoryFixtures.create({ name: `Category ${i}` }),
          { session: adminSession }
        );
      }

      const response = await apiClient.get('/admin/api/categories', {
        session: adminSession,
      });

      expect(response.status).toBe(200);
      const categories = await response.json();
      expect(categories.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('GET /api/categories (Public)', () => {
    test('returns categories without authentication', async () => {
      await apiClient.post('/admin/api/categories', categoryFixtures.create(), {
        session: adminSession,
      });

      const response = await apiClient.get('/api/categories');

      expect(response.status).toBe(200);
      const categories = await response.json();
      expect(Array.isArray(categories)).toBe(true);
    });
  });

  describe('PATCH /admin/api/categories/:id', () => {
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
  });

  describe('DELETE /admin/api/categories/:id', () => {
    test('deletes category without posts', async () => {
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

      // Verify deletion
      const getResponse = await apiClient.get(`/admin/api/categories/${id}`, {
        session: adminSession,
      });
      expect(getResponse.status).toBe(404);
    });

    test('prevents deletion when posts reference category', async () => {
      // Create category
      const catResponse = await apiClient.post(
        '/admin/api/categories',
        categoryFixtures.create(),
        { session: adminSession }
      );
      const { id: categoryId } = await catResponse.json();

      // Create post in that category
      await apiClient.post(
        '/admin/api/posts',
        { ...postFixtures.create(), category_id: categoryId },
        { session: adminSession }
      );

      // Try to delete category
      const deleteResponse = await apiClient.del(`/admin/api/categories/${categoryId}`, {
        session: adminSession,
      });

      expect(deleteResponse.status).toBe(400);
      const error = await deleteResponse.json();
      expect(error.error).toBe('ValidationError');
    });
  });
});
