import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/gif2ascii/' : '/',
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/tenor': {
        target: 'https://tenor.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tenor/, ''),
      },
    },
  },
  preview: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/tenor': {
        target: 'https://tenor.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tenor/, ''),
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
}));
