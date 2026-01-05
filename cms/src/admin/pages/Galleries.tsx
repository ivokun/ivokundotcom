import { createSignal, createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { api } from '../api';
import Modal from '../components/Modal';

interface Gallery {
  id: string;
  title: string;
  slug: string;
  status: string;
  imageCount: number;
  publishedAt: string | null;
  createdAt: string;
}

export default function Galleries() {
  const [statusFilter, setStatusFilter] = createSignal('all');
  const [galleries, { refetch }] = createResource(
    async () => {
      const params: Record<string, string> = {};
      if (statusFilter() !== 'all') params['status'] = statusFilter();
      const result = await api.galleries.list(params);
      return result.data as Gallery[];
    }
  );
  
  const [deleteModal, setDeleteModal] = createSignal<Gallery | null>(null);
  const [publishModal, setPublishModal] = createSignal<Gallery | null>(null);
  const [unpublishModal, setUnpublishModal] = createSignal<Gallery | null>(null);
  const [processing, setProcessing] = createSignal(false);
  
  async function handleDelete() {
    const gallery = deleteModal();
    if (!gallery) return;
    
    setProcessing(true);
    try {
      await api.galleries.delete(gallery.id);
      setDeleteModal(null);
      refetch();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setProcessing(false);
    }
  }
  
  async function handlePublish() {
    const gallery = publishModal();
    if (!gallery) return;
    
    setProcessing(true);
    try {
      await api.galleries.publish(gallery.id);
      setPublishModal(null);
      refetch();
    } catch (err) {
      console.error('Publish failed:', err);
    } finally {
      setProcessing(false);
    }
  }
  
  async function handleUnpublish() {
    const gallery = unpublishModal();
    if (!gallery) return;
    
    setProcessing(true);
    try {
      await api.galleries.unpublish(gallery.id);
      setUnpublishModal(null);
      refetch();
    } catch (err) {
      console.error('Unpublish failed:', err);
    } finally {
      setProcessing(false);
    }
  }
  
  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  
  return (
    <div class="p-8">
      <div class="page-header flex justify-between items-center">
        <div>
          <h1 class="page-title">Galleries</h1>
          <p class="page-subtitle">Manage photo galleries</p>
        </div>
        <A href="/galleries/new" class="btn btn-primary">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Gallery
        </A>
      </div>
      
      {/* Filter */}
      <div class="card p-4 mb-6">
        <label class="label">Status</label>
        <select
          value={statusFilter()}
          onChange={(e) => setStatusFilter(e.currentTarget.value)}
          class="input w-48"
        >
          <option value="all">All</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>
      
      {/* Grid */}
      <div class="card">
        <Show when={!galleries.loading} fallback={
          <div class="p-8 text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        }>
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <For each={galleries()}>
                {(gallery) => (
                  <div class="border border-gray-200 rounded-lg overflow-hidden">
                    <div class="aspect-video bg-gray-100 flex items-center justify-center">
                      <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div class="p-4">
                      <div class="flex items-start justify-between">
                        <div>
                          <h3 class="font-semibold text-gray-900">{gallery.title}</h3>
                          <p class="text-sm text-gray-500">{gallery.imageCount} images</p>
                        </div>
                        <span class={`badge ${
                          gallery.status === 'published' ? 'badge-success' : 'badge-warning'
                        }`}>
                          {gallery.status}
                        </span>
                      </div>
                      <p class="text-xs text-gray-400 mt-2">{formatDate(gallery.createdAt)}</p>
                      
                      <div class="flex items-center gap-2 mt-4">
                        <A href={`/galleries/${gallery.id}`} class="btn btn-secondary btn-sm flex-1">
                          Edit
                        </A>
                        {gallery.status === 'draft' ? (
                          <button
                            onClick={() => setPublishModal(gallery)}
                            class="btn btn-primary btn-sm"
                          >
                            Publish
                          </button>
                        ) : (
                          <button
                            onClick={() => setUnpublishModal(gallery)}
                            class="btn btn-secondary btn-sm"
                          >
                            Unpublish
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteModal(gallery)}
                          class="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
            
            <Show when={galleries()?.length === 0}>
              <div class="text-center py-12 text-gray-500">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p class="mt-2">No galleries yet</p>
              </div>
            </Show>
          </div>
        </Show>
      </div>
      
      {/* Modals */}
      <Modal
        isOpen={!!deleteModal()}
        onClose={() => setDeleteModal(null)}
        title="Delete Gallery"
        footer={
          <>
            <button onClick={() => setDeleteModal(null)} class="btn btn-secondary flex-1">Cancel</button>
            <button onClick={handleDelete} disabled={processing()} class="btn btn-danger flex-1">
              {processing() ? 'Deleting...' : 'Delete'}
            </button>
          </>
        }
      >
        <p class="text-gray-700">Are you sure you want to delete <strong>{deleteModal()?.title}</strong>?</p>
      </Modal>
      
      <Modal
        isOpen={!!publishModal()}
        onClose={() => setPublishModal(null)}
        title="Publish Gallery"
        footer={
          <>
            <button onClick={() => setPublishModal(null)} class="btn btn-secondary flex-1">Cancel</button>
            <button onClick={handlePublish} disabled={processing()} class="btn btn-primary flex-1">
              {processing() ? 'Publishing...' : 'Publish'}
            </button>
          </>
        }
      >
        <p class="text-gray-700">Are you sure you want to publish <strong>{publishModal()?.title}</strong>?</p>
      </Modal>
      
      <Modal
        isOpen={!!unpublishModal()}
        onClose={() => setUnpublishModal(null)}
        title="Unpublish Gallery"
        footer={
          <>
            <button onClick={() => setUnpublishModal(null)} class="btn btn-secondary flex-1">Cancel</button>
            <button onClick={handleUnpublish} disabled={processing()} class="btn btn-primary flex-1">
              {processing() ? 'Unpublishing...' : 'Unpublish'}
            </button>
          </>
        }
      >
        <p class="text-gray-700">Are you sure you want to unpublish <strong>{unpublishModal()?.title}</strong>?</p>
      </Modal>
    </div>
  );
}
