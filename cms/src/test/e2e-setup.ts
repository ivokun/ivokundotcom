/**
 * @fileoverview E2E Test Setup - Leverages devenv PostgreSQL
 * 
 * This module provides utilities for end-to-end testing that:
 * 1. Uses devenv's PostgreSQL service (ivokundotcom_test database)
 * 2. Starts the actual CMS server as a subprocess on an ephemeral port
 * 3. Provides typed HTTP client for API testing
 * 4. Handles cleanup between tests
 */

import { spawn, type Subprocess } from 'bun';

import type { Config } from '../types';

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

/** Test database URL from devenv environment */
export const TEST_DATABASE_URL =
  process.env['DATABASE_URL'] ||
  'postgres://postgres:postgres@localhost:5432/ivokundotcom_test?sslmode=disable';

/** Test session secret */
const TEST_SESSION_SECRET =
  process.env['SESSION_SECRET'] || 'test-secret-min-32-chars-long-for-e2e-tests-only!';

/** Find an available ephemeral port */
async function findFreePort(): Promise<number> {
  const server = Bun.listen({
    hostname: '127.0.0.1',
    port: 0, // random
    socket: {
      data() {},
    },
  });
  const port = server.port;
  server.stop();
  return port;
}

// =============================================================================
// TEST SERVER MANAGEMENT
// =============================================================================

interface TestServer {
  port: number;
  process: Subprocess;
  shutdown: () => Promise<void>;
}

let currentServer: TestServer | null = null;

/**
 * Start the CMS server for E2E testing on an ephemeral port
 */
export async function startTestServer(config?: Partial<Config>): Promise<TestServer> {
  if (currentServer) {
    throw new Error('Test server already running. Call stopTestServer() first.');
  }

  const port = await findFreePort();

  // Build environment for test server
  const env: Record<string, string> = {
    ...process.env,
    PORT: String(port),
    DATABASE_URL: config?.databaseUrl || TEST_DATABASE_URL,
    SESSION_SECRET: config?.sessionSecret || TEST_SESSION_SECRET,
    NODE_ENV: 'test',
    // Mock R2 credentials for testing
    R2_ACCESS_KEY_ID: 'test',
    R2_ACCESS_SECRET: 'test',
    R2_ENDPOINT: 'http://localhost:9000',
    R2_BUCKET: 'test-bucket',
    R2_PUBLIC_URL: 'http://localhost:9000/test-bucket',
  };

  // Start the server as a subprocess
  // Use process.execPath to get the current bun binary path
  const bunPath = process.execPath;

  // Determine the correct working directory
  // Check if we're already in the cms directory or need to navigate there
  const currentDir = process.cwd();
  const isInCms = currentDir.includes('cms') && !currentDir.includes('cms/src');
  const cwd = isInCms ? currentDir : currentDir + '/cms';

  // Debug logging
  console.error(`[E2E] Starting server with: ${bunPath} run src/server.ts`);
  console.error(`[E2E] Working directory: ${cwd}`);
  console.error(`[E2E] Port: ${port}`);

  // Verify cwd exists and server.ts exists
  const fs = await import('fs');
  const path = await import('path');
  const serverPath = path.join(cwd, 'src', 'server.ts');
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Server file not found: ${serverPath}`);
  }
  console.error(`[E2E] Server file exists: ${serverPath}`);

  const proc = spawn({
    cmd: [bunPath, 'run', 'src/server.ts'],
    cwd,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // Check if process exits immediately
  const earlyExitPromise = new Promise<void>((resolve) => {
    proc.exited.then((code) => {
      console.error(`[E2E] Server process exited early with code: ${code}`);
      resolve();
    });
  });

  // Give process a moment to start or fail
  await Promise.race([earlyExitPromise, new Promise((r) => setTimeout(r, 500))]);

  // Capture server output for debugging
  let stdout = '';
  let stderr = '';

  if (proc.stdout) {
    const reader = proc.stdout.getReader();
    (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        stdout += new TextDecoder().decode(value);
      }
    })();
  }

  if (proc.stderr) {
    const reader = proc.stderr.getReader();
    (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        stderr += new TextDecoder().decode(value);
      }
    })();
  }

  // Wait for server to be ready (health check) with hard timeout
  const serverTimeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Server start timeout')), 30000);
  });

  const isReady = await Promise.race([
    waitForServer(port, 30000),
    serverTimeout,
  ]);

  if (!isReady) {
    proc.kill();
    // Log server output for debugging
    console.error('=== Server stdout ===');
    console.error(stdout);
    console.error('=== Server stderr ===');
    console.error(stderr);
    throw new Error('Test server failed to start within 30 seconds');
  }

  currentServer = {
    port,
    process: proc,
    shutdown: async () => {
      proc.kill();
      await proc.exited;
      currentServer = null;
    },
  };

  return currentServer;
}

/**
 * Wait for server to be ready by polling health endpoint
 */
async function waitForServer(port: number, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  const healthUrl = `http://localhost:${port}/health`;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  return false;
}

