// Smoke tests for the web (Astro) frontend.
//
// Unit tests: pure helpers in src/api/*.ts, no CMS required (CMS_API_URL /
// CMS_API_TOKEN need only be set to dummy values since cmsFetch validates
// presence before making a request).
//
// Integration: web/scripts/smoke.sh (invoked in CI) builds the site against a
// stub CMS API so full-page static generation is exercised end-to-end without
// needing a live CMS. A successful build that renders <main> proves SSG works
// against a CMS-shaped contract.
//
// Run: bun test web/ (from repo root) — requires no network.

import { describe, expect, it } from 'bun:test';

import { formatCategoryName } from './category';
import { formatReadTime, getImageUrl } from './article';
import { cmsFetch } from './cms';

describe('formatCategoryName', () => {
  it('lowercases names for data-filtering by default', () => {
    expect(formatCategoryName('Web Development')).toBe('web development');
    expect(formatCategoryName('Web-Development')).toBe('web-development');
  });

  it('uppercases when requested', () => {
    expect(formatCategoryName('notes', true)).toBe('NOTES');
  });

  it('handles single words and empty-ish input', () => {
    expect(formatCategoryName('Tech')).toBe('tech');
    expect(formatCategoryName('')).toBe('');
  });
});

describe('formatReadTime', () => {
  it('returns "Quick read" for null/undefined/zero', () => {
    expect(formatReadTime(null)).toBe('Quick read');
    expect(formatReadTime(undefined)).toBe('Quick read');
    expect(formatReadTime(0)).toBe('Quick read');
  });

  it('formats minute counts', () => {
    expect(formatReadTime(7)).toBe('7 min read');
  });
});

describe('getImageUrl', () => {
  const media = {
    id: 'm1',
    urls: {
      original: 'https://media.ivokun.com/a/original.webp',
      thumbnail: 'https://media.ivokun.com/a/thumb.webp',
      small: 'https://media.ivokun.com/a/small.webp',
      large: 'https://media.ivokun.com/a/large.webp',
    },
  };

  it('resolves the requested size', () => {
    expect(getImageUrl(media, 'thumbnail')).toBe(media.urls.thumbnail);
    expect(getImageUrl(media, 'large')).toBe(media.urls.large);
    expect(getImageUrl(media, 'original')).toBe(media.urls.original);
  });

  it('is null-safe for missing media or urls', () => {
    expect(getImageUrl(null, 'large')).toBeNull();
    expect(getImageUrl(undefined, 'large')).toBeNull();
    expect(getImageUrl({ ...media, urls: null }, 'large')).toBeNull();
  });
});

describe('cmsFetch', () => {
  // cmsFetch captures import.meta.env at module-eval time, so env cases run
  // in a spawned child bun process with a clean environment (dynamic import
  // with query strings hangs on bun 1.1.38, hence not used here).
  it('throws a descriptive error when CMS_API_URL is missing', async () => {
    const proc = Bun.spawnSync(['bun', `${import.meta.dir}/../../scripts/cms-fetch-env.ts`, 'missing-url']);
    const output = proc.stdout.toString() + proc.stderr.toString();
    expect(output).toContain('OK:');
  });

  it('throws a descriptive error when the CMS is unreachable', async () => {
    const proc = Bun.spawnSync(['bun', `${import.meta.dir}/../../scripts/cms-fetch-env.ts`, 'unreachable']);
    const output = proc.stdout.toString() + proc.stderr.toString();
    expect(output).toContain('OK:');
  });
});
