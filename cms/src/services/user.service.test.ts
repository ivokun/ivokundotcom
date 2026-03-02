import { describe, expect, it, mock } from 'bun:test';
import { Effect, Layer } from 'effect';

import type { SafeUser } from '../types';
import { DbService } from './db.service';
import { makeUserService, UserService } from './user.service';

const mockDbService = (queryFn: (op: string, fn: any) => Effect.Effect<any, any>) =>
  Layer.succeed(
    DbService,
    DbService.of({
      db: {} as any,
      query: queryFn,
      transaction: (fn) => fn({} as any) as any,
    })
  );

const mockSafeUser = (overrides: Partial<SafeUser> = {}): SafeUser => ({
  id: 'user_123',
  email: 'test@example.com',
  name: 'Test User',
  created_at: new Date('2024-01-01'),
  ...overrides,
});

describe('UserService', () => {
  describe('findAll', () => {
    it('should return list of users without password_hash', async () => {
      const users = [
        mockSafeUser({ id: 'user_1', email: 'user1@example.com', name: 'User One' }),
        mockSafeUser({ id: 'user_2', email: 'user2@example.com', name: 'User Two' }),
      ];
      const queryStub = mock((op: string) => {
        if (op === 'find_all_users') return Effect.succeed(users);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const UserServiceLayer = Layer.effect(UserService, makeUserService);

      const program = Effect.gen(function* () {
        const service = yield* UserService;
        return yield* service.findAll();
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(UserServiceLayer), Effect.provide(layer))
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('user_1');
      expect(result[0]?.email).toBe('user1@example.com');
      expect(result[1]?.id).toBe('user_2');
      // Verify password_hash is NOT in any result
      result.forEach((user) => {
        expect('password_hash' in user).toBe(false);
      });
    });

    it('should return empty array when no users exist', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'find_all_users') return Effect.succeed([]);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const UserServiceLayer = Layer.effect(UserService, makeUserService);

      const program = Effect.gen(function* () {
        const service = yield* UserService;
        return yield* service.findAll();
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(UserServiceLayer), Effect.provide(layer))
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('invite', () => {
    it('should create user with hashed password and return InviteResponse', async () => {
      const createdUser = {
        id: 'new_user_123',
        email: 'newuser@example.com',
        name: 'New User',
        created_at: new Date('2024-01-15'),
      };
      const queryStub = mock((op: string) => {
        if (op === 'check_user_email') return Effect.succeed(undefined);
        if (op === 'create_user') return Effect.succeed(createdUser);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const UserServiceLayer = Layer.effect(UserService, makeUserService);

      const program = Effect.gen(function* () {
        const service = yield* UserService;
        return yield* service.invite('New User', 'newuser@example.com');
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(UserServiceLayer), Effect.provide(layer))
      );

      expect(result.id).toBe('new_user_123');
      expect(result.email).toBe('newuser@example.com');
      expect(result.name).toBe('New User');
      expect(result.createdAt).toEqual(createdUser.created_at);
      // Verify initialPassword is returned (16 characters)
      expect(result.initialPassword).toBeDefined();
      expect(result.initialPassword.length).toBe(16);
      // Verify password is not the hash (it's the plain text)
      expect(result.initialPassword).not.toContain('$argon2id');
      expect(queryStub).toHaveBeenCalledTimes(2);
    });

    it('should convert email to lowercase', async () => {
      const createdUser = {
        id: 'new_user_123',
        email: 'lowercase@example.com',
        name: 'New User',
        created_at: new Date('2024-01-15'),
      };
      const queryStub = mock((op: string, fn: any) => {
        if (op === 'check_user_email') return Effect.succeed(undefined);
        if (op === 'create_user') return Effect.succeed(createdUser);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const UserServiceLayer = Layer.effect(UserService, makeUserService);

      const program = Effect.gen(function* () {
        const service = yield* UserService;
        return yield* service.invite('New User', 'UPPERCASE@EXAMPLE.COM');
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(UserServiceLayer), Effect.provide(layer))
      );

      expect(result.email).toBe('lowercase@example.com');
    });

    it('should fail with DuplicateEmail when email already exists', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'check_user_email') return Effect.succeed({ id: 'existing_user' });
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const UserServiceLayer = Layer.effect(UserService, makeUserService);

      const program = Effect.gen(function* () {
        const service = yield* UserService;
        return yield* service.invite('New User', 'existing@example.com');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(UserServiceLayer), Effect.provide(layer))
      );

      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure') {
        // @ts-ignore
        expect(result.cause.error._tag).toBe('DuplicateEmail');
      }
    });

    it('should generate different passwords for different users', async () => {
      const createdUser1 = {
        id: 'user_1',
        email: 'user1@example.com',
        name: 'User One',
        created_at: new Date(),
      };
      const createdUser2 = {
        id: 'user_2',
        email: 'user2@example.com',
        name: 'User Two',
        created_at: new Date(),
      };

      let callCount = 0;
      const queryStub = mock((op: string) => {
        if (op === 'check_user_email') return Effect.succeed(undefined);
        if (op === 'create_user') {
          callCount++;
          return Effect.succeed(callCount === 1 ? createdUser1 : createdUser2);
        }
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const UserServiceLayer = Layer.effect(UserService, makeUserService);

      const program1 = Effect.gen(function* () {
        const service = yield* UserService;
        return yield* service.invite('User One', 'user1@example.com');
      });

      const program2 = Effect.gen(function* () {
        const service = yield* UserService;
        return yield* service.invite('User Two', 'user2@example.com');
      });

      const result1 = await Effect.runPromise(
        program1.pipe(Effect.provide(UserServiceLayer), Effect.provide(layer))
      );

      // Need a fresh layer for second call since queryStub is shared
      const result2 = await Effect.runPromise(
        program2.pipe(Effect.provide(UserServiceLayer), Effect.provide(layer))
      );

      expect(result1.initialPassword).not.toBe(result2.initialPassword);
    });
  });

  describe('deleteUser', () => {
    it('should delete user and their sessions successfully', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'check_user_exists') return Effect.succeed({ id: 'user_123' });
        if (op === 'delete_user_sessions') return Effect.succeed([]);
        if (op === 'delete_user') return Effect.succeed([]);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const UserServiceLayer = Layer.effect(UserService, makeUserService);

      const program = Effect.gen(function* () {
        const service = yield* UserService;
        return yield* service.deleteUser('user_123');
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(UserServiceLayer), Effect.provide(layer))
      );

      expect(result).toBeUndefined();
      expect(queryStub).toHaveBeenCalledTimes(3);
    });

    it('should fail with NotFound when user does not exist', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'check_user_exists') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const UserServiceLayer = Layer.effect(UserService, makeUserService);

      const program = Effect.gen(function* () {
        const service = yield* UserService;
        return yield* service.deleteUser('nonexistent_user');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(UserServiceLayer), Effect.provide(layer))
      );

      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure') {
        // @ts-ignore
        expect(result.cause.error._tag).toBe('NotFound');
      }
    });

    it('should delete sessions before deleting user', async () => {
      const operations: string[] = [];
      const queryStub = mock((op: string) => {
        operations.push(op);
        if (op === 'check_user_exists') return Effect.succeed({ id: 'user_123' });
        if (op === 'delete_user_sessions') return Effect.succeed([]);
        if (op === 'delete_user') return Effect.succeed([]);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const UserServiceLayer = Layer.effect(UserService, makeUserService);

      const program = Effect.gen(function* () {
        const service = yield* UserService;
        return yield* service.deleteUser('user_123');
      });

      await Effect.runPromise(
        program.pipe(Effect.provide(UserServiceLayer), Effect.provide(layer))
      );

      // Verify order of operations
      expect(operations).toEqual([
        'check_user_exists',
        'delete_user_sessions',
        'delete_user',
      ]);
    });
  });
});
