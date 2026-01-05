import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { resolve } from 'path';

export default defineConfig({
  plugins: [solidPlugin({ extensions: ['.tsx', '.ts'] })],
  root: __dirname,
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: resolve(__dirname, './public/admin'),
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  server: {
    port: 3001,
    proxy: {
      '/admin/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