/**
 * Stop the test server
 */
export async function stopTestServer(): Promise<void> {
  if (currentServer) {
    await currentServer.shutdown();
  }
}

/**
 * Get the base URL for the running test server
 */
export function getTestBaseUrl(): string {
  if (!currentServer) {
    throw new Error('Test server not running. Call startTestServer() first.');
  }
  return `http://localhost:${currentServer.port}`;
}

// =============================================================================
// DATABASE CLEANUP
// =============================================================================

/**
 * Clean database between tests (truncate tables)
 * Uses direct PostgreSQL connection
 */
export async function cleanDatabase(): Promise<void> {
  const { Pool } = await import('pg');

  const pool = new Pool({
    connectionString: TEST_DATABASE_URL,
  });

  try {
    // Truncate in correct order (respect FK constraints)
    await pool.query(`
      TRUNCATE TABLE sessions, api_keys, home, galleries, posts, media, categories, users 
      RESTART IDENTITY CASCADE
    `);
  } finally {
    await pool.end();
  }
}

// =============================================================================
// HTTP CLIENT
// =============================================================================

export interface RequestOptions {
  /** Admin session cookie */
  session?: string;
  /** API key for public endpoints */
  apiKey?: string;
  /** Request body */
  body?: unknown;
}

/**
 * Make a request to the test server
 */
async function makeRequest(
  method: string,
  path: string,
  options: RequestOptions = {}
): Promise<Response> {
  const url = `${getTestBaseUrl()}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.session) {
    headers['Cookie'] = options.session;
  }

  if (options.apiKey) {
    headers['X-Api-Key'] = options.apiKey;
  }

  const init: RequestInit = {
    method,
    headers,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  return fetch(url, init);
}

/**
 * Typed HTTP client for E2E tests
 */
export const apiClient = {
  /** GET request */
  get: (path: string, opts?: Omit<RequestOptions, 'body'>) => makeRequest('GET', path, opts),

  /** POST request */
  post: (path: string, body: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    makeRequest('POST', path, { ...opts, body }),

  /** PATCH request */
  patch: (path: string, body: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    makeRequest('PATCH', path, { ...opts, body }),

  /** DELETE request */
  del: (path: string, opts?: Omit<RequestOptions, 'body'>) => makeRequest('DELETE', path, opts),
};

// =============================================================================
// AUTH HELPERS
// =============================================================================

/**
 * Create a test admin user and return session cookie
 * Seeds user directly via database (bypasses invite flow)
 */
export async function createTestUser(
  name = 'Test User',
  email?: string
): Promise<{ user: { id: string; email: string; name: string }; sessionCookie: string }> {
  const testEmail =
    email || `test-${Date.now()}-${Math.random().toString(36).slice(2, 11)}@example.com`;

  // Seed user directly via database
  const [{ createId }, { hash }, { Pool }] = await Promise.all([
    import('@paralleldrive/cuid2'),
    import('@node-rs/argon2'),
    import('pg'),
  ]);

  const pool = new Pool({
    connectionString: TEST_DATABASE_URL,
  });

  const userId = createId();
  const passwordHash = await hash('TestPassword123!', {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    outputLen: 32,
  });

  try {
    await pool.query(
      `INSERT INTO users (id, email, password_hash, name, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, testEmail, passwordHash, name]
    );

    // Login to get session
    const loginResponse = await apiClient.post('/admin/api/login', {
      email: testEmail,
      password: 'TestPassword123!',
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.text();
      throw new Error(`Failed to login: ${error}`);
    }

    // Extract session cookie
    const setCookie = loginResponse.headers.get('set-cookie');
    const sessionMatch = setCookie?.match(/session=([^;]+)/);

    if (!sessionMatch) {
      throw new Error('No session cookie in login response');
    }

    return {
      user: { id: userId, email: testEmail, name },
      sessionCookie: `session=${sessionMatch[1]}`,
    };
  } finally {
    await pool.end();
  }
}

/**
 * Create a test API key
 */
export async function createTestApiKey(session: string, name = 'Test API Key'): Promise<string> {
  const response = await apiClient.post('/admin/api/api-keys', { name }, { session });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create API key: ${error}`);
  }

  const { data } = await response.json();
  return data.key;
}

// =============================================================================
// TEST LIFECYCLE
// =============================================================================

/**
 * Standard test lifecycle hooks for E2E tests
 */
export const e2eLifecycle = {
  /** Setup - start server and return cleanup function */
  async setup(): Promise<{ cleanup: () => Promise<void> }> {
    await startTestServer();

    return {
      cleanup: async () => {
        await stopTestServer();
      },
    };
  },

  /** Reset database between tests */
  reset: cleanDatabase,
};
