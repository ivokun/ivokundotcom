import { createSignal, createResource, For, Show } from 'solid-js';
import { api } from '../api';
import Modal from '../components/Modal';

interface MediaItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  alt: string | null;
  createdAt: string;
}

export default function Media() {
  const [media, { refetch }] = createResource(async () => {
    const result = await api.media.list();
    return result.data as MediaItem[];
  });
  
  const [uploading, setUploading] = createSignal(false);
  const [editModal, setEditModal] = createSignal<MediaItem | null>(null);
  const [deleteModal, setDeleteModal] = createSignal<MediaItem | null>(null);
  const [saving, setSaving] = createSignal(false);
  
  async function handleUpload(file: File) {
    setUploading(true);
    try {
      await api.media.upload(file);
      refetch();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }
  
  async function handleUpdateAlt() {
    const item = editModal();
    if (!item) return;
    
    setSaving(true);
    try {
      await api.media.update(item.id, { alt: item.alt || '' });
      setEditModal(null);
      refetch();
    } catch (err) {
      console.error('Update failed:', err);
    } finally {
      setSaving(false);
    }
  }
  
  async function handleDelete() {
    const item = deleteModal();
    if (!item) return;
    
    setSaving(true);
    try {
      await api.media.delete(item.id);
      setDeleteModal(null);
      refetch();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setSaving(false);
    }
  }
  
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  
  return (
    <div class="p-8">
      <div class="page-header">
        <h1 class="page-title">Media Library</h1>
        <p class="page-subtitle">Upload and manage images</p>
      </div>
      
      {/* Upload */}
      <div class="card p-6 mb-6">
        <label class="flex flex-col items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-lg appearance-none cursor-pointer hover:border-gray-400 focus:outline-none">
          <Show when={!uploading()} fallback={
            <div class="flex items-center gap-2">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              <span class="text-gray-500">Uploading...</span>
            </div>
          }>
            <div class="flex flex-col items-center">
              <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span class="text-sm text-gray-500 mt-1">Click to upload or drag and drop</span>
              <span class="text-xs text-gray-400 mt-1">PNG, JPG, GIF up to 10MB</span>
            </div>
          </Show>
          <input
            type="file"
            class="hidden"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </label>
      </div>
      
      {/* Grid */}
      <div class="card">
        <Show when={!media.loading} fallback={
          <div class="p-8 text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        }>
          <div class="p-6">
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <For each={media()}>
                {(item) => (
                  <div class="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={`/api/media/${item.id}`}
                      alt={item.alt || item.filename}
                      class="w-full h-full object-cover"
                    />
                    <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setEditModal(item)}
                        class="p-2 bg-white rounded-lg text-gray-700 hover:bg-gray-100"
                        title="Edit alt text"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteModal(item)}
                        class="p-2 bg-white rounded-lg text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
            
            <Show when={media()?.length === 0}>
              <div class="text-center py-12 text-gray-500">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p class="mt-2">No media files yet</p>
              </div>
            </Show>
          </div>
        </Show>
      </div>
      
      {/* Edit Modal */}
      <Modal
        isOpen={!!editModal()}
        onClose={() => setEditModal(null)}
        title="Edit Alt Text"
        footer={
          <>
            <button onClick={() => setEditModal(null)} class="btn btn-secondary flex-1">Cancel</button>
            <button onClick={handleUpdateAlt} disabled={saving()} class="btn btn-primary flex-1">
              {saving() ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <Show when={editModal()}>
          <div>
            <label class="label">Filename</label>
            <p class="text-sm text-gray-600 mb-4">{editModal()?.filename}</p>
            <label for="alt" class="label">Alt Text</label>
            <input
              id="alt"
              type="text"
              value={editModal()?.alt || ''}
              onInput={(e) => editModal() && setEditModal({ ...editModal()!, alt: e.currentTarget.value })}
              class="input"
              placeholder="Describe the image"
            />
            <p class="mt-1 text-xs text-gray-500">Used for accessibility and SEO</p>
          </div>
        </Show>
      </Modal>
      
      {/* Delete Modal */}
      <Modal
        isOpen={!!deleteModal()}
        onClose={() => setDeleteModal(null)}
        title="Delete Media"
        footer={
          <>
            <button onClick={() => setDeleteModal(null)} class="btn btn-secondary flex-1">Cancel</button>
            <button onClick={handleDelete} disabled={saving()} class="btn btn-danger flex-1">
              {saving() ? 'Deleting...' : 'Delete'}
            </button>
          </>
        }
      >
        <Show when={deleteModal()}>
          <p class="text-gray-700">
            Are you sure you want to delete <strong>{deleteModal()?.filename}</strong>?
          </p>
        </Show>
      </Modal>
    </div>
  );
}
