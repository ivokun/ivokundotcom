import { Static, Type } from '@sinclair/typebox';

const PostSchema = Type.Object({
  title: Type.String(),
  content: Type.String(),
  slug: Type.String(),
  featuredPicture: Type.String(),
  excerpt: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export type Post = Static<typeof PostSchema>;
