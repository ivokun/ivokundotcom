import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [react(), tailwind()],
  site: 'https://ivokun.com',
  vite: {
    // Ensure environment variables are loaded during SSR
    envPrefix: 'CMS_',
  },
});
