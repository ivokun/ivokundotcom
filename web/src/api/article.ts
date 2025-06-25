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

const FeaturedPictureSchema = Type.Object({
  data: Type.Object({
    id: Type.Integer(),
    attributes: Type.Object({
      name: Type.String(),
      url: Type.String({ format: "uri" }),
      alternativeText: Type.String(),
      caption: Type.String(),
      width: Type.Integer(),
      height: Type.Integer(),
      formats: ImageFormatsSchema,
    }),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
  }),
});

const ArticleSchema = Type.Object({
  id: Type.Integer(),
  attributes: Type.Object({
    title: Type.String(),
    content: Type.String(),
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
    readTimeMinute: Type.Integer(),
    featuredPicture: FeaturedPictureSchema,
    excerpt: Type.String(),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    publishedAt: Type.String({ format: "date-time" }),
  }),
});

export type Article = Static<typeof ArticleSchema>;

type Props = {
  endpoint: string;
  query?: Record<string, string>;
  wrappedByKey?: string;
  wrappedByList?: boolean;
};

export async function fetchArticles<T>({
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