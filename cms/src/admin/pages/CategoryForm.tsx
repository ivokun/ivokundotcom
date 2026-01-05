import { createSignal, createResource, createEffect, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { api } from '../api';
import slugify from 'slugify';

export default function CategoryForm() {
  const params = useParams() as { id?: string };
  const navigate = useNavigate();
  const isEditing = () => params.id !== undefined;
  
  const [name, setName] = createSignal('');
  const [slug, setSlug] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  
  const [existingCategory] = createResource(
    () => (isEditing() ? params.id : null) as string | null,
    async (id) => {
      if (!id) return null;
      return api.categories.get(id);
    }
  );
  
  createEffect(() => {
    const cat = existingCategory();
    if (cat && !name()) {
      setName(cat.name);
      setSlug(cat.slug);
    }
  });
  
  createEffect(() => {
    if (!isEditing()) {
      const generated = slugify(name(), { lower: true, strict: true });
      setSlug(generated);
    }
  });
  
  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError('');
    setSaving(true);
    
    try {
      if (isEditing() && params.id) {
        await api.categories.update(params.id, { name: name(), slug: slug() });
      } else {
        await api.categories.create({ name: name(), slug: slug() });
      }
      navigate('/categories');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  }
  
  return (
    <div class="p-8 max-w-2xl">
      <div class="page-header">
        <h1 class="page-title">{isEditing() ? 'Edit Category' : 'New Category'}</h1>
        <p class="page-subtitle">
          {isEditing() ? 'Update category details' : 'Create a new content category'}
        </p>
      </div>
      
      <form onSubmit={handleSubmit} class="card p-6 space-y-6">
        <Show when={error()}>
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error()}
          </div>
        </Show>
        
        <div>
          <label for="name" class="label">Name</label>
          <input
            id="name"
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            required
            class="input"
            placeholder="Category name"
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
              placeholder="category-slug"
            />
          </div>
          <p class="mt-1 text-xs text-gray-500">URL-friendly identifier</p>
        </div>
        
        <div class="flex items-center gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('/categories')}
            class="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving() || existingCategory.loading}
            class="btn btn-primary"
          >
            <Show when={!saving()} fallback={
              <span class="flex items-center gap-2">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </span>
            }>
              {isEditing() ? 'Update Category' : 'Create Category'}
            </Show>
          </button>
        </div>
      </form>
    </div>
  );
}
