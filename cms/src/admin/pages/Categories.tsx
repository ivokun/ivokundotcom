import { createSignal, createResource, For, Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { api } from '../api';
import Modal from '../components/Modal';

interface Category {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export default function Categories() {
  const [categories, { refetch }] = createResource(async () => {
    const result = await api.categories.list();
    return result.data as Category[];
  });
  
  const [deleteModal, setDeleteModal] = createSignal<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = createSignal(false);
  
  async function handleDelete() {
    const item = deleteModal();
    if (!item) return;
    
    setDeleting(true);
    try {
      await api.categories.delete(item.id);
      setDeleteModal(null);
      refetch();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
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
          <h1 class="page-title">Categories</h1>
          <p class="page-subtitle">Manage your content categories</p>
        </div>
        <A href="/categories/new" class="btn btn-primary">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Category
        </A>
      </div>
      
      <div class="card">
        <Show when={!categories.loading} fallback={
          <div class="p-8 text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        }>
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Created</th>
                  <th class="w-24">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <For each={categories()}>
                  {(category) => (
                    <tr>
                      <td class="font-medium">{category.name}</td>
                      <td class="text-gray-500">{category.slug}</td>
                      <td class="text-gray-500">{formatDate(category.createdAt)}</td>
                      <td>
                        <div class="flex items-center gap-2">
                          <A href={`/categories/${category.id}`} class="text-primary-600 hover:text-primary-800">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </A>
                          <button
                            onClick={() => setDeleteModal({ id: category.id, name: category.name })}
                            class="text-red-600 hover:text-red-800"
                          >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
          
          <Show when={categories()?.length === 0}>
            <div class="p-12 text-center text-gray-500">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p class="mt-2">No categories yet</p>
              <A href="/categories/new" class="mt-4 inline-block btn btn-primary btn-sm">Create your first category</A>
            </div>
          </Show>
        </Show>
      </div>
      
      <Modal
        isOpen={!!deleteModal()}
        onClose={() => setDeleteModal(null)}
        title="Delete Category"
        footer={
          <>
            <button
              onClick={() => setDeleteModal(null)}
              class="btn btn-secondary sm:flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting()}
              class="btn btn-danger sm:flex-1"
            >
              {deleting() ? 'Deleting...' : 'Delete'}
            </button>
          </>
        }
      >
        <p class="text-gray-700">
          Are you sure you want to delete <strong>{deleteModal()?.name}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
