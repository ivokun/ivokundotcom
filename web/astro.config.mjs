import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
    // Tailwind CSS v4 runs as a Vite plugin (replaces the @astrojs/tailwind
    // integration used with Tailwind v3).
    plugins: [tailwindcss()],
    // Ensure environment variables are loaded during SSR
    envPrefix: 'CMS_',
  },
});
