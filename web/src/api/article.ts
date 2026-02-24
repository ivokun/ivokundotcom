import { cmsFetch, type PaginatedResponse, type Category, type Media, type TipTapDocument } from './cms';

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: TipTapDocument | null;
  featured_image: string | null;
  read_time_minute: number | null;
  category_id: string | null;
  locale: 'en' | 'id';
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // Resolved relations from CMS
  category: Category | null;
  featured_media: Media | null;
}

export type ArticleWithRelations = Article;

export interface ArticleListParams {
  limit?: number;
  offset?: number;
  locale?: 'en' | 'id';
  category_id?: string;
}

export async function fetchArticles(params?: ArticleListParams): Promise<PaginatedResponse<Article>> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.offset) queryParams.set('offset', String(params.offset));
  if (params?.locale) queryParams.set('locale', params.locale);
  if (params?.category_id) queryParams.set('category_id', params.category_id);

  const query = queryParams.toString();
  return cmsFetch<PaginatedResponse<Article>>(`api/posts${query ? `?${query}` : ''}`);
}

export async function fetchArticleBySlug(slug: string, locale?: 'en' | 'id'): Promise<Article> {
  const queryParams = new URLSearchParams();
  if (locale) queryParams.set('locale', locale);

  const query = queryParams.toString();
  return cmsFetch<Article>(`api/posts/${slug}${query ? `?${query}` : ''}`);
}

// Helper to get the best image URL from media
export function getImageUrl(media: Media | null | undefined, size: 'original' | 'thumbnail' | 'small' | 'large' = 'large'): string | null {
  if (!media?.urls) return null;
  return media.urls[size];
}

// Helper to format read time
export function formatReadTime(minutes: number | null | undefined): string {
  if (!minutes) return 'Quick read';
  return `${minutes} min read`;
}
