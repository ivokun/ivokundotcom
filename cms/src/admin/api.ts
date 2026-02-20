export { api };
export type { ApiResponse, PaginatedResponse };

const API_BASE = (import.meta.env['VITE_API_BASE'] as string | undefined) || '/admin/api';

interface ApiResponse<T> {
  data: T;
  error?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Authentication is handled by HttpOnly session cookies set by the server.
// No client-side token management needed.

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  // Build headers — skip Content-Type for FormData (browser sets multipart boundary)
  const isFormData = options.body instanceof FormData;
  const baseHeaders: Record<string, string> = isFormData
    ? {}
    : { 'Content-Type': 'application/json' };

  // Merge custom headers
  if (options.headers) {
    const customHeaders = options.headers as Record<string, string>;
    Object.assign(baseHeaders, customHeaders);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: baseHeaders,
      credentials: 'same-origin',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error');
  }
}

// Auth
// Server returns { user, session_id } and sets HttpOnly session cookie
async function login(email: string, password: string) {
  return request<{ session_id: string; user: { id: string; email: string; name: string } }>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

async function logout() {
  return request('/logout', { method: 'POST' });
}

async function getCurrentUser() {
  return request<{ id: string; email: string; name: string }>('/me');
}

// Categories
async function getCategories() {
  return request<PaginatedResponse<{ id: string; name: string; slug: string; createdAt: string }>>('/categories');
}

async function getCategory(id: string) {
  return request<{ id: string; name: string; slug: string; createdAt: string }>(`/categories/${id}`);
}

async function createCategory(data: { name: string; slug?: string }) {
  return request('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function updateCategory(id: string, data: { name: string; slug?: string }) {
  return request(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function deleteCategory(id: string) {
  return request(`/categories/${id}`, { method: 'DELETE' });
}

// Posts
async function getPosts(params?: { status?: string; locale?: string; categoryId?: string; page?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.locale) searchParams.set('locale', params.locale);
  if (params?.categoryId) searchParams.set('categoryId', params.categoryId);
  if (params?.page) searchParams.set('page', params.page.toString());
  
  const query = searchParams.toString();
  return request<PaginatedResponse<{
    id: string;
    title: string;
    slug: string;
    status: string;
    locale: string;
    categoryId: string | null;
    featuredImageId: string | null;
    publishedAt: string | null;
    createdAt: string;
  }>>(`/posts${query ? `?${query}` : ''}`);
}

async function getPost(id: string) {
  return request<{
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    status: string;
    locale: string;
    categoryId: string | null;
    featuredImageId: string | null;
    publishedAt: string | null;
    keywords: string[];
    createdAt: string;
    updatedAt: string;
  }>(`/posts/${id}`);
}

async function createPost(data: {
  title: string;
  slug?: string;
  content: string;
  excerpt?: string;
  status: string;
  locale: string;
  categoryId?: string;
  featuredImageId?: string;
  keywords?: string[];
}) {
  // Transform camelCase to snake_case for backend
  // Parse content as TipTap JSON if it's a string
  const payload = {
    title: data.title,
    slug: data.slug,
    content: data.content ? (typeof data.content === 'string' ? JSON.parse(data.content) : data.content) : undefined,
    excerpt: data.excerpt,
    locale: data.locale,
    status: data.status,
    category_id: data.categoryId,
    featured_image: data.featuredImageId,
    keywords: data.keywords,
  };
  return request('/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function updatePost(id: string, data: Partial<{
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: string;
  locale: string;
  categoryId: string;
  featuredImageId: string;
  keywords: string[];
}>) {
  // Transform camelCase to snake_case for backend
  const payload: Record<string, unknown> = {};
  if (data.title !== undefined) payload['title'] = data.title;
  if (data.slug !== undefined) payload['slug'] = data.slug;
  if (data.content !== undefined) {
    payload['content'] = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
  }
  if (data.excerpt !== undefined) payload['excerpt'] = data.excerpt;
  if (data.locale !== undefined) payload['locale'] = data.locale;
  if (data.categoryId !== undefined) payload['category_id'] = data.categoryId;
  if (data.featuredImageId !== undefined) payload['featured_image'] = data.featuredImageId;
  if (data.status !== undefined) payload['status'] = data.status;
  if (data.keywords !== undefined) payload['keywords'] = data.keywords;

  return request(`/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

async function deletePost(id: string) {
  return request(`/posts/${id}`, { method: 'DELETE' });
}

async function publishPost(id: string) {
  return request(`/posts/${id}/publish`, { method: 'POST' });
}

async function unpublishPost(id: string) {
  return request(`/posts/${id}/unpublish`, { method: 'POST' });
}

// Galleries
async function getGalleries(params?: { status?: string; page?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.page) searchParams.set('page', params.page.toString());
  
  const query = searchParams.toString();
  return request<PaginatedResponse<{
    id: string;
    title: string;
    slug: string;
    status: string;
    imageCount: number;
    publishedAt: string | null;
    createdAt: string;
  }>>(`/galleries${query ? `?${query}` : ''}`);
}

async function getGallery(id: string) {
  return request<{
    id: string;
    title: string;
    slug: string;
    description: string;
    status: string;
    images: Array<{ id: string; mediaId: string; order: number }>;
    publishedAt: string | null;
    createdAt: string;
  }>(`/galleries/${id}`);
}

async function createGallery(data: {
  title: string;
  slug?: string;
  description?: string;
  status: string;
  images?: Array<{ mediaId: string; order: number }>;
}) {
  return request('/galleries', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function updateGallery(id: string, data: Partial<{
  title: string;
  slug: string;
  description: string;
  status: string;
  images: Array<{ id: string; mediaId: string; order: number }>;
}>) {
  return request(`/galleries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function deleteGallery(id: string) {
  return request(`/galleries/${id}`, { method: 'DELETE' });
}

async function publishGallery(id: string) {
  return request(`/galleries/${id}/publish`, { method: 'POST' });
}

async function unpublishGallery(id: string) {
  return request(`/galleries/${id}/unpublish`, { method: 'POST' });
}

// Media
async function getMedia() {
  return request<PaginatedResponse<{
    id: string;
    filename: string;
    mime_type: string;
    size: number;
    alt: string | null;
    urls: { original: string; thumbnail: string; small: string; large: string } | null;
    status: 'uploading' | 'processing' | 'ready' | 'failed';
    created_at: string;
  }>>('/media');
}

async function getMediaById(id: string) {
  return request<{
    id: string;
    filename: string;
    mime_type: string;
    size: number;
    alt: string | null;
    urls: { original: string; thumbnail: string; small: string; large: string } | null;
    status: 'uploading' | 'processing' | 'ready' | 'failed';
    created_at: string;
  }>(`/media/${id}`);
}

/**
 * Upload a file via presigned URL:
 * 1. POST /media/upload → get presignedUrl + mediaId
 * 2. PUT file directly to presigned URL (browser → R2)
 * 3. POST /media/:id/uploaded → confirm + kick off processing
 */
async function uploadMedia(
  file: File,
  alt?: string,
  onProgress?: (pct: number) => void
): Promise<{ id: string; status: string }> {
  // Step 1: Get presigned URL
  const { uploadUrl, mediaId } = await request<{
    mediaId: string;
    uploadUrl: string;
    uploadKey: string;
  }>('/media/upload', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      alt,
    }),
  });

  // Step 2: Upload directly to R2 via presigned URL
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed: network error'));
    xhr.send(file);
  });

  // Step 3: Confirm upload, trigger processing
  const media = await request<{ id: string; status: string }>(`/media/${mediaId}/uploaded`, {
    method: 'POST',
  });

  return media;
}

async function updateMedia(id: string, data: { alt?: string }) {
  return request(`/media/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function deleteMedia(id: string) {
  return request(`/media/${id}`, { method: 'DELETE' });
}

// Home Page
async function getHomePage() {
  return request<{
    id: string;
    heroImageId: string | null;
    description: string;
    keywords: string[];
    updatedAt: string;
  }>('/home');
}

async function updateHomePage(data: {
  heroImageId?: string;
  description?: string;
  keywords?: string[];
}) {
  return request('/home', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// API Keys
async function getApiKeys() {
  return request<Array<{
    id: string;
    name: string;
    key: string;
    createdAt: string;
    lastUsedAt: string | null;
  }>>('/api-keys');
}

async function createApiKey(data: { name: string }) {
  return request<{ id: string; key: string; name: string; createdAt: string }>('/api-keys', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function deleteApiKey(id: string) {
  return request(`/api-keys/${id}`, { method: 'DELETE' });
}

// Combined export
const api = {
  auth: {
    login,
    logout,
    getCurrentUser,
  },
  categories: {
    list: getCategories,
    get: getCategory,
    create: createCategory,
    update: updateCategory,
    delete: deleteCategory,
  },
  posts: {
    list: getPosts,
    get: getPost,
    create: createPost,
    update: updatePost,
    delete: deletePost,
    publish: publishPost,
    unpublish: unpublishPost,
  },
  galleries: {
    list: getGalleries,
    get: getGallery,
    create: createGallery,
    update: updateGallery,
    delete: deleteGallery,
    publish: publishGallery,
    unpublish: unpublishGallery,
  },
  media: {
    list: getMedia,
    get: getMediaById,
    upload: uploadMedia,
    update: updateMedia,
    delete: deleteMedia,
  },
  home: {
    get: getHomePage,
    update: updateHomePage,
  },
  apiKeys: {
    list: getApiKeys,
    create: createApiKey,
    delete: deleteApiKey,
  },
};
