import { createSignal, createResource, For, Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { api } from '../api';
import Modal from '../components/Modal';

interface Post {
  id: string;
  title: string;
  slug: string;
  status: string;
  locale: string;
  categoryId: string | null;
  featuredImageId: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export default function Posts() {
  const [statusFilter, setStatusFilter] = createSignal('all');
  const [localeFilter, setLocaleFilter] = createSignal('all');
  const [posts, { refetch }] = createResource(
    async () => {
      const params: Record<string, string> = {};
      if (statusFilter() !== 'all') params['status'] = statusFilter();
      if (localeFilter() !== 'all') params['locale'] = localeFilter();
      const result = await api.posts.list(params);
      return result.data as Post[];
    }
  );
  
  const [deleteModal, setDeleteModal] = createSignal<Post | null>(null);
  const [publishModal, setPublishModal] = createSignal<Post | null>(null);
  const [unpublishModal, setUnpublishModal] = createSignal<Post | null>(null);
  const [processing, setProcessing] = createSignal(false);
  
  async function handleDelete() {
    const post = deleteModal();
    if (!post) return;
    
    setProcessing(true);
    try {
      await api.posts.delete(post.id);
      setDeleteModal(null);
      refetch();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setProcessing(false);
    }
  }
  
  async function handlePublish() {
    const post = publishModal();
    if (!post) return;
    
    setProcessing(true);
    try {
      await api.posts.publish(post.id);
      setPublishModal(null);
      refetch();
    } catch (err) {
      console.error('Publish failed:', err);
    } finally {
      setProcessing(false);
    }
  }
  
  async function handleUnpublish() {
    const post = unpublishModal();
    if (!post) return;
    
    setProcessing(true);
    try {
      await api.posts.unpublish(post.id);
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
          <h1 class="page-title">Posts</h1>
          <p class="page-subtitle">Manage your blog posts</p>
        </div>
        <A href="/posts/new" class="btn btn-primary">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Post
        </A>
      </div>
      
      {/* Filters */}
      <div class="card p-4 mb-6">
        <div class="flex gap-4">
          <div>
            <label class="label">Status</label>
            <select
              value={statusFilter()}
              onChange={(e) => setStatusFilter(e.currentTarget.value)}
              class="input"
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div>
            <label class="label">Locale</label>
            <select
              value={localeFilter()}
              onChange={(e) => setLocaleFilter(e.currentTarget.value)}
              class="input"
            >
              <option value="all">All</option>
              <option value="en">English</option>
              <option value="de">German</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Table */}
      <div class="card">
        <Show when={!posts.loading} fallback={
          <div class="p-8 text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        }>
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Locale</th>
                  <th>Created</th>
                  <th class="w-32">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <For each={posts()}>
                  {(post) => (
                    <tr>
                      <td class="font-medium">{post.title}</td>
                      <td>
                        <span class={`badge ${
                          post.status === 'published' ? 'badge-success' : 'badge-warning'
                        }`}>
                          {post.status}
                        </span>
                      </td>
                      <td class="text-gray-500 uppercase">{post.locale}</td>
                      <td class="text-gray-500">{formatDate(post.createdAt)}</td>
                      <td>
                        <div class="flex items-center gap-2">
                          <A href={`/posts/${post.id}`} class="text-primary-600 hover:text-primary-800">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </A>
                          {post.status === 'draft' ? (
                            <button
                              onClick={() => setPublishModal(post)}
                              class="text-green-600 hover:text-green-800"
                              title="Publish"
                            >
                              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => setUnpublishModal(post)}
                              class="text-yellow-600 hover:text-yellow-800"
                              title="Unpublish"
                            >
                              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteModal(post)}
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
          
          <Show when={posts()?.length === 0}>
            <div class="p-12 text-center text-gray-500">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p class="mt-2">No posts found</p>
            </div>
          </Show>
        </Show>
      </div>
      
      {/* Modals */}
      <Modal
        isOpen={!!deleteModal()}
        onClose={() => setDeleteModal(null)}
        title="Delete Post"
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
        title="Publish Post"
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
        title="Unpublish Post"
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
