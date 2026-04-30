import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/face_mesh\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mediapipe-wasm',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/hospitals\.json$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'hospitals-cache',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /^\/api\//i,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 0, maxAgeSeconds: 0 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
  },
});
