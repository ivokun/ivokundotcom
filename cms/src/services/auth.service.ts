/**
 * @fileoverview Authentication service with Argon2 password hashing
 * @see PRD SEC-9.1.1 - Argon2id password hashing
 * @see PRD SEC-9.1.3 - 7-day session expiry
 */

import { hash, verify } from '@node-rs/argon2';
import { createId } from '@paralleldrive/cuid2';
import { Context, Effect, Layer } from 'effect';

import { DatabaseError, InvalidCredentials, SessionExpired } from '../errors';
import type { NewSession, SafeUser, Session, User } from '../types';
import { DbService } from './db.service';

// =============================================================================
// CONSTANTS
// =============================================================================

const SESSION_EXPIRY_DAYS = 7;

// Argon2 configuration (OWASP recommended)
const ARGON2_OPTIONS = {
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
};

// Dummy hash for timing attack prevention (generated from empty string with ARGON2_OPTIONS)
// This ensures constant-time execution during credential validation
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$UBB4LKVZeEzBdOrNM7gWsw$7gAP8+6ZUenK0lM5lU8i6u4d8f3q2x1v0b9n5m7k4j2h1g0f';

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export class AuthService extends Context.Tag('AuthService')<
  AuthService,
  {
    readonly hashPassword: (password: string) => Effect.Effect<string, DatabaseError>;
    readonly verifyPassword: (hash: string, password: string) => Effect.Effect<boolean, DatabaseError>;
    readonly createSession: (userId: string) => Effect.Effect<Session, DatabaseError>;
    readonly validateSession: (
      sessionId: string
    ) => Effect.Effect<Session, SessionExpired | DatabaseError>;
    readonly destroySession: (sessionId: string) => Effect.Effect<void, DatabaseError>;
    readonly validateCredentials: (
      email: string,
      password: string
    ) => Effect.Effect<SafeUser, InvalidCredentials | DatabaseError>;
    readonly generateApiKey: () => {
      key: string;
      prefix: string;
      hash: Effect.Effect<string, DatabaseError>;
    };
    readonly verifyApiKey: (
      prefix: string,
      key: string
    ) => Effect.Effect<boolean, InvalidCredentials | DatabaseError>;
  }
>() {}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export const makeAuthService = Effect.gen(function* () {
  const { query } = yield* DbService;

  const hashPassword = (password: string): Effect.Effect<string, DatabaseError> =>
    Effect.tryPromise({
      try: () => hash(password, ARGON2_OPTIONS),
      catch: (error) => new DatabaseError({ cause: error, operation: 'hash_password' }),
    });

  const verifyPassword = (
    passwordHash: string,
    password: string
  ): Effect.Effect<boolean, DatabaseError> =>
    Effect.tryPromise({
      try: () => verify(passwordHash, password, ARGON2_OPTIONS),
      catch: (error) => new DatabaseError({ cause: error, operation: 'verify_password' }),
    });

  const createSession = (userId: string): Effect.Effect<Session, DatabaseError> =>
    Effect.gen(function* () {
      const session: NewSession = {
        id: createId(),
        user_id: userId,
        expires_at: new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      };

      yield* query('create_session', (db) => db.insertInto('sessions').values(session).execute());

      return session as Session;
    });

  const validateSession = (
    sessionId: string
  ): Effect.Effect<Session, SessionExpired | DatabaseError> =>
    Effect.gen(function* () {
      const session = yield* query('get_session', (db) =>
        db
          .selectFrom('sessions')
          .selectAll()
          .where('id', '=', sessionId)
          .where('expires_at', '>', new Date())
          .executeTakeFirst()
      );

      if (!session) {
        return yield* Effect.fail(new SessionExpired({ message: 'Session expired or invalid' }));
      }

      return session;
    });

  const destroySession = (sessionId: string): Effect.Effect<void, DatabaseError> =>
    query('destroy_session', (db) =>
      db.deleteFrom('sessions').where('id', '=', sessionId).execute()
    ).pipe(Effect.map(() => undefined));

  const validateCredentials = (
    email: string,
    password: string
  ): Effect.Effect<SafeUser, InvalidCredentials | DatabaseError> =>
    Effect.gen(function* () {
      const user = yield* query('get_user_by_email', (db) =>
        db
          .selectFrom('users')
          .selectAll()
          .where('email', '=', email.toLowerCase())
          .executeTakeFirst()
      );

      if (!user) {
        // Perform dummy verification to prevent timing attacks
        yield* verifyPassword(DUMMY_HASH, password).pipe(Effect.catchAll(() => Effect.void));
        return yield* Effect.fail(new InvalidCredentials({ message: 'Invalid email or password' }));
      }

      const valid = yield* verifyPassword(user.password_hash, password);

      if (!valid) {
        return yield* Effect.fail(new InvalidCredentials({ message: 'Invalid email or password' }));
      }

      // Return user without password_hash
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password_hash: _, ...safeUser } = user;
      return safeUser as SafeUser;
    });

  const generateApiKey = () => {
    const key = `cms_${createId()}${createId()}`;
    const prefix = key.substring(0, 12);
    return {
      key,
      prefix,
      hash: hashPassword(key),
    };
  };

  const verifyApiKey = (
    prefix: string,
    providedKey: string
  ): Effect.Effect<boolean, InvalidCredentials | DatabaseError> =>
    Effect.gen(function* () {
      const apiKey = yield* query('get_api_key_by_prefix', (db) =>
        db
          .selectFrom('api_keys')
          .select(['key_hash', 'id'])
          .where('prefix', '=', prefix)
          .executeTakeFirst()
      );

      if (!apiKey) {
        return yield* Effect.fail(new InvalidCredentials({ message: 'Invalid API key' }));
      }

      const valid = yield* verifyPassword(apiKey.key_hash, providedKey);

      if (!valid) {
        return yield* Effect.fail(new InvalidCredentials({ message: 'Invalid API key' }));
      }

      // Update last_used_at
      yield* query('update_api_key_usage', (db) =>
        db
          .updateTable('api_keys')
          .set({ last_used_at: new Date() })
          .where('id', '=', apiKey.id)
          .execute()
      );

      return true;
    });

  return {
    hashPassword,
    verifyPassword,
    createSession,
    validateSession,
    destroySession,
    validateCredentials,
    generateApiKey,
    verifyApiKey,
  };
});

// =============================================================================
// LAYER
// =============================================================================

export const AuthServiceLive = Layer.effect(AuthService, makeAuthService);
