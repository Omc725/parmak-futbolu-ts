import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // GitHub Pages depo adınızla eşleştiğinden emin olun
      base: '/parmak-futbolu-ts/', 
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          // Assets klasöründeki her şeyin (logolar, saha resimleri vb.) PWA'ya dahil edilmesini sağlar.
          includeAssets: ['icon-512x512.png', 'assets/**/*'],
          manifest: {
            name: 'Parmak Futbolu',
            short_name: 'Parmak Futbolu',
            description: 'Hızlı tempolu bir langırt oyunu! Çevrimdışı oynanabilir.',
            theme_color: '#2c3e50',
            background_color: '#2c3e50',
            display: 'standalone',
            start_url: '.',
            icons: [
              { src: 'icon-144x144.png', sizes: '144x144', type: 'image/png' },
              { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
              { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png' }
            ]
          },
          workbox: {
            // Proje içindeki dosyaları önbelleğe alır.
            globPatterns: ['**/*.{js,css,html,png,svg,jpg,jpeg,gif,woff,woff2}'],
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB

            // HARİCİ URL'LERİ ÖNBELLEĞE ALMA BÖLÜMÜ
            runtimeCaching: [
              // 1. aistudio CDN (React, Vite vb. kütüphaneler için)
              {
                urlPattern: /^https:\/\/aistudiocdn\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'aistudio-cdn-cache',
                  expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, // 1 Yıl
                  cacheableResponse: { statuses: [0, 200] }
                }
              },
              // 2. Google Fonts (Yazı tipleri CSS dosyası için)
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }, // 1 Yıl
                  cacheableResponse: { statuses: [0, 200] }
                }
              },
              // 3. Google Fonts (Yazı tipi dosyaları .woff2 için)
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-files-cache',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }, // 1 Yıl
                  cacheableResponse: { statuses: [0, 200] }
                }
              },
              // 4. Tailwind CSS CDN (Stiller için)
              {
                urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'tailwind-cdn-cache',
                  expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 Gün
                  cacheableResponse: { statuses: [0, 200] }
                }
              },
              // 5. Transparent Textures (Sketch teması arkaplanı için)
              {
                urlPattern: /^https:\/\/www\.transparenttextures\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'textures-cache',
                  expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 }, // 1 Yıl
                  cacheableResponse: { statuses: [0, 200] }
                }
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
            '@': path.resolve(__dirname, './')
        }
      }
    };
});