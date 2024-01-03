import { type Static, Type } from '@sinclair/typebox';

const PostSchema = Type.Object({
  id: Type.Integer(),
  attributes: Type.Object({
    title: Type.String(),
    content: Type.String(),
    slug: Type.String(),
    featuredPicture: Type.String(),
    excerpt: Type.String(),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
    publishedAt: Type.String({ format: 'date-time' }),
  }),
});

export type Post = Static<typeof PostSchema>;

type Props = {
  endpoint: string;
  query?: Record<string, string>;
  wrappedByKey?: string;
  wrappedByList?: boolean;
};

export async function fetchPosts<T>({
  endpoint,
  query,
  wrappedByKey,
  wrappedByList,
}: Props): Promise<T> {
  if (endpoint.startsWith('/')) {
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
      'Content-Type': 'application/json',
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
