import { type Static, Type } from '@sinclair/typebox';

const HomeSchema = Type.Object({
  title: Type.String(),
  description: Type.String(),
  hero: Type.String(),
  shortDescription: Type.String(),
  keywords: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export type Home = Static<typeof HomeSchema>;
