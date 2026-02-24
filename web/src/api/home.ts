import { cmsFetch, type TipTapDocument } from './cms';

export interface Home {
  id: string;
  title: string | null;
  short_description: string | null;
  description: TipTapDocument | null;
  hero: string | null;
  keywords: string | null;
  updated_at: string;
}

export async function fetchHome(): Promise<Home> {
  return cmsFetch<Home>('api/home');
}
