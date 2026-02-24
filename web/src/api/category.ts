import { cmsFetch, type PaginatedResponse, type Category } from './cms';

export type { Category };

export interface CategoryListParams {
  limit?: number;
  offset?: number;
}

export async function fetchCategories(params?: CategoryListParams): Promise<PaginatedResponse<Category>> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.offset) queryParams.set('offset', String(params.offset));

  const query = queryParams.toString();
  return cmsFetch<PaginatedResponse<Category>>(`api/categories${query ? `?${query}` : ''}`);
}

export async function fetchCategoryBySlug(slug: string): Promise<Category> {
  return cmsFetch<Category>(`api/categories/${slug}`);
}

// Helper to format category name (lowercase for data-filtering, uppercase for display)
export function formatCategoryName(name: string, toUpperCase = false): string {
  return toUpperCase ? name.toUpperCase() : name.toLowerCase();
}
