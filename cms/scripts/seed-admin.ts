#!/usr/bin/env bun
/**
 * @fileoverview Seed initial admin user
 * @see PRD Appendix 16.2 - ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 */

import { createId } from '@paralleldrive/cuid2';
import { Effect, Layer } from 'effect';

import { AuthService, AuthServiceLive } from '../src/services/auth.service';
import { DbService, DbServiceLive } from '../src/services/db.service';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgres://cms_user:cms_password@localhost:5432/ivokun_cms';
const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] ?? 'admin@ivokun.com';
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? 'changeme123';
const ADMIN_NAME = process.env['ADMIN_NAME'] ?? 'Administrator';

const program = Effect.gen(function* () {
  const { db, query } = yield* DbService;
  const { hashPassword } = yield* AuthService;

  // Check if admin already exists
  const existing = yield* query('check_admin', (db) =>
    db
      .selectFrom('users')
      .select('id')
      .where('email', '=', ADMIN_EMAIL.toLowerCase())
      .executeTakeFirst()
  );

  if (existing) {
    console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
    return;
  }

  // Hash password and create user
  const passwordHash = yield* hashPassword(ADMIN_PASSWORD);

  yield* query('create_admin', (db) =>
    db
      .insertInto('users')
      .values({
        id: createId(),
        email: ADMIN_EMAIL.toLowerCase(),
        password_hash: passwordHash,
        name: ADMIN_NAME,
      })
      .execute()
  );

  console.log(`Admin user created successfully!`);
  console.log(`  Email: ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`\n⚠️  Change the password after first login!`);
});

const MainLayer = AuthServiceLive.pipe(
  Layer.provideMerge(DbServiceLive(DATABASE_URL))
);

Effect.runPromise(program.pipe(Effect.provide(MainLayer), Effect.scoped))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed admin:', error);
    process.exit(1);
  });
