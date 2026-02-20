#!/usr/bin/env bun
/**
 * @fileoverview Strapi to ivokun CMS Migration Script
 * PRD Section 6.3 - Data Migration
 *
 * Migrates data from Strapi 5 API to the new CMS:
 * - Categories
 * - Posts (with blocks -> TipTap conversion)
 * - Galleries
 * - Home content
 * - Media files (re-uploaded to R2)
 *
 * Usage:
 *   STRAPI_URL=http://localhost:1337 \
 *   STRAPI_TOKEN=your-api-token \
 *   DATABASE_URL=postgres://... \
 *   R2_ACCESS_KEY_ID=... \
 *   R2_ACCESS_SECRET=... \
 *   R2_ENDPOINT=... \
 *   R2_BUCKET=... \
 *   R2_PUBLIC_URL=... \
 *   bun run scripts/migrate-strapi.ts
 *
 * Options:
 *   --dry-run       Preview changes without writing
 *   --skip-media    Skip media migration (use existing URLs)
 *   --only=TYPE     Only migrate specific type (categories|posts|galleries|home|media)
 */

import { createId } from '@paralleldrive/cuid2';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import sharp from 'sharp';
import type { Database, TipTapDocument, TipTapNode, TipTapMark, MediaUrls } from '../src/types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const config = {
  strapiUrl: process.env['STRAPI_URL'] || 'http://localhost:1337',
  strapiToken: process.env['STRAPI_TOKEN'] || '',
  databaseUrl: process.env['DATABASE_URL'] || '',
  r2: {
    accessKeyId: process.env['R2_ACCESS_KEY_ID'] || '',
    secretAccessKey: process.env['R2_ACCESS_SECRET'] || '',
    endpoint: process.env['R2_ENDPOINT'] || '',
    bucket: process.env['R2_BUCKET'] || '',
    publicUrl: process.env['R2_PUBLIC_URL'] || '',
  },
  dryRun: process.argv.includes('--dry-run'),
  skipMedia: process.argv.includes('--skip-media'),
  only: process.argv.find((arg) => arg.startsWith('--only='))?.split('=')[1],
};

// =============================================================================
// STRAPI TYPES
// =============================================================================

interface StrapiResponse<T> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

interface StrapiMedia {
  id: number;
  documentId: string;
  name: string;
  alternativeText: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  url: string;
  mime: string;
  size: number;
  formats?: {
    thumbnail?: StrapiMediaFormat;
    small?: StrapiMediaFormat;
    medium?: StrapiMediaFormat;
    large?: StrapiMediaFormat;
  };
}

interface StrapiMediaFormat {
  url: string;
  width: number;
  height: number;
  size: number;
}

interface StrapiCategory {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

interface StrapiPost {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content: string | null; // Legacy markdown
  richContent: StrapiBlock[] | null; // Blocks format
  excerpt: string | null;
  readTimeMinute: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  locale: string;
  featuredPicture?: { data: StrapiMedia | null };
  category?: { data: StrapiCategory | null };
}

interface StrapiGallery {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  images?: { data: StrapiMedia[] };
  category?: { data: StrapiCategory | null };
}

interface StrapiHome {
  id: number;
  documentId: string;
  title: string | null;
  description: string | null;
  shortDescription: string | null;
  keywords: string | null;
  updatedAt: string;
  hero?: { data: StrapiMedia | null };
}

// =============================================================================
// STRAPI BLOCKS TYPES
// =============================================================================

type StrapiBlock =
  | StrapiParagraphBlock
  | StrapiHeadingBlock
  | StrapiListBlock
  | StrapiQuoteBlock
  | StrapiCodeBlock
  | StrapiImageBlock
  | StrapiLinkBlock;

interface StrapiParagraphBlock {
  type: 'paragraph';
  children: StrapiInlineNode[];
}

interface StrapiHeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: StrapiInlineNode[];
}

interface StrapiListBlock {
  type: 'list';
  format: 'ordered' | 'unordered';
  children: StrapiListItemBlock[];
}

interface StrapiListItemBlock {
  type: 'list-item';
  children: StrapiInlineNode[];
}

interface StrapiQuoteBlock {
  type: 'quote';
  children: StrapiInlineNode[];
}

interface StrapiCodeBlock {
  type: 'code';
  children: StrapiInlineNode[];
}

interface StrapiImageBlock {
  type: 'image';
  image: StrapiMedia;
  children: StrapiInlineNode[];
}

interface StrapiLinkBlock {
  type: 'link';
  url: string;
  children: StrapiInlineNode[];
}

