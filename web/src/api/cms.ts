// Shared CMS API fetch utility
// Uses X-API-Key header instead of Authorization bearer token

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaUrls {
  original: string;
  thumbnail: string;
  small: string;
  large: string;
}

export interface Media {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  alt: string | null;
  urls: MediaUrls | null;
  width: number | null;
  height: number | null;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  created_at: string;
}

export interface TipTapDocument {
  type: 'doc';
  content: TipTapNode[];
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

const CMS_API_URL = import.meta.env.CMS_API_URL;
const CMS_API_TOKEN = import.meta.env.CMS_API_TOKEN;

export async function cmsFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!CMS_API_URL) {
    throw new Error('CMS_API_URL environment variable is not set');
  }
  if (!CMS_API_TOKEN) {
    throw new Error('CMS_API_TOKEN environment variable is not set');
  }

  // Remove leading slash if present
  const path = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${CMS_API_URL}/${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CMS_API_TOKEN,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CMS API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}
