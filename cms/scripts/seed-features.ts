#!/usr/bin/env bun
/**
 * @fileoverview Seed 10 examples of each CMS feature
 * Creates: Categories, Posts, Galleries, and API Keys
 */

import { createId } from '@paralleldrive/cuid2';
import { Effect, Layer } from 'effect';
import { sql } from 'kysely';

import { AuthService, AuthServiceLive } from '../src/services/auth.service';
import { CategoryService, CategoryServiceLive } from '../src/services/category.service';
import { DbService, DbServiceLive } from '../src/services/db.service';
import { PostService, PostServiceLive } from '../src/services/post.service';
import type { TipTapDocument } from '../src/types';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgres://cms_user:cms_password@localhost:5432/ivokun_cms';

// =============================================================================
// SAMPLE DATA
// =============================================================================

const categoriesData = [
  { name: 'Technology', slug: 'technology', description: 'Latest tech news, reviews, and insights' },
  { name: 'Photography', slug: 'photography', description: 'Visual stories and photography techniques' },
  { name: 'Travel', slug: 'travel', description: 'Adventures and travel guides around the world' },
  { name: 'Design', slug: 'design', description: 'UI/UX, graphic design, and creative inspiration' },
  { name: 'Programming', slug: 'programming', description: 'Code tutorials, patterns, and best practices' },
  { name: 'Lifestyle', slug: 'lifestyle', description: 'Health, wellness, and daily life tips' },
  { name: 'Food', slug: 'food', description: 'Recipes, restaurant reviews, and culinary adventures' },
  { name: 'Music', slug: 'music', description: 'Album reviews, artist spotlights, and music theory' },
  { name: 'Business', slug: 'business', description: 'Entrepreneurship, startups, and career advice' },
  { name: 'Science', slug: 'science', description: 'Discoveries, research, and scientific breakthroughs' },
];

