// ============================================================
// MsLecturas — front/vite.config.js
// ============================================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const certKey  = path.resolve(__dirname, '../certs/key.pem');
const certFile = path.resolve(__dirname, '../certs/cert.pem');
const hasCerts = fs.existsSync(certKey) && fs.existsSync(certFile);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate (= skipWaiting + clientsClaim): el SW nuevo se activa apenas se
      // instala y la página se recarga sola. Con 'prompt' el SW nuevo quedaba "en
      // espera" mientras hubiera alguna ventana abierta y el aviso se repetía en loop.
      registerType: 'autoUpdate',
      devOptions:   { enabled: true },
      manifest: {
        name:             'MsLecturas',
        short_name:       'MsLecturas',
        description:      'Tomas de estados de consumo de gas — Offline First',
        theme_color:      '#0f172a',
        background_color: '#f0f2f5',
        display:          'standalone',
        orientation:      'portrait',
        start_url:        '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns:      ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern:  /^https:\/\/fonts\.googleapis\.com/,
            handler:     'CacheFirst',
            options:     { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],

  server: {
    host:  '0.0.0.0',
    port:  5173,
    ...(hasCerts
      ? { https: { key: fs.readFileSync(certKey), cert: fs.readFileSync(certFile) } }
      : {}),
  },

  build: {
    outDir:        'dist',
    sourcemap:     false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom'],
          dexie:   ['dexie'],
          crypto:  ['crypto-js'],
        },
      },
    },
  },
});
