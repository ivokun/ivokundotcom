import { cmsFetch, type PaginatedResponse, type Category, type Media } from './cms';

export interface Gallery {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  // CMS now returns resolved Media objects instead of string IDs
  images: Media[];
  category_id: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // Resolved relations from CMS
  category: Category | null;
}

export interface GalleryListParams {
  limit?: number;
  offset?: number;
}

export async function fetchGalleries(params?: GalleryListParams): Promise<PaginatedResponse<Gallery>> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.offset) queryParams.set('offset', String(params.offset));

  const query = queryParams.toString();
  return cmsFetch<PaginatedResponse<Gallery>>(`api/galleries${query ? `?${query}` : ''}`);
}

export async function fetchGalleryBySlug(slug: string): Promise<Gallery> {
  return cmsFetch<Gallery>(`api/galleries/${slug}`);
}

// Component-friendly gallery item format
export interface GalleryItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  imageUrl: string;
  formats: {
    large: string;
    medium: string;
    small: string;
    thumbnail: string;
  };
  description?: string;
}

// Helper function to convert Gallery API response to GalleryItems for the component
export function convertToGalleryItems(galleries: Gallery[]): GalleryItem[] {
  return galleries.flatMap((gallery) => {
    const category = gallery.category?.name?.toLowerCase() ?? 'uncategorized';

    return gallery.images.map((image) => {
      // Use media urls if available, fallback to empty strings
      const urls = image.urls ?? {
        original: '',
        thumbnail: '',
        small: '',
        large: '',
      };

      return {
        id: image.id,
        slug: gallery.slug,
        title: gallery.title,
        category,
        imageUrl: urls.original,
        formats: {
          large: urls.large || urls.original,
          medium: urls.small || urls.large || urls.original,
          small: urls.small || urls.large || urls.original,
          thumbnail: urls.thumbnail || urls.small || urls.original,
        },
        description: gallery.description ?? undefined,
      };
    });
  });
}

// Helper to get the best image URL from a Media object
export function getGalleryImageUrl(media: Media | null | undefined, size: 'original' | 'thumbnail' | 'small' | 'large' = 'large'): string | null {
  if (!media?.urls) return null;
  return media.urls[size];
}
