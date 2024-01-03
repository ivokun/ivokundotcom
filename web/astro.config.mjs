import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import react from '@astrojs/react';

import tailwind from '@astrojs/tailwind';

const { CMS_API_URL } = loadEnv(process.env.CMS_API_URL, process.cwd(), '');
const { CMS_API_TOKEN } = loadEnv(process.env.CMS_API_TOKEN, process.cwd(), '');

// https://astro.build/config
export default defineConfig({
  integrations: [react(), tailwind()],
  env: {
    CMS_API_URL,
    CMS_API_TOKEN,
  },
  site: 'https://ivokun.com',
});
