/**
 * Minimal stub of the ivokun CMS public API for the web smoke test.
 * Serves the exact response shapes web/src/api/*.ts expect so
 * `astro build` can statically generate every page without a live CMS.
 *
 * Run: bun scripts/stub-cms.ts  (port 4173)
 */

const MEDIA = {
  id: 'media-1',
  filename: 'hero.webp',
  mime_type: 'image/webp',
  size: 123456,
  alt: 'Hero image',
  urls: {
    original: 'https://media.ivokun.com/hero/original.webp',
    thumbnail: 'https://media.ivokun.com/hero/thumbnail.webp',
    small: 'https://media.ivokun.com/hero/small.webp',
    large: 'https://media.ivokun.com/hero/large.webp',
  },
  width: 1600,
  height: 900,
  status: 'ready' as const,
  created_at: '2026-01-01T00:00:00.000Z',
};

const CATEGORY = {
  id: 'cat-1',
  name: 'Tech',
  slug: 'tech',
  description: 'Technical notes',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const ARTICLE = {
  id: 'post-1',
  title: 'Hello World',
  slug: 'hello-world',
  excerpt: 'First post from the stub CMS',
  content: {
    type: 'doc' as const,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'This paragraph was rendered from the stub CMS.' }],
      },
    ],
  },
  featured_image: null,
  read_time_minute: 3,
  category_id: CATEGORY.id,
  locale: 'en' as const,
  status: 'published' as const,
  published_at: '2026-02-01T00:00:00.000Z',
  created_at: '2026-01-15T00:00:00.000Z',
  updated_at: '2026-02-01T00:00:00.000Z',
  category: CATEGORY,
  featured_media: MEDIA,
};

const GALLERY = {
  id: 'gal-1',
  title: 'Summer Trip',
  slug: 'summer-trip',
  description: 'Photos from the summer trip',
  images: [MEDIA],
  category_id: CATEGORY.id,
  status: 'published' as const,
  published_at: '2026-02-01T00:00:00.000Z',
  created_at: '2026-01-15T00:00:00.000Z',
  updated_at: '2026-02-01T00:00:00.000Z',
  category: CATEGORY,
};

const HOME = {
  id: 'home-1',
  title: 'Ivokun',
  short_description: 'Personal site of Ivokun',
  description: null,
  hero: 'Ivokun',
  keywords: 'ivokun, blog',
  updated_at: '2026-02-01T00:00:00.000Z',
};

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

const server = Bun.serve({
  port: Number(process.env['STUB_CMS_PORT'] ?? 4173),
  fetch(req) {
    const path = new URL(req.url).pathname;
    switch (path) {
      case '/api/posts':
        return json({ data: [ARTICLE], meta: { total: 1, limit: 100, offset: 0 } });
      case '/api/posts/hello-world':
        return json(ARTICLE);
      case '/api/categories':
        return json({ data: [CATEGORY], meta: { total: 1, limit: 50, offset: 0 } });
      case '/api/categories/tech':
        return json(CATEGORY);
      case '/api/galleries':
        return json({ data: [GALLERY], meta: { total: 1, limit: 50, offset: 0 } });
      case '/api/galleries/summer-trip':
        return json(GALLERY);
      case '/api/home':
        return json(HOME);
      case '/health':
        return json({ status: 'ok' });
      default:
        return json({ error: 'NotFound', message: `No stub for ${path}` }, { status: 404 });
    }
  },
});

console.log(`[stub-cms] listening on http://127.0.0.1:${server.port}`);
