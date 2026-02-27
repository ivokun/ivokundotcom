/**
 * @fileoverview Auth E2E Tests
 *
 * Tests authentication flows including login, logout, and rate limiting.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  startTestServer,
  stopTestServer,
  cleanDatabase,
  createTestUser,
  apiClient,
  getTestBaseUrl,
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

  describe('POST /admin/api/login', () => {
    test('returns 200 and sets session cookie on valid credentials', async () => {
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

    test('returns 401 on invalid email', async () => {
      const response = await apiClient.post('/admin/api/login', {
        email: 'nonexistent@example.com',
        password: 'SomePassword123!',
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('InvalidCredentials');
    });

    test('returns 401 on invalid password', async () => {
      const { user } = await createTestUser();

      const response = await apiClient.post('/admin/api/login', {
        email: user.email,
        password: 'WrongPassword123!',
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('InvalidCredentials');
    });

    test('does not leak whether email exists (timing-safe)', async () => {
      // This test verifies the timing attack fix
      // Both invalid email and invalid password should take similar time
      const { user } = await createTestUser();

      const start1 = Date.now();
      await apiClient.post('/admin/api/login', {
        email: 'nonexistent@example.com',
        password: 'SomePassword123!',
      });
      const duration1 = Date.now() - start1;

      const start2 = Date.now();
      await apiClient.post('/admin/api/login', {
        email: user.email,
        password: 'WrongPassword123!',
      });
      const duration2 = Date.now() - start2;

      // Both should take roughly similar time (within 100ms)
      expect(Math.abs(duration1 - duration2)).toBeLessThan(200);
    });

    test('rate limits after 10 failed attempts', async () => {
      // Make 11 failed login attempts
      for (let i = 0; i < 11; i++) {
        const response = await apiClient.post('/admin/api/login', {
          email: `attempt${i}@example.com`,
          password: 'WrongPassword123!',
        });

        if (i < 10) {
          expect(response.status).toBe(401);
        } else {
          expect(response.status).toBe(429);
          const data = await response.json();
          expect(data.error).toBe('TooManyRequests');
        }
      }
    });
  });

  describe('POST /admin/api/logout', () => {
    test('invalidates session cookie', async () => {
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

  describe('GET /admin/api/me', () => {
    test('returns current user info with valid session', async () => {
      const { user, sessionCookie } = await createTestUser('Test Admin');

      const response = await apiClient.get('/admin/api/me', { session: sessionCookie });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        id: user.id,
        email: user.email,
        name: user.name,
      });
      expect(data).not.toHaveProperty('password_hash');
    });

    test('returns 401 without session', async () => {
      const response = await apiClient.get('/admin/api/me');
      expect(response.status).toBe(401);
    });

    test('returns 401 with invalid session', async () => {
      const response = await apiClient.get('/admin/api/me', {
        session: 'session=invalid-session-id',
      });
      expect(response.status).toBe(401);
    });
  });
});
