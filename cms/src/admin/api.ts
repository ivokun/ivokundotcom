export { api };
export type { ApiResponse, PaginatedResponse };

const API_BASE = (import.meta.env['VITE_API_BASE'] as string | undefined) || '/admin/api';

interface ApiResponse<T> {
  data: T;
  error?: string;
}

interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
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
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `HTTP ${response.status}`);
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
async function getCategories(params?: { page?: number; pageSize?: number }) {
  const pageSize = params?.pageSize ?? 100;
  const page = params?.page ?? 1;
  const offset = (page - 1) * pageSize;
  const searchParams = new URLSearchParams();
  searchParams.set('limit', pageSize.toString());
  searchParams.set('offset', offset.toString());
  return request<
    PaginatedResponse<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    }>
  >(`/categories?${searchParams.toString()}`);
}

async function getCategory(id: string) {
  return request<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    created_at: string;
    updated_at: string;
  }>(`/categories/${id}`);
}

async function createCategory(data: { name: string; slug?: string; description?: string }) {
  return request<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    created_at: string;
    updated_at: string;
  }>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function updateCategory(
  id: string,
  data: { name?: string; slug?: string; description?: string | null }
) {
  return request<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    created_at: string;
    updated_at: string;
  }>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

async function deleteCategory(id: string) {
  return request(`/categories/${id}`, { method: 'DELETE' });
}

