#!/usr/bin/env bun
/**
 * @fileoverview Build script for CMS binary compilation
 * @see PRD Section 12.1 - Build Artifacts (Binary < 50MB, SPA < 2MB)
 *
 * This script:
 * 1. Builds the SPA (Vite)
 * 2. Compiles the server with embedded assets into a single binary
 */

import { $ } from 'bun';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT_DIR = resolve(import.meta.dir, '..');
const SRC_DIR = join(ROOT_DIR, 'src');
const PUBLIC_DIR = join(ROOT_DIR, 'public');
const DIST_DIR = join(ROOT_DIR, 'dist');

// Target platforms for cross-compilation
const TARGETS = {
  'linux-x64': 'bun-linux-x64',
  'linux-arm64': 'bun-linux-arm64',
  'darwin-arm64': 'bun-darwin-arm64',
  'darwin-x64': 'bun-darwin-x64',
} as const;

type Platform = keyof typeof TARGETS;

interface BuildOptions {
  platform?: Platform;
  minify?: boolean;
  sourcemap?: boolean;
  outfile?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function buildSPA(): Promise<void> {
  console.log('\n[1/3] Building SPA with Vite...');

  // Clean previous build
  await $`rm -rf ${PUBLIC_DIR}/admin`;

  // Build SPA
  const result = await $`bun run build:spa`.cwd(ROOT_DIR).quiet();

  if (result.exitCode !== 0) {
    throw new Error(`SPA build failed: ${result.stderr.toString()}`);
  }

  // Verify build output
  const indexPath = join(PUBLIC_DIR, 'admin', 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error('SPA build did not produce index.html');
  }

  // Calculate SPA size
  const assetsDir = join(PUBLIC_DIR, 'admin', 'assets');
  let totalSize = statSync(indexPath).size;

  if (existsSync(assetsDir)) {
    const files = await $`find ${assetsDir} -type f`.quiet();
    for (const file of files.stdout.toString().trim().split('\n')) {
      if (file) totalSize += statSync(file).size;
    }
  }

  console.log(`   SPA built successfully (${formatBytes(totalSize)})`);

  // Check against PRD target (< 2MB)
  if (totalSize > 2 * 1024 * 1024) {
    console.warn(`   WARNING: SPA size (${formatBytes(totalSize)}) exceeds PRD target of 2MB`);
  }
}

async function compileBinary(options: BuildOptions = {}): Promise<string> {
  const {
    platform,
    minify = true,
    sourcemap = true,
    outfile = platform ? `cms-${platform}` : 'cms',
  } = options;

  console.log(`\n[2/3] Compiling binary${platform ? ` for ${platform}` : ''}...`);

  // Ensure dist directory exists
  if (!existsSync(DIST_DIR)) {
    mkdirSync(DIST_DIR, { recursive: true });
  }

  const outputPath = join(DIST_DIR, outfile);
  const serverEntry = join(SRC_DIR, 'server.ts');

  // Build command args
  const args: string[] = [
    'bun',
    'build',
    serverEntry,
    '--compile',
    '--outfile',
    outputPath,
    // External dependencies that have native bindings
    // These must be installed on the target system
    '--external',
    '@effect/cluster',
    '--external',
    'sharp',
  ];

  // Add target if cross-compiling
  if (platform) {
    args.push('--target', TARGETS[platform]);
  }

  // Add optimization flags
  if (minify) {
    args.push('--minify');
  }

  if (sourcemap) {
    args.push('--sourcemap');
  }

  // Execute build
  const result = await $`${args}`.cwd(ROOT_DIR).quiet();

  if (result.exitCode !== 0) {
    throw new Error(`Binary compilation failed: ${result.stderr.toString()}`);
  }

  // Get binary size
  const binarySize = statSync(outputPath).size;
  console.log(`   Binary compiled: ${outputPath} (${formatBytes(binarySize)})`);

  // Check against PRD target (< 50MB)
  if (binarySize > 50 * 1024 * 1024) {
    console.warn(`   WARNING: Binary size (${formatBytes(binarySize)}) exceeds PRD target of 50MB`);
  }

  return outputPath;
}

async function copyAssets(): Promise<void> {
  console.log('\n[3/3] Copying assets to dist...');

  // Copy public directory (contains SPA) to dist
  await $`cp -r ${PUBLIC_DIR} ${DIST_DIR}/public`.quiet();

  // Copy migrations for dbmate
  const migrationsDir = join(ROOT_DIR, 'db', 'migrations');
  const distMigrationsDir = join(DIST_DIR, 'db', 'migrations');

  if (!existsSync(join(DIST_DIR, 'db'))) {
    mkdirSync(join(DIST_DIR, 'db'), { recursive: true });
  }

  await $`cp -r ${migrationsDir} ${distMigrationsDir}`.quiet();

  console.log('   Assets copied to dist/');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const platform = args.find((a) => Object.keys(TARGETS).includes(a)) as Platform | undefined;
  const allPlatforms = args.includes('--all');

  console.log('='.repeat(60));
  console.log('CMS Binary Build');
  console.log('='.repeat(60));
  console.log(`Platform: ${allPlatforms ? 'ALL' : platform ?? 'current'}`);
  console.log(`Build directory: ${ROOT_DIR}`);
  console.log(`Output directory: ${DIST_DIR}`);

  const startTime = Date.now();

  try {
    // Step 1: Build SPA
    await buildSPA();

    // Step 2: Compile binary(ies)
    if (allPlatforms) {
      for (const p of Object.keys(TARGETS) as Platform[]) {
        await compileBinary({ platform: p });
      }
    } else {
      await compileBinary({ platform });
    }

    // Step 3: Copy assets
    await copyAssets();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log(`BUILD SUCCESSFUL (${elapsed}s)`);
    console.log('='.repeat(60));
    console.log('\nTo run the binary:');
    console.log(`  cd ${DIST_DIR}`);
    console.log('  DATABASE_URL=... ./cms');
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('BUILD FAILED');
    console.error('='.repeat(60));
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
