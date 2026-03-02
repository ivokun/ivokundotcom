/**
 * @fileoverview HTTP Middleware for Authentication
 * @see PRD Section 5.2 - Request Flow
 */

import { HttpMiddleware, HttpServerRequest, HttpServerResponse } from '@effect/platform';
import { Context, Effect } from 'effect';

import { InvalidApiKey, InvalidCredentials, isAppError,SessionExpired } from './errors';

// =============================================================================
// RATE LIMITING
// In-memory rate limiter for login endpoint (C3)
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/** Periodic cleanup of expired entries (every 5 minutes) */
const RATE_LIMIT_CLEANUP_INTERVAL = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now >= entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, RATE_LIMIT_CLEANUP_INTERVAL);

const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const loginRateLimitMiddleware = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;

    const ip =
      request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ??
      request.headers['x-real-ip']?.toString() ??
      'unknown';
    const key = `login:${ip}`;
    const now = Date.now();

    const entry = rateLimitStore.get(key);
    if (entry && now < entry.resetTime) {
      if (entry.count >= LOGIN_MAX_ATTEMPTS) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
        return yield* HttpServerResponse.json(
          { error: 'TooManyRequests', message: 'Too many login attempts, please try again later' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        );
      }
      entry.count++;
    } else {
      rateLimitStore.set(key, { count: 1, resetTime: now + LOGIN_WINDOW_MS });
    }

    return yield* app;
  })
);
import { AuthService } from './services/auth.service';
import type { Session } from './types';

// =============================================================================
// CONTEXT TAGS
// =============================================================================

export class UserContext extends Context.Tag('UserContext')<
  UserContext,
  {
    readonly session: Session;
  }
>() {}

// =============================================================================
// SESSION MIDDLEWARE
// @see PRD 7.2.1 - Admin API Authentication
// =============================================================================

export const sessionMiddleware = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const authService = yield* AuthService;

    // Support __Host- prefixed cookie in production
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieName = isProduction ? '__Host-session' : 'session';
    const sessionId = request.cookies[cookieName] ?? request.cookies['session'];

    if (!sessionId) {
      return yield* HttpServerResponse.json(
        { error: 'InvalidCredentials', message: 'Missing session cookie' },
        { status: 401 }
      );
    }

    const session = yield* authService.validateSession(sessionId).pipe(
      Effect.catchTag('SessionExpired', () =>
        Effect.fail(new SessionExpired({ message: 'Session expired' }))
      ),
      Effect.catchTag('DatabaseError', (e) => Effect.die(e))
    );

    // Provide session to the app
    return yield* app.pipe(Effect.provideService(UserContext, { session }));
  }).pipe(
    Effect.catchTag('SessionExpired', () =>
      HttpServerResponse.json(
        { error: 'SessionExpired', message: 'Session expired' },
        { status: 401 }
      )
    )
  )
);

// =============================================================================
// API KEY MIDDLEWARE
// @see PRD 7.1 - Public API Authentication
// =============================================================================

export const apiKeyMiddleware = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const authService = yield* AuthService;

    const apiKey = request.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      return yield* Effect.fail(new InvalidApiKey({ message: 'Missing X-Api-Key header' }));
    }

    // Extract prefix (first 12 chars based on AuthService implementation)
    const prefix = apiKey.substring(0, 12);

    yield* authService.verifyApiKey(prefix, apiKey).pipe(
      Effect.catchAll((error) => {
        if (isAppError(error)) {
          if (error._tag === 'InvalidCredentials') {
            return Effect.fail(new InvalidApiKey({ message: 'Invalid API key' }));
          }
          if (error._tag === 'DatabaseError') {
            return Effect.die(error);
          }
        }
        // Fallback for unknown errors or untagged errors
        return Effect.fail(new InvalidApiKey({ message: 'Invalid API key' }));
      })
    );

    return yield* app;
  })
);