interface StrapiTextNode {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

type StrapiInlineNode = StrapiTextNode | StrapiLinkBlock;

// =============================================================================
// BLOCKS TO TIPTAP CONVERTER
// =============================================================================

/**
 * Converts Strapi blocks format to TipTap JSON
 */
function blocksToTipTap(blocks: StrapiBlock[] | null): TipTapDocument | null {
  if (!blocks || blocks.length === 0) {
    return null;
  }

  const content: TipTapNode[] = blocks.map(convertBlock).flat();
  return { type: 'doc', content };
}

function convertBlock(block: StrapiBlock): TipTapNode[] {
  switch (block.type) {
    case 'paragraph':
      return [
        {
          type: 'paragraph',
          content: convertInlineNodes(block.children),
        },
      ];

    case 'heading':
      return [
        {
          type: 'heading',
          attrs: { level: block.level },
          content: convertInlineNodes(block.children),
        },
      ];

    case 'list':
      return [
        {
          type: block.format === 'ordered' ? 'orderedList' : 'bulletList',
          content: block.children.map((item) => ({
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: convertInlineNodes(item.children),
              },
            ],
          })),
        },
      ];

    case 'quote':
      return [
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: convertInlineNodes(block.children),
            },
          ],
        },
      ];

    case 'code':
      // Extract text from children
      const codeText = block.children.map((child) => ('text' in child ? child.text : '')).join('');
      return [
        {
          type: 'codeBlock',
          attrs: { language: null },
          content: [{ type: 'text', text: codeText }],
        },
      ];

    case 'image':
      return [
        {
          type: 'image',
          attrs: {
            src: block.image.url,
            alt: block.image.alternativeText || '',
            title: block.image.caption || null,
          },
        },
      ];

    case 'link':
      // Top-level link block - wrap in paragraph
      return [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: block.children.map((c) => ('text' in c ? c.text : '')).join(''),
              marks: [{ type: 'link', attrs: { href: block.url } }],
            },
          ],
        },
      ];

    default:
      console.warn(`Unknown block type: ${(block as { type: string }).type}`);
      return [];
  }
}

function convertInlineNodes(nodes: StrapiInlineNode[]): TipTapNode[] {
  return nodes.map((node) => {
    if (node.type === 'text') {
      const marks: TipTapMark[] = [];
      if (node.bold) marks.push({ type: 'bold' });
      if (node.italic) marks.push({ type: 'italic' });
      if (node.underline) marks.push({ type: 'underline' });
      if (node.strikethrough) marks.push({ type: 'strike' });
      if (node.code) marks.push({ type: 'code' });

      const result: TipTapNode = { type: 'text', text: node.text };
      if (marks.length > 0) {
        result.marks = marks;
      }
      return result;
    }

    if (node.type === 'link') {
      return {
        type: 'text',
        text: node.children.map((c) => ('text' in c ? c.text : '')).join(''),
        marks: [{ type: 'link', attrs: { href: node.url } }],
      };
    }

    return { type: 'text', text: '' };
  });
}

/**
 * Converts markdown to TipTap JSON (simplified)
 * For legacy `content` field that uses markdown
 */
function markdownToTipTap(markdown: string | null): TipTapDocument | null {
  if (!markdown || markdown.trim() === '') {
    return null;
  }

  // Simple line-by-line conversion
  const lines = markdown.split('\n');
  const content: TipTapNode[] = [];
  let currentList: TipTapNode | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Headers
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      if (currentList) {
        content.push(currentList);
        currentList = null;
      }
      content.push({
        type: 'heading',
        attrs: { level: headerMatch[1]!.length },
        content: [{ type: 'text', text: headerMatch[2]! }],
      });
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (!currentList || currentList.type !== 'bulletList') {
        if (currentList) content.push(currentList);
        currentList = { type: 'bulletList', content: [] };
      }
      currentList.content!.push({
        type: 'listItem',
        content: [{ type: 'paragraph', content: parseInlineMarkdown(ulMatch[1]!) }],
      });
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!currentList || currentList.type !== 'orderedList') {
        if (currentList) content.push(currentList);
        currentList = { type: 'orderedList', content: [] };
      }
      currentList.content!.push({
        type: 'listItem',
        content: [{ type: 'paragraph', content: parseInlineMarkdown(olMatch[1]!) }],
      });
      continue;
    }

    // Blockquote
    const quoteMatch = trimmed.match(/^>\s*(.*)$/);
    if (quoteMatch) {
      if (currentList) {
        content.push(currentList);
        currentList = null;
      }
      content.push({
        type: 'blockquote',
        content: [{ type: 'paragraph', content: parseInlineMarkdown(quoteMatch[1]!) }],
      });
      continue;
    }

    // Code block (fenced)
    if (trimmed.startsWith('```')) {
      // Skip code blocks for simplicity - would need multi-line handling
      continue;
    }

    // Empty line - end current list
    if (trimmed === '') {
      if (currentList) {
        content.push(currentList);
        currentList = null;
      }
      continue;
    }

    // Regular paragraph
    if (currentList) {
      content.push(currentList);
      currentList = null;
    }
    content.push({
      type: 'paragraph',
      content: parseInlineMarkdown(trimmed),
    });
  }

  if (currentList) {
    content.push(currentList);
  }

  return content.length > 0 ? { type: 'doc', content } : null;
}

