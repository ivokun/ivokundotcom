import { createSignal, createResource, createEffect, Show, For } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { api } from '../api';
import slugify from 'slugify';
import MediaPicker from '../components/MediaPicker';

interface GalleryImage {
  id: string;
  mediaId: string;
  order: number;
}

interface Gallery {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: string;
  images: GalleryImage[];
  publishedAt: string | null;
  createdAt: string;
}

interface MediaItem {
  id: string;
  filename: string;
  mimeType: string;
  alt: string | null;
}

export default function GalleryForm() {
  const params = useParams() as { id?: string };
  const navigate = useNavigate();
  const isEditing = () => params.id !== undefined;
  
  const [title, setTitle] = createSignal('');
  const [slug, setSlug] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [status, setStatus] = createSignal('draft');
  const [images, setImages] = createSignal<GalleryImage[]>([]);
  
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [mediaPickerOpen, setMediaPickerOpen] = createSignal(false);
  
  const [existingGallery] = createResource(
    () => (isEditing() ? params.id : null) as string | null,
    async (id) => {
      if (!id) return null;
      return api.galleries.get(id) as Promise<Gallery>;
    }
  );
  
  createEffect(() => {
    const gallery = existingGallery();
    if (gallery && !title()) {
      setTitle(gallery.title);
      setSlug(gallery.slug);
      setDescription(gallery.description);
      setStatus(gallery.status);
      setImages(gallery.images);
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
        description: description(),
        status: status(),
        images: images().map((img, i) => ({ ...img, order: i })),
      };
      
      if (isEditing() && params.id) {
        await api.galleries.update(params.id, data);
      } else {
        await api.galleries.create(data);
      }
      navigate('/galleries');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save gallery');
    } finally {
      setSaving(false);
    }
  }
  
  function addImage(media: MediaItem) {
    const newImage: GalleryImage = {
      id: crypto.randomUUID(),
      mediaId: media.id,
      order: images().length,
    };
    setImages([...images(), newImage]);
    setMediaPickerOpen(false);
  }
  
  function removeImage(id: string) {
    setImages(images().filter((img) => img.id !== id));
  }
  
  function moveImage(id: string, direction: 'up' | 'down') {
    const idx = images().findIndex((img) => img.id === id);
    if (idx === -1) return;
    
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === images().length - 1) return;
    
    const newImages = [...images()];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const img1 = newImages[idx];
    const img2 = newImages[targetIdx];
    if (img1 && img2) {
      [newImages[idx], newImages[targetIdx]] = [img2, img1];
    }
    setImages(newImages);
  }
  
  return (
    <div class="p-8 max-w-4xl">
      <div class="page-header flex justify-between items-center">
        <div>
          <h1 class="page-title">{isEditing() ? 'Edit Gallery' : 'New Gallery'}</h1>
          <p class="page-subtitle">
            {isEditing() ? 'Update gallery content' : 'Create a new photo gallery'}
          </p>
        </div>
        <div class="flex gap-2">
          <button onClick={() => navigate('/galleries')} class="btn btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={saving()} class="btn btn-primary">
            <Show when={!saving()} fallback="Saving...">
              {isEditing() ? 'Update Gallery' : 'Create Gallery'}
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
                  placeholder="Gallery title"
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
                    placeholder="gallery-slug"
                  />
                </div>
              </div>
              
              <div>
                <label for="description" class="label">Description</label>
                <textarea
                  id="description"
                  value={description()}
                  onInput={(e) => setDescription(e.currentTarget.value)}
                  rows={4}
                  class="input"
                  placeholder="Describe this gallery"
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
          </div>
        </div>
        
        {/* Images */}
        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-gray-900">Images ({images().length})</h3>
            <button
              type="button"
              onClick={() => setMediaPickerOpen(true)}
              class="btn btn-primary btn-sm"
            >
              Add Images
            </button>
          </div>
          
          <Show when={images().length > 0}>
            <div class="space-y-2">
              <For each={images()}>
                {(image, idx) => (
                  <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span class="text-sm text-gray-500 w-6">{idx() + 1}</span>
                    <img
                      src={`/api/media/${image.mediaId}`}
                      alt=""
                      class="w-16 h-16 object-cover rounded"
                    />
                    <div class="flex-1">
                      <p class="text-sm text-gray-600">Image {image.mediaId}</p>
                    </div>
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveImage(image.id, 'up')}
                        disabled={idx() === 0}
                        class="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(image.id, 'down')}
                        disabled={idx() === images().length - 1}
                        class="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(image.id)}
                        class="p-1 text-red-500 hover:text-red-700"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
          
          <Show when={images().length === 0}>
            <div class="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
              <svg class="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p class="mt-2">No images yet</p>
            </div>
          </Show>
        </div>
      </form>
      
      <MediaPicker
        isOpen={mediaPickerOpen()}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={addImage}
        multiple
      />
    </div>
  );
}
