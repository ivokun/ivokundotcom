import { describe, expect, it } from 'bun:test';
import { Effect, Exit, Layer } from 'effect';
import { HttpServerRequest, HttpServerResponse } from '@effect/platform';
import { sessionMiddleware, apiKeyMiddleware, UserContext } from './middleware';
import { AuthService } from './services/auth.service';
import { InvalidCredentials, SessionExpired, InvalidApiKey } from './errors';

// Mock AuthService
const makeMockAuthService = (
  validateSession: (id: string) => Effect.Effect<any, any> = () =>
    Effect.fail(new SessionExpired({ message: 'Session expired' })),
  verifyApiKey: (p: string, k: string) => Effect.Effect<boolean, any> = () =>
    Effect.fail(new InvalidCredentials({ message: 'Invalid API key' }))
) =>
  Layer.succeed(
    AuthService,
    AuthService.of({
      validateSession,
      verifyApiKey,
      // Stubs for unused methods
      hashPassword: () => Effect.die('Unused'),
      verifyPassword: () => Effect.die('Unused'),
      createSession: () => Effect.die('Unused'),
      destroySession: () => Effect.die('Unused'),
      validateCredentials: () => Effect.die('Unused'),
      generateApiKey: () => {
        throw new Error('Unused');
      },
    } as any)
  );

// Mock Request
const makeMockRequest = (
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {}
) =>
  Layer.succeed(HttpServerRequest.HttpServerRequest, {
    cookies,
    headers,
  } as any);

describe('Middleware', () => {
  describe('sessionMiddleware', () => {
    it('should pass with valid session', async () => {
      const authLayer = makeMockAuthService((id) =>
        id === 'valid'
          ? Effect.succeed({ id: 'valid', user_id: 'user1' })
          : Effect.fail(new SessionExpired({ message: 'Expired' }))
      );
      const reqLayer = makeMockRequest({ session: 'valid' });

      const program = sessionMiddleware(
        Effect.gen(function* () {
          const ctx = yield* UserContext;
          if (ctx.session.user_id !== 'user1') {
            return yield* Effect.die('Wrong user');
          }
          return HttpServerResponse.text('ok');
        })
      );

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(authLayer), Effect.provide(reqLayer))
      );

      expect(result.status).toBe(200);
    });

    it('should fail with missing cookie', async () => {
      const authLayer = makeMockAuthService();
      const reqLayer = makeMockRequest({});

      const program = sessionMiddleware(Effect.succeed(HttpServerResponse.text('success')));

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(authLayer), Effect.provide(reqLayer))
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        // @ts-ignore
        expect(result.cause.error._tag).toBe('InvalidCredentials');
      }
    });

    it('should fail with expired session', async () => {
      const authLayer = makeMockAuthService(() => Effect.fail(new SessionExpired({ message: 'Expired' })));
      const reqLayer = makeMockRequest({ session: 'expired' });

      const program = sessionMiddleware(Effect.succeed(HttpServerResponse.text('success')));

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(authLayer), Effect.provide(reqLayer))
      );

      expect(Exit.isFailure(result)).toBe(true);
    });
  });

  describe('apiKeyMiddleware', () => {
    it('should pass with valid api key', async () => {
      const authLayer = makeMockAuthService(undefined, (p, k) =>
        k === 'valid_key' ? Effect.succeed(true) : Effect.fail(new InvalidCredentials({ message: 'Invalid' }))
      );
      const reqLayer = makeMockRequest({}, { 'x-api-key': 'valid_key' });

      const program = apiKeyMiddleware(Effect.succeed(HttpServerResponse.text('success')));

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(authLayer), Effect.provide(reqLayer))
      );

      expect(result.status).toBe(200);
    });

    it('should fail with missing header', async () => {
      const authLayer = makeMockAuthService();
      const reqLayer = makeMockRequest({}, {});

      const program = apiKeyMiddleware(Effect.succeed(HttpServerResponse.text('success')));

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(authLayer), Effect.provide(reqLayer))
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        // @ts-ignore
        expect(result.cause.error._tag).toBe('InvalidApiKey');
      }
    });

    it('should fail with invalid key', async () => {
      const authLayer = makeMockAuthService(undefined, () =>
        Effect.fail(new InvalidCredentials({ message: 'Invalid' }))
      );
      const reqLayer = makeMockRequest({}, { 'x-api-key': 'invalid' });

      const program = apiKeyMiddleware(Effect.succeed(HttpServerResponse.text('success')));

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(authLayer), Effect.provide(reqLayer))
      );

      expect(Exit.isFailure(result)).toBe(true);
    });
  });
});