function parseInlineMarkdown(text: string): TipTapNode[] {
  // Very simplified inline parsing - handles **bold**, *italic*, `code`, [link](url)
  const result: TipTapNode[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      result.push({ type: 'text', text: boldMatch[1], marks: [{ type: 'bold' }] });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      result.push({ type: 'text', text: italicMatch[1], marks: [{ type: 'italic' }] });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Code
    const codeMatch = remaining.match(/^`(.+?)`/);
    if (codeMatch) {
      result.push({ type: 'text', text: codeMatch[1], marks: [{ type: 'code' }] });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Link
    const linkMatch = remaining.match(/^\[(.+?)\]\((.+?)\)/);
    if (linkMatch) {
      result.push({ type: 'text', text: linkMatch[1], marks: [{ type: 'link', attrs: { href: linkMatch[2] } }] });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Plain text until next special char
    const plainMatch = remaining.match(/^[^*`\[]+/);
    if (plainMatch) {
      result.push({ type: 'text', text: plainMatch[0] });
      remaining = remaining.slice(plainMatch[0].length);
      continue;
    }

    // Single special char that didn't match a pattern
    result.push({ type: 'text', text: remaining[0] });
    remaining = remaining.slice(1);
  }

  return result.length > 0 ? result : [{ type: 'text', text: '' }];
}

// =============================================================================
// STRAPI API CLIENT
// =============================================================================

async function strapiGet<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${config.strapiUrl}/api${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.strapiToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Strapi API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchAllPaginated<T>(
  endpoint: string,
  populate?: string
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const params: Record<string, string> = {
      'pagination[page]': String(page),
      'pagination[pageSize]': String(pageSize),
    };
    if (populate) {
      params['populate'] = populate;
    }

    const response = await strapiGet<StrapiResponse<T[]>>(endpoint, params);
    items.push(...response.data);

    if (!response.meta?.pagination || page >= response.meta.pagination.pageCount) {
      break;
    }
    page++;
  }

  return items;
}

// =============================================================================
// R2 UPLOAD
// =============================================================================

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: config.r2.endpoint,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }
  return s3Client;
}

async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  if (config.dryRun) {
    console.log(`  [DRY-RUN] Would upload: ${key}`);
    return `${config.r2.publicUrl}/${key}`;
  }

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: config.r2.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `${config.r2.publicUrl}/${key}`;
}

async function processAndUploadImage(
  sourceUrl: string,
  filename: string
): Promise<MediaUrls> {
  // Download original
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download: ${sourceUrl}`);
  }
  const originalBuffer = Buffer.from(await response.arrayBuffer());

  // Process variants
  const image = sharp(originalBuffer);
  const metadata = await image.metadata();

  const variants: { name: keyof MediaUrls; width: number; quality: number }[] = [
    { name: 'original', width: metadata.width || 1920, quality: 90 },
    { name: 'large', width: 1920, quality: 85 },
    { name: 'small', width: 800, quality: 85 },
    { name: 'thumbnail', width: 200, quality: 80 },
  ];

  const urls: Partial<MediaUrls> = {};
  const baseName = filename.replace(/\.[^.]+$/, '');
  const id = createId();

  for (const variant of variants) {
    const processed = await sharp(originalBuffer)
      .resize(variant.width, undefined, { withoutEnlargement: true })
      .webp({ quality: variant.quality })
      .toBuffer();

    const key = `media/${id}/${variant.name === 'original' ? baseName : `${baseName}-${variant.name}`}.webp`;
    urls[variant.name] = await uploadToR2(processed, key, 'image/webp');
  }

  return urls as MediaUrls;
}

// =============================================================================
// DATABASE
// =============================================================================

function createDb(): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString: config.databaseUrl,
        max: 10,
      }),
    }),
  });
}

// =============================================================================
// MIGRATION LOGIC
// =============================================================================

// ID mapping: Strapi documentId -> CMS cuid2
const idMap = {
  categories: new Map<string, string>(),
  media: new Map<string, string>(),
  posts: new Map<string, string>(),
  galleries: new Map<string, string>(),
};

