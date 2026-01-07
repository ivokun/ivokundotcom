import { createSignal, createResource, createEffect, Show, For } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { api } from '../api';
import slugify from 'slugify';
import RichTextEditor from '../components/RichTextEditor';
import MediaPicker from '../components/MediaPicker';

interface Category {
  id: string;
  name: string;
}

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: string;
  locale: string;
  categoryId: string | null;
  featuredImageId: string | null;
  keywords: string[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function PostForm() {
  const params = useParams() as { id?: string };
  const navigate = useNavigate();
  const isEditing = () => params.id !== undefined;

  const [title, setTitle] = createSignal('');
  const [slug, setSlug] = createSignal('');
  const [content, setContent] = createSignal('');
  const [excerpt, setExcerpt] = createSignal('');
  const [locale, setLocale] = createSignal('en');
  const [status, setStatus] = createSignal('draft');
  const [categoryId, setCategoryId] = createSignal<string | null>(null);
  const [featuredImageId, setFeaturedImageId] = createSignal<string | null>(null);
  const [keywords, setKeywords] = createSignal<string[]>([]);
  const [keywordInput, setKeywordInput] = createSignal('');

  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');

  const [mediaPickerOpen, setMediaPickerOpen] = createSignal(false);

  const [categories] = createResource(async () => {
    const result = await api.categories.list();
    return result.data as Category[];
  });

  const [existingPost] = createResource(
    () => (isEditing() ? params.id : null) as string | null,
    async (id) => {
      if (!id) return null;
      return api.posts.get(id) as Promise<Post>;
    }
  );

  createEffect(() => {
    const post = existingPost();
    if (post && !title()) {
      setTitle(post.title);
      setSlug(post.slug);
      // Content from backend is TipTap JSON object, stringify for editor
      setContent(post.content ? JSON.stringify(post.content) : '');
      setExcerpt(post.excerpt);
      setLocale(post.locale);
      setStatus(post.status);
      setCategoryId(post.categoryId);
      setFeaturedImageId(post.featuredImageId);
      setKeywords(post.keywords || []);
    }
  });

  createEffect(() => {
    if (!isEditing()) {
      const generated = slugify(title(), { lower: true, strict: true });
      setSlug(generated);
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const data = {
        title: title(),
        slug: slug(),
        content: content(),
        excerpt: excerpt() || undefined,
        locale: locale(),
        status: status(),
        categoryId: categoryId() || undefined,
        featuredImageId: featuredImageId() || undefined,
        keywords: keywords(),
      };

      if (isEditing() && params.id) {
        await api.posts.update(params.id, data);
      } else {
        await api.posts.create(data);
      }
      navigate('/posts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save post');
    } finally {
      setSaving(false);
    }
  }

  function addKeyword() {
    const kw = keywordInput().trim();
    if (kw && !keywords().includes(kw)) {
      setKeywords([...keywords(), kw]);
      setKeywordInput('');
    }
  }

  function removeKeyword(kw: string) {
    setKeywords(keywords().filter((k) => k !== kw));
  }

  return (
    <div class="p-8 max-w-4xl">
      <div class="page-header flex justify-between items-center">
        <div>
          <h1 class="page-title">{isEditing() ? 'Edit Post' : 'New Post'}</h1>
          <p class="page-subtitle">
            {isEditing() ? 'Update post content' : 'Create a new blog post'}
          </p>
        </div>
        <div class="flex gap-2">
          <button onClick={() => navigate('/posts')} class="btn btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={saving()} class="btn btn-primary">
            <Show when={!saving()} fallback="Saving...">
              {isEditing() ? 'Update Post' : 'Create Post'}
            </Show>
          </button>
        </div>
      </div>

      <Show when={error()}>
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
          {error()}
        </div>
      </Show>

      <form onSubmit={handleSubmit} class="space-y-6">
        <div class="grid grid-cols-3 gap-6">
          <div class="col-span-2 space-y-6">
            <div class="card p-6 space-y-4">
              <div>
                <label for="title" class="label">Title</label>
                <input
                  id="title"
                  type="text"
                  value={title()}
                  onInput={(e) => setTitle(e.currentTarget.value)}
                  required
                  class="input"
                  placeholder="Post title"
                />
              </div>

              <div>
                <label for="slug" class="label">Slug</label>
                <div class="flex items-center">
                  <span class="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                    /
                  </span>
                  <input
                    id="slug"
                    type="text"
                    value={slug()}
                    onInput={(e) => setSlug(e.currentTarget.value)}
                    required
                    class="input rounded-l-none"
                    placeholder="post-slug"
                  />
                </div>
              </div>

              <div>
                <label class="label">Content</label>
                <RichTextEditor
                  value={content()}
                  onChange={setContent}
                  placeholder="Write your post content..."
                />
              </div>

              <div>
                <label for="excerpt" class="label">Excerpt</label>
                <textarea
                  id="excerpt"
                  value={excerpt()}
                  onInput={(e) => setExcerpt(e.currentTarget.value)}
                  rows={3}
                  class="input"
                  placeholder="Brief description of the post"
                />
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <div class="card p-6 space-y-4">
              <h3 class="font-semibold text-gray-900">Status</h3>
              <select
                value={status()}
                onChange={(e) => setStatus(e.currentTarget.value)}
                class="input"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>

            <div class="card p-6 space-y-4">
              <h3 class="font-semibold text-gray-900">Locale</h3>
              <select
                value={locale()}
                onChange={(e) => setLocale(e.currentTarget.value)}
                class="input"
              >
                <option value="en">English</option>
                <option value="id">Indonesian</option>
              </select>
            </div>

            <div class="card p-6 space-y-4">
              <h3 class="font-semibold text-gray-900">Category</h3>
              <select
                value={categoryId() || ''}
                onChange={(e) => setCategoryId(e.currentTarget.value || null)}
                class="input"
              >
                <option value="">No category</option>
                <For each={categories()}>
                  {(cat) => <option value={cat.id}>{cat.name}</option>}
                </For>
              </select>
            </div>

            <div class="card p-6 space-y-4">
              <h3 class="font-semibold text-gray-900">Featured Image</h3>
              <Show when={featuredImageId()}>
                <div class="relative">
                  <img
                    src={`/api/media/${featuredImageId()}`}
                    alt="Featured"
                    class="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setFeaturedImageId(null)}
                    class="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </Show>
              <button
                type="button"
                onClick={() => setMediaPickerOpen(true)}
                class="btn btn-secondary w-full"
              >
                {featuredImageId() ? 'Change Image' : 'Select Image'}
              </button>
            </div>

            <div class="card p-6 space-y-4">
              <h3 class="font-semibold text-gray-900">Keywords</h3>
              <div class="flex gap-2">
                <input
                  type="text"
                  value={keywordInput()}
                  onInput={(e) => setKeywordInput(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                  class="input"
                  placeholder="Add keyword"
                />
                <button type="button" onClick={addKeyword} class="btn btn-secondary">
                  Add
                </button>
              </div>
              <div class="flex flex-wrap gap-2">
                <For each={keywords()}>
                  {(kw) => (
                    <span class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                      {kw}
                      <button type="button" onClick={() => removeKeyword(kw)} class="text-gray-400 hover:text-gray-600">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>
      </form>

      <MediaPicker
        isOpen={mediaPickerOpen()}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={(media) => {
          setFeaturedImageId(media.id);
          setMediaPickerOpen(false);
        }}
      />
    </div>
  );
}
