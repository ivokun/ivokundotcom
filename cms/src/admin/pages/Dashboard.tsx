import { createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { api } from '../api';

export default function Dashboard() {
  const [stats] = createResource(async () => {
    const [posts, categories, galleries] = await Promise.all([
      api.posts.list({ status: 'published' }),
      api.categories.list(),
      api.galleries.list({ status: 'published' }),
    ]);
    return {
      posts: posts.total,
      categories: categories.total,
      galleries: galleries.total,
    };
  });
  
  return (
    <div class="p-8">
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Overview of your content</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="card p-6">
          <div class="flex items-center">
            <div class="p-3 bg-primary-100 rounded-lg">
              <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm text-gray-500">Published Posts</p>
              <p class="text-2xl font-bold text-gray-900">{stats()?.posts ?? '-'}</p>
            </div>
          </div>
        </div>
        
        <div class="card p-6">
          <div class="flex items-center">
            <div class="p-3 bg-green-100 rounded-lg">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm text-gray-500">Categories</p>
              <p class="text-2xl font-bold text-gray-900">{stats()?.categories ?? '-'}</p>
            </div>
          </div>
        </div>
        
        <div class="card p-6">
          <div class="flex items-center">
            <div class="p-3 bg-purple-100 rounded-lg">
              <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm text-gray-500">Published Galleries</p>
              <p class="text-2xl font-bold text-gray-900">{stats()?.galleries ?? '-'}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card">
          <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 class="font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div class="p-6 space-y-3">
            <A href="/posts/new" class="block p-4 rounded-lg border border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-colors">
              <div class="flex items-center gap-3">
                <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span class="font-medium text-gray-900">Create New Post</span>
              </div>
            </A>
            <A href="/categories/new" class="block p-4 rounded-lg border border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-colors">
              <div class="flex items-center gap-3">
                <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span class="font-medium text-gray-900">Add New Category</span>
              </div>
            </A>
            <A href="/galleries/new" class="block p-4 rounded-lg border border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-colors">
              <div class="flex items-center gap-3">
                <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span class="font-medium text-gray-900">Create New Gallery</span>
              </div>
            </A>
          </div>
        </div>
        
        <div class="card">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="font-semibold text-gray-900">Recent Posts</h2>
          </div>
          <div class="p-6">
            <p class="text-sm text-gray-500 text-center py-8">
              Navigate to Posts to see your content
            </p>
            <div class="text-center mt-4">
              <A href="/posts" class="btn btn-secondary btn-sm">View All Posts</A>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
