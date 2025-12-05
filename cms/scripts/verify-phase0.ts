#!/usr/bin/env bun
/**
 * Phase 0 Verification Script
 * Checks all success criteria from the phase plan
 */

import { existsSync } from 'node:fs';

import { Pool } from 'pg';

const checks: Array<{ name: string; check: () => Promise<boolean> | boolean }> = [];

function addCheck(name: string, check: () => Promise<boolean> | boolean) {
  checks.push({ name, check });
}

// File existence checks
addCheck('package.json exists', () => existsSync('package.json'));
addCheck('tsconfig.json exists', () => existsSync('tsconfig.json'));
addCheck('.env exists', () => existsSync('.env'));
addCheck('.env.example exists', () => existsSync('.env.example'));
addCheck('src/types.ts exists', () => existsSync('src/types.ts'));
addCheck('src/errors.ts exists', () => existsSync('src/errors.ts'));
addCheck('db/migrations/ exists', () => existsSync('db/migrations'));

// Database checks
addCheck('Database connection works', async () => {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
});

addCheck('All 8 tables exist', async () => {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  try {
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const tables = result.rows.map((r: { table_name: string }) => r.table_name);
    const required = [
      'api_keys',
      'categories',
      'galleries',
      'home',
      'media',
      'posts',
      'sessions',
      'users',
    ];
    return required.every((t) => tables.includes(t));
  } catch {
    return false;
  } finally {
    await pool.end();
  }
});

addCheck('Home singleton exists', async () => {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  try {
    const result = await pool.query("SELECT id FROM home WHERE id = 'singleton'");
    return result.rowCount === 1;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
});

// Run all checks
async function main() {
  console.log('Phase 0 Verification\n' + '='.repeat(50) + '\n');

  let passed = 0;
  let failed = 0;

  for (const { name, check } of checks) {
    try {
      const result = await check();
      if (result) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${name} (error: ${error})`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\n⚠️  Phase 0 is NOT complete. Fix the failing checks above.');
    process.exit(1);
  } else {
    console.log('\n🎉 Phase 0 is complete! Proceed to Phase 1.');
    process.exit(0);
  }
}

main();
