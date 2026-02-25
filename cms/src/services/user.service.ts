/**
 * @fileoverview User management service for admin operations
 */

import { hash } from '@node-rs/argon2';
import { createId } from '@paralleldrive/cuid2';
import { Context, Effect, Layer } from 'effect';

import { DatabaseError } from '../errors';
import type { NewUser, User } from '../types';
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
    ) => Effect.Effect<InviteResponse, DatabaseError>;
    readonly deleteUser: (id: string) => Effect.Effect<void, DatabaseError>;
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
  ): Effect.Effect<InviteResponse, DatabaseError> =>
    Effect.gen(function* () {
      // Generate a random 16-character password using createId (24 chars, we'll use it as-is)
      const initialPassword = createId().slice(0, 16);
      const passwordHash = yield* hashPassword(initialPassword);

      const newUser: NewUser = {
        id: createId(),
        email: email.toLowerCase(),
        password_hash: passwordHash,
        name,
      };

      const user = yield* query('create_user', (db) =>
        db.insertInto('users').values(newUser).returningAll().executeTakeFirstOrThrow()
      );

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        initialPassword,
        createdAt: user.created_at,
      };
    });

  const deleteUser = (id: string): Effect.Effect<void, DatabaseError> =>
    Effect.gen(function* () {
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