async function migrateCategories(db: Kysely<Database>): Promise<void> {
  console.log('\n=== Migrating Categories ===');

  const strapiCategories = await fetchAllPaginated<StrapiCategory>('/categories');
  console.log(`Found ${strapiCategories.length} categories in Strapi`);

  for (const cat of strapiCategories) {
    const id = createId();
    idMap.categories.set(cat.documentId, id);

    console.log(`  ${cat.name} (${cat.slug})`);

    if (!config.dryRun) {
      await db
        .insertInto('categories')
        .values({
          id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          created_at: new Date(cat.createdAt),
          updated_at: new Date(cat.updatedAt),
        })
        .execute();
    }
  }

  console.log(`Migrated ${strapiCategories.length} categories`);
}

async function migrateMedia(db: Kysely<Database>): Promise<void> {
  console.log('\n=== Migrating Media ===');

  // Fetch all media from Strapi's upload plugin
  const response = await strapiGet<StrapiMedia[]>('/upload/files', {
    'pagination[pageSize]': '1000',
  });

  console.log(`Found ${response.length} media files in Strapi`);

  for (const media of response) {
    const id = createId();
    idMap.media.set(media.documentId || String(media.id), id);

    console.log(`  ${media.name} (${media.mime})`);

    let urls: MediaUrls;

    if (config.skipMedia) {
      // Use existing Strapi URLs
      const baseUrl = media.url.startsWith('http') ? media.url : `${config.strapiUrl}${media.url}`;
      urls = {
        original: baseUrl,
        large: media.formats?.large?.url
          ? media.formats.large.url.startsWith('http')
            ? media.formats.large.url
            : `${config.strapiUrl}${media.formats.large.url}`
          : baseUrl,
        small: media.formats?.small?.url
          ? media.formats.small.url.startsWith('http')
            ? media.formats.small.url
            : `${config.strapiUrl}${media.formats.small.url}`
          : baseUrl,
        thumbnail: media.formats?.thumbnail?.url
          ? media.formats.thumbnail.url.startsWith('http')
            ? media.formats.thumbnail.url
            : `${config.strapiUrl}${media.formats.thumbnail.url}`
          : baseUrl,
      };
    } else {
      // Download and re-upload to R2
      const sourceUrl = media.url.startsWith('http') ? media.url : `${config.strapiUrl}${media.url}`;
      try {
        urls = await processAndUploadImage(sourceUrl, media.name);
      } catch (err) {
        console.error(`    Failed to process ${media.name}:`, err);
        continue;
      }
    }

    if (!config.dryRun) {
      await db
        .insertInto('media')
        .values({
          id,
          filename: media.name,
          mime_type: media.mime,
          size: Math.round(media.size * 1024), // Strapi stores in KB
          alt: media.alternativeText,
          urls: urls,
          width: media.width,
          height: media.height,
          status: 'ready' as const,
          upload_key: null,
          created_at: new Date(),
        })
        .execute();
    }
  }

  console.log(`Migrated ${response.length} media files`);
}

async function migratePosts(db: Kysely<Database>): Promise<void> {
  console.log('\n=== Migrating Posts ===');

  const strapiPosts = await fetchAllPaginated<StrapiPost>(
    '/posts',
    'featuredPicture,category,localizations'
  );
  console.log(`Found ${strapiPosts.length} posts in Strapi`);

  for (const post of strapiPosts) {
    const id = createId();
    idMap.posts.set(post.documentId, id);

    // Convert content: prefer richContent (blocks), fallback to content (markdown)
    let content: TipTapDocument | null = null;
    if (post.richContent && post.richContent.length > 0) {
      content = blocksToTipTap(post.richContent);
    } else if (post.content) {
      content = markdownToTipTap(post.content);
    }

    // Map category ID
    const categoryId = post.category?.data?.documentId
      ? idMap.categories.get(post.category.data.documentId) || null
      : null;

    // Map featured image ID
    const featuredImageId = post.featuredPicture?.data?.documentId
      ? idMap.media.get(post.featuredPicture.data.documentId) ||
        idMap.media.get(String(post.featuredPicture.data.id)) ||
        null
      : null;

    // Map locale
    const locale = post.locale === 'id' ? 'id' : 'en';

    console.log(`  ${post.title} (${post.slug}, ${locale})`);

    if (!config.dryRun) {
      await db
        .insertInto('posts')
        .values({
          id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: content,
          featured_image: featuredImageId,
          read_time_minute: post.readTimeMinute,
          category_id: categoryId,
          locale: locale as 'en' | 'id',
          status: post.publishedAt ? 'published' : 'draft',
          published_at: post.publishedAt ? new Date(post.publishedAt) : null,
          created_at: new Date(post.createdAt),
          updated_at: new Date(post.updatedAt),
        })
        .execute();
    }
  }

  console.log(`Migrated ${strapiPosts.length} posts`);
}

