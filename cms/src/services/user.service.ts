/**
 * @fileoverview User management service for admin operations
 */

import { hash } from '@node-rs/argon2';
import { createId } from '@paralleldrive/cuid2';
import { randomBytes } from 'crypto';
import { Context, Effect, Layer } from 'effect';

import { DatabaseError, DuplicateEmail, NotFound } from '../errors';
import type { NewUser } from '../types';
import { DbService } from './db.service';

// =============================================================================
// CONSTANTS
// =============================================================================

// Argon2 configuration (OWASP recommended) - same as auth.service.ts
const ARGON2_OPTIONS = {
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
};

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface InviteResponse {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly initialPassword: string;
  readonly createdAt: Date;
}

export interface SafeUser {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly created_at: Date;
}

export class UserService extends Context.Tag('UserService')<
  UserService,
  {
    readonly findAll: () => Effect.Effect<ReadonlyArray<SafeUser>, DatabaseError>;
    readonly invite: (
      name: string,
      email: string
    ) => Effect.Effect<InviteResponse, DatabaseError | DuplicateEmail>;
    readonly deleteUser: (id: string) => Effect.Effect<void, DatabaseError | NotFound>;
  }
>() {}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export const makeUserService = Effect.gen(function* () {
  const { query } = yield* DbService;

  const hashPassword = (password: string): Effect.Effect<string, DatabaseError> =>
    Effect.tryPromise({
      try: () => hash(password, ARGON2_OPTIONS),
      catch: (error) => new DatabaseError({ cause: error, operation: 'hash_password' }),
    });

  const generatePassword = (): string => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const bytes = randomBytes(16);
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += charset[bytes[i]! % charset.length];
    }
    return password;
  };

  const findAll = (): Effect.Effect<ReadonlyArray<SafeUser>, DatabaseError> =>
    Effect.gen(function* () {
      const users = yield* query('find_all_users', (db) =>
        db
          .selectFrom('users')
          .select(['id', 'email', 'name', 'created_at'])
          .orderBy('created_at', 'desc')
          .execute()
      );
      return users;
    });

  const invite = (
    name: string,
    email: string
  ): Effect.Effect<InviteResponse, DatabaseError | DuplicateEmail> =>
    Effect.gen(function* () {
      // Check for existing user with this email
      const existing = yield* query('check_user_email', (db) =>
        db.selectFrom('users').select('id').where('email', '=', email.toLowerCase()).executeTakeFirst()
      );
      if (existing) {
        return yield* Effect.fail(new DuplicateEmail({ email }));
      }

      // Generate a secure random 16-character password
      const initialPassword = generatePassword();
      const passwordHash = yield* hashPassword(initialPassword);

      const newUser: NewUser = {
        id: createId(),
        email: email.toLowerCase(),
        password_hash: passwordHash,
        name,
      };

      const user = yield* query('create_user', (db) =>
        db.insertInto('users').values(newUser).returning(['id', 'email', 'name', 'created_at']).executeTakeFirstOrThrow()
      );

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        initialPassword,
        createdAt: user.created_at,
      };
    });

  const deleteUser = (id: string): Effect.Effect<void, DatabaseError | NotFound> =>
    Effect.gen(function* () {
      // Check if user exists first
      const user = yield* query('check_user_exists', (db) =>
        db.selectFrom('users').select('id').where('id', '=', id).executeTakeFirst()
      );
      if (!user) {
        return yield* Effect.fail(new NotFound({ resource: 'User', id }));
      }

      // Delete all sessions for this user first
      yield* query('delete_user_sessions', (db) =>
        db.deleteFrom('sessions').where('user_id', '=', id).execute()
      );

      // Delete the user
      yield* query('delete_user', (db) =>
        db.deleteFrom('users').where('id', '=', id).execute()
      );
    });

  return {
    findAll,
    invite,
    deleteUser,
  };
});

// =============================================================================
// LAYER
// =============================================================================

export const UserServiceLive = Layer.effect(UserService, makeUserService);