// Posts
async function getPosts(params?: {
  status?: string;
  locale?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}) {
  const pageSize = params?.pageSize ?? 20;
  const page = params?.page ?? 1;
  const offset = (page - 1) * pageSize;
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.locale) searchParams.set('locale', params.locale);
  if (params?.categoryId) searchParams.set('category_id', params.categoryId);
  searchParams.set('limit', pageSize.toString());
  searchParams.set('offset', offset.toString());

  const query = searchParams.toString();
  return request<PaginatedResponse<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: object | null;
    status: string;
    locale: string;
    category_id: string | null;
    featured_image: string | null;
    published_at: string | null;
    created_at: string;
    updated_at: string;
    read_time_minute: number | null;
    category: {
      id: string;
      name: string;
      slug: string;
    } | null;
    featured_media: {
      id: string;
      filename: string;
      urls: { original: string; thumbnail: string; small: string; large: string } | null;
      alt: string | null;
    } | null;
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
    category_id: string | null;
    featured_image: string | null;
    featured_media: {
      id: string;
      filename: string;
      urls: { original: string; thumbnail: string; small: string; large: string } | null;
      alt: string | null;
    } | null;
    published_at: string | null;
    keywords: string[];
    created_at: string;
    updated_at: string;
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
  let parsedContent: object | null = null;
  if (data.content) {
    try {
      parsedContent = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
    } catch (e) {
      console.error('Failed to parse content as JSON:', e);
      parsedContent = null;
    }
  }
  
  const payload = {
    title: data.title,
    slug: data.slug,
    content: parsedContent,
    excerpt: data.excerpt || null,
    locale: data.locale || 'en',
    category_id: data.categoryId || null,
    featured_image: data.featuredImageId || null,
    keywords: data.keywords || [],
  };
  
  const response = await request<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: object | null;
    status: string;
    locale: string;
    category_id: string | null;
    featured_image: string | null;
    published_at: string | null;
    read_time_minute: number | null;
    created_at: string;
    updated_at: string;
  }>('/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response;
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
  if (data.content !== undefined && data.content !== '') {
    // Only parse and send content if it's not empty
    try {
      payload['content'] = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
    } catch (e) {
      console.error('Failed to parse content:', e);
      // If parsing fails, send null
      payload['content'] = null;
    }
  }
  if (data.excerpt !== undefined) payload['excerpt'] = data.excerpt || null;
  if (data.locale !== undefined) payload['locale'] = data.locale;
  if (data.categoryId !== undefined) payload['category_id'] = data.categoryId || null;
  if (data.featuredImageId !== undefined) payload['featured_image'] = data.featuredImageId || null;
  if (data.status !== undefined) payload['status'] = data.status;
  if (data.keywords !== undefined) payload['keywords'] = data.keywords || [];

  const response = await request<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: object | null;
    status: string;
    locale: string;
    category_id: string | null;
    featured_image: string | null;
    published_at: string | null;
    read_time_minute: number | null;
    created_at: string;
    updated_at: string;
  }>(`/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return response;
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
async function getGalleries(params?: { status?: string; page?: number; pageSize?: number }) {
  const pageSize = params?.pageSize ?? 20;
  const page = params?.page ?? 1;
  const offset = (page - 1) * pageSize;
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  searchParams.set('limit', pageSize.toString());
  searchParams.set('offset', offset.toString());

  const query = searchParams.toString();
  return request<PaginatedResponse<{
    id: string;
    title: string;
    slug: string;
    status: string;
    image_count: number;
    published_at: string | null;
    created_at: string;
  }>>(`/galleries${query ? `?${query}` : ''}`);
}

async function getGallery(id: string) {
  return request<{
    id: string;
    title: string;
    slug: string;
    description: string;
    status: string;
    category_id: string | null;
    images: Array<{ id: string; mediaId: string; order: number }>;
    published_at: string | null;
    created_at: string;
    updated_at: string;
  }>(`/galleries/${id}`);
}

async function createGallery(data: {
  title: string;
  slug?: string;
  description?: string;
  status: string;
  categoryId?: string;
  images?: Array<{ mediaId: string; order: number }>;
}) {
  // Transform camelCase to snake_case for backend
  const payload = {
    title: data.title,
    slug: data.slug,
    description: data.description,
    status: data.status,
    category_id: data.categoryId,
    images: data.images,
  };

  return request<{ id: string; title: string; slug: string; status: string; created_at: string }>('/galleries', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function updateGallery(id: string, data: Partial<{
  title: string;
  slug: string;
  description: string;
  status: string;
  categoryId?: string;
  images: Array<{ id: string; mediaId: string; order: number }>;
}>) {
  // Transform camelCase to snake_case for backend
  const payload: Record<string, unknown> = {};
  if (data.title !== undefined) payload['title'] = data.title;
  if (data.slug !== undefined) payload['slug'] = data.slug;
  if (data.description !== undefined) payload['description'] = data.description;
  if (data.status !== undefined) payload['status'] = data.status;
  if (data.categoryId !== undefined) payload['category_id'] = data.categoryId;
  if (data.images !== undefined) payload['images'] = data.images;

  return request<{ id: string; title: string; slug: string; status: string; updated_at: string }>(`/galleries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
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
// Note: Backend returns upload_key but this should be excluded - it's leaked in responses
async function getMedia(params?: { page?: number; pageSize?: number }) {
  const pageSize = params?.pageSize ?? 50;
  const page = params?.page ?? 1;
  const offset = (page - 1) * pageSize;
  const searchParams = new URLSearchParams();
  searchParams.set('limit', pageSize.toString());
  searchParams.set('offset', offset.toString());

  const query = searchParams.toString();
  return request<PaginatedResponse<{
    id: string;
    filename: string;
    mime_type: string;
    size: number;
    alt: string | null;
    urls: { original: string; thumbnail: string; small: string; large: string } | null;
    width: number | null;
    height: number | null;
    status: 'uploading' | 'processing' | 'ready' | 'failed';
    created_at: string;
  }>>(`/media${query ? `?${query}` : ''}`);
}

async function getMediaById(id: string) {
  return request<{
    id: string;
    filename: string;
    mime_type: string;
    size: number;
    alt: string | null;
    urls: { original: string; thumbnail: string; small: string; large: string } | null;
    width: number | null;
    height: number | null;
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
): Promise<{
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  alt: string | null;
  urls: { original: string; thumbnail: string; small: string; large: string } | null;
  width: number | null;
  height: number | null;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  created_at: string;
}> {
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
  const media = await request<{
    id: string;
    filename: string;
    mime_type: string;
    size: number;
    alt: string | null;
    urls: { original: string; thumbnail: string; small: string; large: string } | null;
    width: number | null;
    height: number | null;
    status: 'uploading' | 'processing' | 'ready' | 'failed';
    created_at: string;
  }>(`/media/${mediaId}/uploaded`, {
    method: 'POST',
  });

  return media;
}

async function updateMedia(id: string, data: { alt?: string }) {
  return request(`/media/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

async function deleteMedia(id: string) {
  return request(`/media/${id}`, { method: 'DELETE' });
}

// Home Page
async function getHomePage() {
  const home = await request<{
    id: string;
    title: string | null;
    short_description: string | null;
    hero: string | null;
    description: string | object | null;
    keywords: string[];
    updated_at: string;
  }>('/home');
  return {
    id: home.id,
    title: home.title || '',
    shortDescription: home.short_description || '',
    heroImageId: home.hero || '',
    description: home.description
      ? typeof home.description === 'object'
        ? JSON.stringify(home.description)
        : home.description
      : '',
    keywords: home.keywords || [],
    updatedAt: home.updated_at,
  };
}

async function updateHomePage(data: {
  title?: string;
  shortDescription?: string;
  heroImageId?: string;
  description?: string;
  keywords?: string[];
}) {
  const payload: Record<string, unknown> = {};
  if (data.title !== undefined) payload['title'] = data.title || null;
  if (data.shortDescription !== undefined) payload['short_description'] = data.shortDescription || null;
  if (data.heroImageId !== undefined) payload['hero'] = data.heroImageId || null;
  if (data.description !== undefined) {
    try {
      payload['description'] = data.description ? JSON.parse(data.description) : null;
    } catch {
      payload['description'] = null;
    }
  }
  if (data.keywords !== undefined) payload['keywords'] = data.keywords.join(',') || null;
  return request('/home', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// API Keys
async function getApiKeys() {
  const response = await request<{ data: Array<{
    id: string;
    name: string;
    prefix: string;
    created_at: string;
    last_used_at: string | null;
  }> }>('/api-keys');
  return response.data;
}

async function createApiKey(data: { name: string }) {
  const response = await request<{ data: { id: string; key: string; name: string; prefix: string; created_at: string; last_used_at: string | null } }>('/api-keys', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

async function deleteApiKey(id: string) {
  return request(`/api-keys/${id}`, { method: 'DELETE' });
}

// Users
async function getUsers() {
  return request<{ data: Array<{ id: string; email: string; name: string | null; created_at: string }> }>('/users');
}

async function inviteUser(data: { name: string; email: string }) {
  return request<{ id: string; email: string; name: string | null; initialPassword: string; created_at: string }>('/users/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function deleteUser(id: string) {
  return request(`/users/${id}`, { method: 'DELETE' });
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
  users: {
    list: getUsers,
    invite: inviteUser,
    delete: deleteUser,
  },
};
