/**
 * @fileoverview HTTP Middleware for Authentication
 * @see PRD Section 5.2 - Request Flow
 */

import { HttpMiddleware, HttpServerRequest } from '@effect/platform';
import { Context, Effect } from 'effect';

import { InvalidApiKey, InvalidCredentials, SessionExpired } from './errors';
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

    const sessionId = request.cookies['session'];

    if (!sessionId) {
      return yield* Effect.fail(new InvalidCredentials({ message: 'Missing session cookie' }));
    }

    const session = yield* authService.validateSession(sessionId).pipe(
      Effect.catchTag('SessionExpired', () =>
        Effect.fail(new SessionExpired({ message: 'Session expired' }))
      ),
      Effect.catchTag('DatabaseError', (e) => Effect.die(e))
    );

    // Provide session to the app
    return yield* app.pipe(Effect.provideService(UserContext, { session }));
  })
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
        if (typeof error === 'object' && error !== null && '_tag' in error) {
          if ((error as any)._tag === 'InvalidCredentials') {
            return Effect.fail(new InvalidApiKey({ message: 'Invalid API key' }));
          }
          if ((error as any)._tag === 'DatabaseError') {
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
