#!/usr/bin/env bun
/**
 * @fileoverview Seed 5 dummy articles with featured images
 */

import { createId } from '@paralleldrive/cuid2';
import { Effect, Layer } from 'effect';

import { DbService, DbServiceLive } from '../src/services/db.service';
import { PostService, PostServiceLive } from '../src/services/post.service';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgres://cms_user:cms_password@localhost:5432/ivokun_cms';

// Existing media ID that we know works
const FEATURED_IMAGE_ID = 'h6lr4k6uspe5mtepco0jtlqr';

import type { NewPost, TipTapDocument } from '../src/types';

const dummyArticles: Array<{
  title: string;
  slug: string;
  excerpt: string;
  content: TipTapDocument;
  locale: 'en' | 'id';
  status: 'draft' | 'published';
  read_time_minute: number;
}> = [
  {
    title: 'Getting Started with Brutalist Web Design',
    slug: 'getting-started-brutalist-web-design',
    excerpt: 'A comprehensive guide to embracing raw, unpolished aesthetics in modern web development. Learn how bold typography and stark contrasts can make your website stand out.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              text: 'Brutalist web design rejects the polished, corporate look of modern websites. Instead, it embraces raw aesthetics, bold typography, and stark contrasts.',
              type: 'text',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ text: 'Why Brutalism?', type: 'text' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              text: 'In a world of cookie-cutter templates, brutalism offers authenticity. It strips away unnecessary decoration and focuses on content.',
              type: 'text',
            },
          ],
        },
      ],
    },
    locale: 'en',
    status: 'published',
    read_time_minute: 5,
  },
  {
    title: 'The Art of Minimalist Photography',
    slug: 'art-of-minimalist-photography',
    excerpt: 'Discover how less can be more in photography. This article explores techniques for capturing powerful images through simplicity and careful composition.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              text: 'Minimalist photography is about stripping away the unnecessary to reveal the essence of a subject. It requires patience, observation, and restraint.',
              type: 'text',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ text: 'Key Principles', type: 'text' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              text: 'Focus on negative space, clean lines, and a limited color palette. The goal is to create images that breathe and draw the viewer\'s eye to what matters most.',
              type: 'text',
            },
          ],
        },
      ],
    },
    locale: 'en',
    status: 'published',
    read_time_minute: 8,
  },
  {
    title: 'Building High-Performance APIs with Effect TS',
    slug: 'building-high-performance-apis-effect-ts',
    excerpt: 'Learn how to leverage Effect TS for building robust, type-safe, and composable APIs. Explore error handling, dependency injection, and structured concurrency.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              text: 'Effect TS brings functional programming patterns to TypeScript, making it easier to write predictable and testable code.',
              type: 'text',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ text: 'Why Effect TS?', type: 'text' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              text: 'Effect TS provides structured concurrency, composable error handling, and type-safe dependency injection. It changes how we think about async operations.',
              type: 'text',
            },
          ],
        },
      ],
    },
    locale: 'en',
    status: 'published',
    read_time_minute: 12,
  },
  {
    title: 'Panduan Memulai Desain Web Brutalis',
    slug: 'panduan-memulai-desain-web-brutalis',
    excerpt: 'Panduan lengkap untuk memeluk estetika mentah dan tidak dipoles dalam pengembangan web modern. Pelajari bagaimana tipografi berani dan kontras tajam dapat membuat website Anda menonjol.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              text: 'Desain web brutalist menolak tampilan yang dipoles dan korporat dari website modern. Sebaliknya, ia merangkul estetika mentah, tipografi berani, dan kontras tajam.',
              type: 'text',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ text: 'Mengapa Brutalisme?', type: 'text' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              text: 'Dalam dunia template yang seragam, brutalism menawarkan keaslian. Ia menghilangkan dekorasi yang tidak perlu dan fokus pada konten.',
              type: 'text',
            },
          ],
        },
      ],
    },
    locale: 'id',
    status: 'published',
    read_time_minute: 6,
  },
  {
    title: 'Modern Database Patterns with Kysely',
    slug: 'modern-database-patterns-kysely',
    excerpt: 'Explore type-safe SQL query building with Kysely. Learn how to construct complex queries while maintaining full TypeScript type safety and IntelliSense support.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              text: 'Kysely is a type-safe SQL query builder for TypeScript. It provides a fluent API for constructing queries while maintaining complete type safety.',
              type: 'text',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ text: 'Type-Safe Queries', type: 'text' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              text: 'With Kysely, your queries are validated at compile time. Autocomplete shows available columns, and TypeScript catches errors before runtime.',
              type: 'text',
            },
          ],
        },
      ],
    },
    locale: 'en',
    status: 'published',
    read_time_minute: 10,
  },
];

const program = Effect.gen(function* () {
  const postService = yield* PostService;

  console.log('Creating 5 dummy articles with featured images...\n');

  for (const article of dummyArticles) {
    try {
      const result = yield* postService.create({
        ...article,
        featured_image: FEATURED_IMAGE_ID,
        category_id: null,
        published_at: new Date(),
        status: 'published',
      });

      console.log(`✅ Created: ${result.title}`);
      console.log(`   Slug: ${result.slug}`);
      console.log(`   Locale: ${result.locale}`);
      console.log(`   Featured Image: ${result.featured_image}\n`);
    } catch (error: any) {
      // If slug conflict, skip
      if (error && error._tag === 'SlugConflict') {
        console.log(`⚠️  Skipped (slug exists): ${article.slug}\n`);
      } else {
        console.error(`❌ Failed to create ${article.title}:`, error);
      }
    }
  }

  console.log('\n✨ Done! Check the articles at http://localhost:3000/api/posts');
});

const MainLayer = PostServiceLive.pipe(
  Layer.provideMerge(DbServiceLive({ connectionString: DATABASE_URL }))
);

Effect.runPromise(program.pipe(Effect.provide(MainLayer), Effect.scoped))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed articles:', error);
    process.exit(1);
  });
