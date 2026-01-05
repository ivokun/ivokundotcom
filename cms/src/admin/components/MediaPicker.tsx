import { createSignal, createEffect, Show, For, onCleanup } from 'solid-js';
import { api } from '../api';

interface MediaItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  alt: string | null;
  createdAt: string;
}

interface MediaPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (media: MediaItem) => void;
  multiple?: boolean;
}

// Allowed image types for validation
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export default function MediaPicker(props: MediaPickerProps) {
  const [media, setMedia] = createSignal<MediaItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [uploading, setUploading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  
  // Handle Escape key to close modal
  createEffect(() => {
    if (!props.isOpen) return;
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        props.onClose();
      }
    };
    
    document.addEventListener('keydown', handleEsc);
    onCleanup(() => document.removeEventListener('keydown', handleEsc));
  });
  
  async function loadMedia() {
    setLoading(true);
    try {
      const result = await api.media.list();
      setMedia(result.data);
    } catch (err) {
      console.error('Failed to load media:', err);
    } finally {
      setLoading(false);
    }
  }
  
  createEffect(() => {
    if (props.isOpen) {
      loadMedia();
    }
  });
  
  async function handleUpload(file: File) {
    setError(null);
    
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
      return;
    }
    
    setUploading(true);
    try {
      const uploaded = await api.media.upload(file);
      const newItem: MediaItem = { ...uploaded, createdAt: new Date().toISOString() };
      setMedia((prev) => [newItem, ...prev]);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }
  
  function handleSelect(item: MediaItem) {
    props.onSelect(item);
    props.onClose();
  }
  
  return (
    <div class="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div class="flex min-h-full items-center justify-center p-4 text-center">
        <div
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={props.onClose}
          aria-hidden="true"
        />
        
        <div class="relative w-full max-w-3xl bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900">Select Media</h3>
            <button
              onClick={props.onClose}
              class="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Error display */}
          <Show when={error()}>
            <div class="px-4 py-2 bg-red-50 border-b border-red-200 text-red-600 text-sm">
              {error()}
            </div>
          </Show>
          
          {/* Upload */}
          <div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <label class="flex items-center justify-center w-full h-20 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-lg appearance-none cursor-pointer hover:border-gray-400 focus:outline-none">
              <Show when={!uploading()} fallback={
                <div class="flex items-center gap-2">
                  <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" aria-hidden="true"></div>
                  <span class="text-sm text-gray-500">Uploading...</span>
                </div>
              }>
                <div class="flex flex-col items-center">
                  <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span class="text-sm text-gray-500 mt-1">Click to upload or drag and drop</span>
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
          <div class="px-4 py-4 max-h-96 overflow-y-auto">
            <Show when={loading()}>
              <div class="flex items-center justify-center py-12">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            </Show>
            
            <Show when={!loading()}>
              <div class="grid grid-cols-4 gap-4">
                <For each={media()}>
                  {(item) => (
                    <button
                      class="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-transparent hover:border-gray-300 transition-colors"
                      onClick={() => handleSelect(item)}
                    >
                      <img
                        src={`/api/media/${item.id}`}
                        alt={item.alt || item.filename}
                        class="w-full h-full object-cover"
                      />
                      <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-end p-2">
                        <span class="text-xs text-white truncate drop-shadow-md">
                          {item.alt || item.filename}
                        </span>
                      </div>
                    </button>
                  )}
                </For>
              </div>
              
              <Show when={media().length === 0}>
                <div class="text-center py-12 text-gray-500">
                  <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p class="mt-2">No media files yet</p>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