const postsData: Array<{
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
    excerpt:
      'A comprehensive guide to embracing raw, unpolished aesthetics in modern web development. Learn how bold typography and stark contrasts can make your website stand out.',
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
    excerpt:
      'Discover how less can be more in photography. This article explores techniques for capturing powerful images through simplicity and careful composition.',
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
              text: "Focus on negative space, clean lines, and a limited color palette. The goal is to create images that breathe and draw the viewer's eye to what matters most.",
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
    excerpt:
      'Learn how to leverage Effect TS for building robust, type-safe, and composable APIs. Explore error handling, dependency injection, and structured concurrency.',
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
    excerpt:
      'Panduan lengkap untuk memeluk estetika mentah dan tidak dipoles dalam pengembangan web modern. Pelajari bagaimana tipografi berani dan kontras tajam dapat membuat website Anda menonjol.',
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
    excerpt:
      'Explore type-safe SQL query building with Kysely. Learn how to construct complex queries while maintaining full TypeScript type safety and IntelliSense support.',
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
  {
    title: 'Travel Photography: Capturing the Soul of a Place',
    slug: 'travel-photography-capturing-soul',
    excerpt:
      'How to go beyond tourist snapshots and create meaningful travel photography that tells a story and captures the essence of your destinations.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              text: 'Great travel photography requires more than just pointing your camera at landmarks. It demands understanding of culture, light, and human connection.',
              type: 'text',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ text: 'Research Before You Go', type: 'text' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              text: 'Understanding local customs, best shooting times, and hidden gems will elevate your travel photography from ordinary to extraordinary.',
              type: 'text',
            },
          ],
        },
      ],
    },
    locale: 'en',
    status: 'published',
    read_time_minute: 7,
  },
  {
    title: 'The Future of Web Development in 2025',
    slug: 'future-of-web-development-2025',
    excerpt:
      'Exploring emerging trends in web development: from AI-assisted coding to edge computing and the evolution of JavaScript frameworks.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              text: 'The web development landscape is constantly evolving. New tools, frameworks, and paradigms are reshaping how we build for the web.',
              type: 'text',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ text: 'AI-Assisted Development', type: 'text' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              text: 'Artificial intelligence is becoming an integral part of the development workflow, from code completion to automated testing and deployment.',
              type: 'text',
            },
          ],
        },
      ],
    },
    locale: 'en',
    status: 'draft',
    read_time_minute: 15,
  },
  {
    title: 'Mastering TypeScript Generics',
    slug: 'mastering-typescript-generics',
    excerpt:
      'A deep dive into TypeScript generics: from basic concepts to advanced patterns for building flexible, reusable code.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              text: 'Generics are one of TypeScript most powerful features, enabling you to write flexible, reusable code while maintaining type safety.',
              type: 'text',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ text: 'Generic Functions', type: 'text' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              text: 'Learn how to create functions that work with any type while preserving type information throughout the call chain.',
              type: 'text',
            },
          ],
        },
      ],
    },
    locale: 'en',
    status: 'published',
    read_time_minute: 20,
  },
  {
    title: 'Petualangan Kuliner di Nusantara',
    slug: 'petualangan-kuliner-nusantara',
    excerpt:
      'Menjelajahi kekayaan rasa masakan Indonesia dari Sabang sampai Merauke. Temukan hidangan otentik dan cerita di baliknya.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              text: 'Indonesia memiliki kekayaan kuliner yang luar biasa. Setiap daerah memiliki ciri khas dan rahasia resep yang diwariskan turun-temurun.',
              type: 'text',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ text: 'Ragam Rasa Nusantara', type: 'text' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              text: 'Dari rendang Sumatera hingga papeda Papua, setiap hidangan mencerminkan kekayaan budaya dan alam Indonesia.',
              type: 'text',
            },
          ],
        },
      ],
    },
    locale: 'id',
    status: 'published',
    read_time_minute: 9,
  },
  {
    title: 'Designing for Accessibility: A Practical Guide',
    slug: 'designing-for-accessibility-guide',
    excerpt:
      'How to create inclusive digital experiences that work for everyone. Learn WCAG guidelines and practical implementation strategies.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              text: 'Accessibility is not just a legal requirement—it is a moral imperative. Designing for accessibility benefits all users, not just those with disabilities.',
              type: 'text',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ text: 'WCAG Guidelines Overview', type: 'text' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              text: 'The Web Content Accessibility Guidelines provide a comprehensive framework for creating accessible web content. Learn the key principles: Perceivable, Operable, Understandable, and Robust.',
              type: 'text',
            },
          ],
        },
      ],
    },
    locale: 'en',
    status: 'published',
    read_time_minute: 11,
  },
];

const galleriesData = [
  { title: 'Bali Sunsets', slug: 'bali-sunsets', description: 'Golden hour captures from the Island of Gods' },
  { title: 'Tokyo Streets', slug: 'tokyo-streets', description: 'Urban photography from the neon-lit metropolis' },
  { title: 'Iceland Landscapes', slug: 'iceland-landscapes', description: 'Dramatic natural scenery from the land of fire and ice' },
  { title: 'Street Food Asia', slug: 'street-food-asia', description: 'Vibrant culinary scenes from across the continent' },
  { title: 'Architecture Details', slug: 'architecture-details', description: 'Minimalist architectural photography' },
  { title: 'Mountain Hikes', slug: 'mountain-hikes', description: 'Adventures above the clouds' },
  { title: 'Ocean Life', slug: 'ocean-life', description: 'Underwater and coastal photography' },
  { title: 'City Skylines', slug: 'city-skylines', description: 'Urban panoramas from around the world' },
  { title: 'Portrait Collection', slug: 'portrait-collection', description: 'Capturing human emotion and character' },
  { title: 'Wildlife Encounters', slug: 'wildlife-encounters', description: 'Nature and animal photography' },
];

