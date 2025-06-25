import { type Static, Type } from "@sinclair/typebox";

const FormatSchema = Type.Object({
  url: Type.String({ format: "uri" }),
  ext: Type.String(),
  hash: Type.String(),
  mime: Type.String(),
  name: Type.String(),
  width: Type.Integer(),
  height: Type.Integer(),
});

const ImageFormatsSchema = Type.Object({
  large: FormatSchema,
  medium: FormatSchema,
  small: FormatSchema,
  thumbnail: FormatSchema,
});

const ImageSchema = Type.Object({
  data: Type.Array(
    Type.Object({
      id: Type.Integer(),
      attributes: Type.Object({
        name: Type.String(),
        url: Type.String({ format: "uri" }),
        alternativeText: Type.Optional(Type.String()),
        caption: Type.Optional(Type.String()),
        width: Type.Integer(),
        height: Type.Integer(),
        formats: ImageFormatsSchema,
        createdAt: Type.String({ format: "date-time" }),
        updatedAt: Type.String({ format: "date-time" }),
      }),
    })
  ),
});

const GallerySchema = Type.Object({
  id: Type.Integer(),
  attributes: Type.Object({
    title: Type.String(),
    description: Type.Optional(Type.String()),
    slug: Type.String(),
    category: Type.Object({
      data: Type.Object({
        id: Type.Integer(),
        attributes: Type.Object({
          name: Type.String(),
          description: Type.String(),
          slug: Type.String(),
        }),
      }),
    }),
    images: ImageSchema,
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    publishedAt: Type.String({ format: "date-time" }),
  }),
});

export type Gallery = Static<typeof GallerySchema>;

// For the GalleryGrid component
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

type Props = {
  endpoint: string;
  query?: Record<string, string>;
  wrappedByKey?: string;
  wrappedByList?: boolean;
};

export async function fetchGallery<T>({
  endpoint,
  query,
  wrappedByKey,
  wrappedByList,
}: Props): Promise<T> {
  if (endpoint.startsWith("/")) {
    endpoint = endpoint.slice(1);
  }

  const url = new URL(`${import.meta.env.CMS_API_URL}/${endpoint}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  
  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `bearer ${import.meta.env.CMS_API_TOKEN}`,
    },
  });
  
  const data = await res.json();

  if (wrappedByKey) {
    return data[wrappedByKey] as T;
  }

  if (wrappedByList) {
    return data[0] as T;
  }

  return data as T;
}

// Helper function to convert Gallery API response to GalleryItems for the component
export function convertToGalleryItems(galleries: Gallery[]): GalleryItem[] {
  return galleries.flatMap((gallery) => {
    const category = gallery.attributes.category.data.attributes.name.toLowerCase();
    
    return gallery.attributes.images.data.map((image) => {
      // Check if formats exists and use appropriate URLs
      const formats = image.attributes.formats || {};
      
      return {
        id: `${gallery.id}`,
        slug: gallery.attributes.slug,
        title: gallery.attributes.title,
        category,
        // Default to original URL if no formats are available
        imageUrl: image.attributes.url,
        formats: {
          large: formats.large?.url || image.attributes.url,
          medium: formats.medium?.url || formats.large?.url || image.attributes.url,
          small: formats.small?.url || formats.medium?.url || formats.large?.url || image.attributes.url,
          thumbnail: formats.thumbnail?.url || formats.small?.url || image.attributes.url
        },
        description: gallery.attributes.description || undefined,
      };
    });
  });
}
