/**
 * @fileoverview Auth E2E Tests - Simplified
 *
 * Tests basic authentication flows.
 */

import { afterAll, beforeAll, beforeEach,describe, expect, test } from 'bun:test';

import {
  apiClient,
  cleanDatabase,
  createTestUser,
  startTestServer,
  stopTestServer,
} from '../test/e2e-setup';

describe('Auth E2E', () => {
  beforeAll(async () => {
    await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  test('returns session cookie on valid login', async () => {
    const { user, sessionCookie } = await createTestUser('Test User');

    expect(sessionCookie).toMatch(/^session=[a-z0-9]+/);

    // Verify session works
    const meResponse = await apiClient.get('/admin/api/me', {
      session: sessionCookie,
    });

    expect(meResponse.status).toBe(200);
    const meData = await meResponse.json();
    expect(meData.email).toBe(user.email);
  });

  test('returns current user info', async () => {
    const { user, sessionCookie } = await createTestUser('Test Admin');

    const response = await apiClient.get('/admin/api/me', { session: sessionCookie });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(user.id);
    expect(data.email).toBe(user.email);
    expect(data).not.toHaveProperty('password_hash');
  });

  test('logout invalidates session', async () => {
    const { sessionCookie } = await createTestUser();

    // Verify session works
    const meResponse1 = await apiClient.get('/admin/api/me', { session: sessionCookie });
    expect(meResponse1.status).toBe(200);

    // Logout
    const logoutResponse = await apiClient.post('/admin/api/logout', {}, { session: sessionCookie });
    expect(logoutResponse.status).toBe(200);

    // Verify session is invalidated
    const meResponse2 = await apiClient.get('/admin/api/me', { session: sessionCookie });
    expect(meResponse2.status).toBe(401);
  });
});