const apiKeysData = [
  { name: 'Production API Key' },
  { name: 'Staging Environment' },
  { name: 'Mobile App Access' },
  { name: 'Third-Party Integration' },
  { name: 'Analytics Service' },
  { name: 'Backup System' },
  { name: 'Development Testing' },
  { name: 'Content Sync Service' },
  { name: 'Webhook Handler' },
  { name: 'Monitoring Dashboard' },
];

// =============================================================================
// SEEDING PROGRAM
// =============================================================================

const program = Effect.gen(function* () {
  const categoryService = yield* CategoryService;
  const postService = yield* PostService;
  const authService = yield* AuthService;
  const { query } = yield* DbService;

  console.log('🌱 Seeding CMS with 10 examples of each feature...\n');

  // Check for existing media
  const existingMedia = yield* query('get_existing_media', (db) =>
    db.selectFrom('media').select(['id', 'status']).where('status', '=', 'ready').limit(1).execute()
  );
  const featuredImageId = existingMedia.length > 0 ? existingMedia[0]!.id : null;

  if (featuredImageId) {
    console.log(`📷 Found existing media for featured images: ${featuredImageId}\n`);
  } else {
    console.log('⚠️ No existing media found. Posts and galleries will be created without images.\n');
  }

  // ---------------------------------------------------------------------------
  // SEED CATEGORIES
  // ---------------------------------------------------------------------------
  console.log('📂 Seeding Categories...');
  const createdCategories: Array<{ id: string; slug: string; name: string }> = [];

  for (const category of categoriesData) {
    try {
      const result = yield* categoryService.create(category);
      createdCategories.push({ id: result.id, slug: result.slug, name: result.name });
      console.log(`  ✅ ${result.name}`);
    } catch (error: unknown) {
      const err = error as { _tag?: string };
      if (err._tag === 'SlugConflict') {
        console.log(`  ⚠️  Skipped (exists): ${category.slug}`);
        // Try to fetch the existing category
        const existing = yield* Effect.orElse(
          categoryService.findBySlug(category.slug),
          () => Effect.succeed(null)
        );
        if (existing) {
          createdCategories.push({ id: existing.id, slug: existing.slug, name: existing.name });
        }
      } else {
        console.error(`  ❌ Failed: ${category.name}`, error);
      }
    }
  }
  console.log(`  Created: ${createdCategories.length} categories\n`);

  // ---------------------------------------------------------------------------
  // SEED POSTS
  // ---------------------------------------------------------------------------
  console.log('📝 Seeding Posts...');
  let postsCreated = 0;

  for (let i = 0; i < postsData.length; i++) {
    const post = postsData[i];
    if (!post) continue;

    // Assign a category to some posts
    const categoryId =
      i < createdCategories.length ? createdCategories[i % createdCategories.length]?.id ?? null : null;

    try {
      const result = yield* postService.create({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        locale: post.locale,
        status: post.status,
        read_time_minute: post.read_time_minute,
        featured_image: featuredImageId,
        category_id: categoryId,
        published_at: post.status === 'published' ? new Date() : null,
      });
      postsCreated++;
      console.log(`  ✅ ${result.title} (${result.locale})`);
    } catch (error: unknown) {
      const err = error as { _tag?: string };
      if (err._tag === 'SlugConflict') {
        console.log(`  ⚠️  Skipped (exists): ${post.slug}`);
      } else if (err._tag === 'CategoryNotFound') {
        console.log(`  ⚠️  Skipped (category not found): ${post.title}`);
      } else {
        console.error(`  ❌ Failed: ${post.title}`, error);
      }
    }
  }
  console.log(`  Created: ${postsCreated} posts\n`);

  // ---------------------------------------------------------------------------
  // SEED GALLERIES (using direct DB queries to avoid MediaService dependency)
  // ---------------------------------------------------------------------------
  console.log('🖼️  Seeding Galleries...');
  let galleriesCreated = 0;

  for (let i = 0; i < galleriesData.length; i++) {
    const gallery = galleriesData[i];
    if (!gallery) continue;

    // Assign a category to some galleries
    const categoryId =
      i < createdCategories.length ? createdCategories[i % createdCategories.length]?.id : null;

    try {
      // Check for slug conflict
      const existing = yield* query('check_gallery_slug', (db) =>
        db.selectFrom('galleries').select('id').where('slug', '=', gallery.slug).executeTakeFirst()
      );

      if (existing) {
        console.log(`  ⚠️  Skipped (exists): ${gallery.slug}`);
        continue;
      }

      // Prepare images array (just media IDs)
      const images = featuredImageId ? [featuredImageId] : [];
      const imagesJson = JSON.stringify(images);

      yield* query('create_gallery', (db) =>
        db
          .insertInto('galleries')
          .values({
            id: createId(),
            title: gallery.title,
            slug: gallery.slug,
            description: gallery.description,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            images: sql`${imagesJson}::jsonb` as any,
            category_id: categoryId,
            status: 'published',
            published_at: new Date(),
          })
          .execute()
      );

      galleriesCreated++;
      console.log(`  ✅ ${gallery.title}`);
    } catch (error: unknown) {
      console.error(`  ❌ Failed: ${gallery.title}`, error);
    }
  }
  console.log(`  Created: ${galleriesCreated} galleries\n`);

  // ---------------------------------------------------------------------------
  // SEED API KEYS
  // ---------------------------------------------------------------------------
  console.log('🔑 Seeding API Keys...');
  let apiKeysCreated = 0;
  const createdApiKeys: Array<{ name: string; key: string }> = [];

  for (const apiKeyData of apiKeysData) {
    try {
      // Generate API key
      const { key, prefix, hash } = authService.generateApiKey();
      const keyHash = yield* hash;

      // Store in database
      yield* query('create_api_key', (db) =>
        db
          .insertInto('api_keys')
          .values({
            id: createId(),
            name: apiKeyData.name,
            key_hash: keyHash,
            prefix: prefix,
            created_at: new Date(),
          })
          .execute()
      );

      apiKeysCreated++;
      createdApiKeys.push({ name: apiKeyData.name, key });
      console.log(`  ✅ ${apiKeyData.name}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      if (err.message?.includes('unique')) {
        console.log(`  ⚠️  Skipped (exists): ${apiKeyData.name}`);
      } else {
        console.error(`  ❌ Failed: ${apiKeyData.name}`, error);
      }
    }
  }
  console.log(`  Created: ${apiKeysCreated} API keys\n`);

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('✨ Seeding Complete!\n');
  console.log('📊 Summary:');
  console.log(`  Categories: ${createdCategories.length}`);
  console.log(`  Posts:      ${postsCreated}`);
  console.log(`  Galleries:  ${galleriesCreated}`);
  console.log(`  API Keys:   ${apiKeysCreated}\n`);

  if (createdApiKeys.length > 0) {
    console.log('🔐 Generated API Keys (save these - they will not be shown again):');
    for (const { name, key } of createdApiKeys) {
      console.log(`  ${name}: ${key}`);
    }
    console.log('');
  }

  console.log('🌐 Check the data at:');
  console.log('  • Posts:      http://localhost:3001/api/posts');
  console.log('  • Categories: http://localhost:3001/api/categories');
  console.log('  • Galleries:  http://localhost:3001/api/galleries');
  console.log('  • Admin:      http://localhost:3001/admin\n');
});

// =============================================================================
// SERVICE LAYERS
// =============================================================================

const MainLayer = PostServiceLive.pipe(
  Layer.provideMerge(CategoryServiceLive),
  Layer.provideMerge(AuthServiceLive),
  Layer.provideMerge(DbServiceLive({ connectionString: DATABASE_URL }))
);

// =============================================================================
// RUN
// =============================================================================

Effect.runPromise(program.pipe(Effect.provide(MainLayer), Effect.scoped))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed features:', error);
    process.exit(1);
  });
