import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist'
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'splitwave.svg', 'pwa/*.png', 'pwa/*.svg'],
      manifest: {
        name: 'SyncSong',
        short_name: 'SyncSong',
        description: 'Create and edit synced lyrics in LRC format',
        theme_color: '#6366f1',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        categories: ['music', 'utilities'],
        start_url: '/',
        icons: [
          {
            src: 'pwa/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png'
          },
          {
            src: 'pwa/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png'
          },
          {
            src: 'pwa/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png'
          },
          {
            src: 'pwa/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png'
          },
          {
            src: 'pwa/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png'
          },
          {
            src: 'pwa/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png'
          },
          {
            src: 'pwa/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa/icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}']
      }
    })
  ]
});
