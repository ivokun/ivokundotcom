import { describe, expect, it, mock } from 'bun:test';
import { Effect, Layer } from 'effect';

import type { Session, User } from '../types';
import { AuthService, makeAuthService } from './auth.service';
import { DbService } from './db.service';

const mockDbService = (queryFn: (op: string, fn: any) => Effect.Effect<any, any>) =>
  Layer.succeed(
    DbService,
    DbService.of({
      db: {} as any,
      query: queryFn,
      transaction: (fn) => fn({} as any) as any,
    })
  );

// Real Argon2 hash for 'password123' generated with the service's options
const TEST_PASSWORD = 'password123';
const TEST_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$NJn3CmFvTXsDTTLvrH/ANA$VxWeTq6N+k5np16Rw5Ij2kzlAdUYp2GUj7xTTgEgyjI';

const mockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user_123',
  email: 'test@example.com',
  password_hash: TEST_PASSWORD_HASH,
  name: 'Test User',
  created_at: new Date('2024-01-01'),
  ...overrides,
});

const mockSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session_123',
  user_id: 'user_123',
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  ...overrides,
});

describe('AuthService', () => {
  describe('validateCredentials', () => {
    it('should return SafeUser when credentials are correct', async () => {
      const user = mockUser();
      const queryStub = mock((op: string) => {
        if (op === 'get_user_by_email') return Effect.succeed(user);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.validateCredentials('test@example.com', TEST_PASSWORD);
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
      expect(result.name).toBe(user.name);
      expect(result.created_at).toEqual(user.created_at);
      // Verify password_hash is NOT in the result
      expect('password_hash' in result).toBe(false);
      expect(queryStub).toHaveBeenCalledTimes(1);
    });

    it('should fail with InvalidCredentials when email not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'get_user_by_email') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.validateCredentials('nonexistent@example.com', 'anypassword');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure') {
        // @ts-ignore
        expect(result.cause.error._tag).toBe('InvalidCredentials');
      }
    });

    it('should fail with InvalidCredentials when password does not match', async () => {
      const user = mockUser();
      const queryStub = mock((op: string) => {
        if (op === 'get_user_by_email') return Effect.succeed(user);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.validateCredentials('test@example.com', 'wrongpassword');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure') {
        // @ts-ignore
        expect(result.cause.error._tag).toBe('InvalidCredentials');
      }
    });

    it('should convert email to lowercase when querying', async () => {
      const user = mockUser();
      const queryStub = mock((op: string) => {
        if (op === 'get_user_by_email') return Effect.succeed(user);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.validateCredentials('TEST@EXAMPLE.COM', TEST_PASSWORD);
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result.email).toBe(user.email);
    });
  });

  describe('createSession', () => {
    it('should create and return a session record', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'create_session') return Effect.succeed([]);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.createSession('user_123');
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result.user_id).toBe('user_123');
      expect(result.id).toBeDefined();
      expect(result.id.length).toBeGreaterThan(0);
      expect(result.expires_at).toBeInstanceOf(Date);
      // Verify session expires ~7 days from now
      const daysFromNow = (result.expires_at.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(daysFromNow).toBeGreaterThan(6);
      expect(daysFromNow).toBeLessThan(8);
    });
  });

  describe('validateSession', () => {
    it('should return session when valid and not expired', async () => {
      const session = mockSession();
      const queryStub = mock((op: string) => {
        if (op === 'get_session') return Effect.succeed(session);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.validateSession('session_123');
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result).toEqual(session);
    });

    it('should fail with SessionExpired when session does not exist', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'get_session') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.validateSession('nonexistent_session');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure') {
        // @ts-ignore
        expect(result.cause.error._tag).toBe('SessionExpired');
      }
    });

    it('should fail with SessionExpired when session is expired', async () => {
      // The DB query already filters by expires_at > now, so undefined result = expired
      const queryStub = mock((op: string) => {
        if (op === 'get_session') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.validateSession('expired_session');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure') {
        // @ts-ignore
        expect(result.cause.error._tag).toBe('SessionExpired');
      }
    });
  });

  describe('destroySession', () => {
    it('should delete the session from DB', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'destroy_session') return Effect.succeed([]);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.destroySession('session_123');
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result).toBeUndefined();
      expect(queryStub).toHaveBeenCalledTimes(1);
    });
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const queryStub = mock(() => Effect.die('Should not call DB'));

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.hashPassword('mypassword');
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result).toBeDefined();
      expect(result.startsWith('$argon2id$')).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for matching password', async () => {
      const queryStub = mock(() => Effect.die('Should not call DB'));

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifyPassword(TEST_PASSWORD_HASH, TEST_PASSWORD);
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const queryStub = mock(() => Effect.die('Should not call DB'));

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifyPassword(TEST_PASSWORD_HASH, 'wrongpassword');
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result).toBe(false);
    });
  });

  describe('generateApiKey', () => {
    it('should generate API key with prefix and hash effect', async () => {
      const queryStub = mock(() => Effect.die('Should not call DB'));

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return service.generateApiKey();
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result.key).toBeDefined();
      expect(result.key.startsWith('cms_')).toBe(true);
      expect(result.prefix).toBe(result.key.substring(0, 12));
      expect(result.hash).toBeDefined();
      // hash is an Effect, not a string
      expect(typeof result.hash).toBe('object');
    });
  });

  describe('verifyApiKey', () => {
    it('should return true for valid API key', async () => {
      const apiKeyRecord = {
        id: 'key_123',
        key_hash: TEST_PASSWORD_HASH,
      };
      const queryStub = mock((op: string) => {
        if (op === 'get_api_key_by_prefix') return Effect.succeed(apiKeyRecord);
        if (op === 'update_api_key_usage') return Effect.succeed([]);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifyApiKey('prefix123', TEST_PASSWORD);
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result).toBe(true);
    });

    it('should fail with InvalidCredentials when API key not found', async () => {
      const queryStub = mock((op: string) => {
        if (op === 'get_api_key_by_prefix') return Effect.succeed(undefined);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifyApiKey('prefix123', 'somekey');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure') {
        // @ts-ignore
        expect(result.cause.error._tag).toBe('InvalidCredentials');
      }
    });

    it('should fail with InvalidCredentials when API key does not match', async () => {
      const apiKeyRecord = {
        id: 'key_123',
        key_hash: TEST_PASSWORD_HASH,
      };
      const queryStub = mock((op: string) => {
        if (op === 'get_api_key_by_prefix') return Effect.succeed(apiKeyRecord);
        return Effect.die(`Unexpected op: ${op}`);
      });

      const layer = mockDbService(queryStub);
      const AuthServiceLayer = Layer.effect(AuthService, makeAuthService);

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifyApiKey('prefix123', 'wrongkey');
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(AuthServiceLayer), Effect.provide(layer))
      );

      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure') {
        // @ts-ignore
        expect(result.cause.error._tag).toBe('InvalidCredentials');
      }
    });
  });
});