async function migrateGalleries(db: Kysely<Database>): Promise<void> {
  console.log('\n=== Migrating Galleries ===');

  const strapiGalleries = await fetchAllPaginated<StrapiGallery>(
    '/galleries',
    'images,category'
  );
  console.log(`Found ${strapiGalleries.length} galleries in Strapi`);

  for (const gallery of strapiGalleries) {
    const id = createId();
    idMap.galleries.set(gallery.documentId, id);

    // Map category ID
    const categoryId = gallery.category?.data?.documentId
      ? idMap.categories.get(gallery.category.data.documentId) || null
      : null;

    // Map image IDs
    const imageIds: string[] = [];
    if (gallery.images?.data) {
      for (const img of gallery.images.data) {
        const mediaId = idMap.media.get(img.documentId || String(img.id));
        if (mediaId) {
          imageIds.push(mediaId);
        }
      }
    }

    console.log(`  ${gallery.title} (${gallery.slug}, ${imageIds.length} images)`);

    if (!config.dryRun) {
      await db
        .insertInto('galleries')
        .values({
          id,
          title: gallery.title,
          slug: gallery.slug,
          description: gallery.description,
          images: imageIds,
          category_id: categoryId,
          status: gallery.publishedAt ? 'published' : 'draft',
          published_at: gallery.publishedAt ? new Date(gallery.publishedAt) : null,
          created_at: new Date(gallery.createdAt),
          updated_at: new Date(gallery.updatedAt),
        })
        .execute();
    }
  }

  console.log(`Migrated ${strapiGalleries.length} galleries`);
}

async function migrateHome(db: Kysely<Database>): Promise<void> {
  console.log('\n=== Migrating Home ===');

  const response = await strapiGet<StrapiResponse<StrapiHome>>('/home', {
    populate: 'hero',
  });
  const home = response.data;

  if (!home) {
    console.log('No home content found in Strapi');
    return;
  }

  // Map hero image ID
  const heroId = home.hero?.data?.documentId
    ? idMap.media.get(home.hero.data.documentId) ||
      idMap.media.get(String(home.hero.data.id)) ||
      null
    : null;

  // Convert description (markdown) to TipTap
  const description = markdownToTipTap(home.description);

  console.log(`  Home: "${home.title}"`);

  if (!config.dryRun) {
    // Upsert home singleton
    await db
      .insertInto('home')
      .values({
        id: 'singleton',
        title: home.title,
        short_description: home.shortDescription,
        description: description,
        hero: heroId,
        keywords: home.keywords,
        updated_at: new Date(home.updatedAt),
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          title: home.title,
          short_description: home.shortDescription,
          description: description,
          hero: heroId,
          keywords: home.keywords,
          updated_at: new Date(home.updatedAt),
        })
      )
      .execute();
  }

  console.log('Migrated home content');
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('===========================================');
  console.log('  Strapi to ivokun CMS Migration');
  console.log('===========================================');
  console.log(`Strapi URL: ${config.strapiUrl}`);
  console.log(`Dry run: ${config.dryRun}`);
  console.log(`Skip media: ${config.skipMedia}`);
  if (config.only) {
    console.log(`Only: ${config.only}`);
  }

  // Validate config
  if (!config.strapiToken) {
    throw new Error('STRAPI_TOKEN is required');
  }
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  if (!config.skipMedia && !config.r2.accessKeyId) {
    throw new Error('R2 credentials required (or use --skip-media)');
  }

  const db = createDb();

  try {
    const shouldRun = (type: string) => !config.only || config.only === type;

    // Order matters: categories first (no deps), then media, then posts/galleries (depend on both)
    if (shouldRun('categories')) {
      await migrateCategories(db);
    }

    if (shouldRun('media')) {
      await migrateMedia(db);
    }

    if (shouldRun('posts')) {
      await migratePosts(db);
    }

    if (shouldRun('galleries')) {
      await migrateGalleries(db);
    }

    if (shouldRun('home')) {
      await migrateHome(db);
    }

    console.log('\n===========================================');
    console.log('  Migration Complete!');
    console.log('===========================================');
    console.log(`Categories: ${idMap.categories.size}`);
    console.log(`Media: ${idMap.media.size}`);
    console.log(`Posts: ${idMap.posts.size}`);
    console.log(`Galleries: ${idMap.galleries.size}`);
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
