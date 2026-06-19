import { defineConfig } from 'vite';

export default defineConfig({
  root: 'public',
  publicDir: false,
  server: {
    proxy: {
      '/health': 'http://127.0.0.1:3000',
      '/admin': 'http://127.0.0.1:3000',
      '/astros': 'http://127.0.0.1:3000',
      '/astro': 'http://127.0.0.1:3000',
      '/ask': 'http://127.0.0.1:3000',
    },
  },
});
