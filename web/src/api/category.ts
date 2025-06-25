import { type Static, Type } from "@sinclair/typebox";

// Define a schema for the category
const CategorySchema = Type.Object({
  id: Type.Integer(),
  attributes: Type.Object({
    name: Type.String(),
    description: Type.Optional(Type.String()),
    slug: Type.String(),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    publishedAt: Type.String({ format: "date-time" }),
    // Relations
    posts: Type.Optional(Type.Object({
      data: Type.Array(Type.Object({
        id: Type.Integer()
      }))
    })),
    galleries: Type.Optional(Type.Object({
      data: Type.Array(Type.Object({
        id: Type.Integer()
      }))
    }))
  })
});

export type Category = Static<typeof CategorySchema>;

type Props = {
  endpoint: string;
  query?: Record<string, string>;
  wrappedByKey?: string;
  wrappedByList?: boolean;
};

export async function fetchCategories<T>({
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

// Helper function to filter categories for articles
export function filterArticleCategories(categories: Category[]): Category[] {
  return categories.filter(category => 
    category.attributes.posts?.data && category.attributes.posts.data.length > 0
  );
}

// Helper function to filter categories for galleries
export function filterGalleryCategories(categories: Category[]): Category[] {
  return categories.filter(category => 
    category.attributes.galleries?.data && category.attributes.galleries.data.length > 0
  );
}

// Format category name (lowercase for data-filtering, uppercase for display)
export function formatCategoryName(name: string, toUpperCase = false): string {
  return toUpperCase ? name.toUpperCase() : name.toLowerCase();
}