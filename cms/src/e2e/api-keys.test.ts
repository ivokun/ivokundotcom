/**
 * @fileoverview API Keys E2E Tests - Simplified
 *
 * Tests API key management.
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

  test('creates API key', async () => {
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
    expect(data).not.toHaveProperty('keyHash');
    expect(data).not.toHaveProperty('key_hash');
  });

  test('lists API keys', async () => {
    await apiClient.post('/admin/api/api-keys', apiKeyFixtures.standard, {
      session: adminSession,
    });

    const response = await apiClient.get('/admin/api/api-keys', {
      session: adminSession,
    });

    expect(response.status).toBe(200);
    const { data: keys } = await response.json();
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);

    const key = keys[0];
    expect(key).not.toHaveProperty('keyHash');
    expect(key).not.toHaveProperty('key_hash');
  });

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
  });
});
