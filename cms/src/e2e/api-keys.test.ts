/**
 * @fileoverview API Keys E2E Tests
 *
 * Tests API key management and authentication.
 */

import { afterAll, beforeAll, beforeEach,describe, expect, test } from 'bun:test';

import {
  apiClient,
  cleanDatabase,
  createTestUser,
  startTestServer,
  stopTestServer,
} from '../test/e2e-setup';
import { apiKeyFixtures, validators } from '../test/fixtures';

describe('API Keys E2E', () => {
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

  describe('POST /admin/api/api-keys', () => {
    test('creates API key and returns plaintext only once', async () => {
      const response = await apiClient.post(
        '/admin/api/api-keys',
        apiKeyFixtures.standard,
        { session: adminSession }
      );

      expect(response.status).toBe(201);
      const { data } = await response.json();

      expect(data.name).toBe(apiKeyFixtures.standard.name);
      expect(validators.isCuid2(data.id)).toBe(true);
      expect(data.key).toBeDefined();
      expect(data.key).toMatch(/^cms_[a-z0-9]+$/);

      // Hash should NOT be in response
      expect(data).not.toHaveProperty('keyHash');
      expect(data).not.toHaveProperty('key_hash');
    });

    test('lists API keys without exposing hashes', async () => {
      // Create API key
      await apiClient.post('/admin/api/api-keys', apiKeyFixtures.standard, {
        session: adminSession,
      });

      // List keys
      const response = await apiClient.get('/admin/api/api-keys', {
        session: adminSession,
      });

      expect(response.status).toBe(200);
      const { data: keys } = await response.json();

      expect(keys.length).toBeGreaterThan(0);

      const key = keys[0];
      expect(key).not.toHaveProperty('keyHash');
      expect(key).not.toHaveProperty('key_hash');
      expect(key.prefix).toBeDefined();
    });
  });

  describe('DELETE /admin/api/api-keys/:id', () => {
    test('deletes API key', async () => {
      const createResponse = await apiClient.post(
        '/admin/api/api-keys',
        apiKeyFixtures.standard,
        { session: adminSession }
      );
      const { id } = await createResponse.json();

      const deleteResponse = await apiClient.del(`/admin/api/api-keys/${id}`, {
        session: adminSession,
      });

      expect(deleteResponse.status).toBe(204);

      // Verify key no longer works
      const apiResponse = await apiClient.get('/api/posts', {
        apiKey: 'deleted-key',
      });
      expect(apiResponse.status).toBe(401);
    });
  });

  describe('Public API authentication', () => {
    test('accepts valid API key', async () => {
      const createResponse = await apiClient.post(
        '/admin/api/api-keys',
        apiKeyFixtures.standard,
        { session: adminSession }
      );
      const { key } = await createResponse.json();

      const response = await apiClient.get('/api/posts', { apiKey: key });
      expect(response.status).toBe(200);
    });

    test('rejects invalid API key', async () => {
      const response = await apiClient.get('/api/posts', {
        apiKey: 'invalid-key-format',
      });
      expect(response.status).toBe(401);
    });

    test('rejects missing API key', async () => {
      const response = await apiClient.get('/api/posts');
      expect(response.status).toBe(401);
    });
  });
});
