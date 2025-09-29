import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const repoName = 'parmak-futbolu-ts'; // GitHub depo adınızı buraya yazın

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // Projenin GitHub Pages'deki alt klasör yolunu belirtir
      base: `/${repoName}/`,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          // PWA'nın manifest dosyasını nereye koyacağını belirtir.
          manifestFilename: 'manifest.json',
          
          // Çevrimdışı önbelleğe alınacak dosyaları belirtir.
          includeAssets: ['assets/**/*'], // Tüm logolar, saha resimleri vb.
          
          manifest: {
            // Manifest içeriği
            name: 'Parmak Futbolu',
            short_name: 'Parmak Futbolu',
            description: 'Hızlı tempolu bir langırt oyunu! Çevrimdışı oynanabilir.',
            
            // --- EN ÖNEMLİ DÜZELTME ---
            // start_url ve scope, base ayarından etkilenir.
            // VitePWA bu yolları otomatik olarak doğru şekilde oluşturacaktır.
            // Bu yüzden burayı basit tutuyoruz.
            start_url: '.', 
            scope: '.',
            
            display: 'standalone',
            background_color: '#2c3e50',
            theme_color: '#2c3e50',
            icons: [
              { src: 'icon-144x144.png', sizes: '144x144', type: 'image/png' },
              { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
              { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png' }
            ]
          },
          
          workbox: {
            // Proje içindeki tüm dosyaları önbelleğe al
            globPatterns: ['**/*.{js,css,html,png,svg,jpg,jpeg,gif,woff,woff2}'],
            // Harici CDN'leri önbelleğe al
            runtimeCaching: [
              // aistudio CDN
              {
                urlPattern: /^https:\/\/aistudiocdn\.com\/.*/i,
                handler: 'CacheFirst',
                options: { cacheName: 'aistudio-cdn-cache', expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 } }
              },
              // Google Fonts (CSS ve font dosyaları)
              {
                urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
                handler: 'CacheFirst',
                options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } }
              },
              // Tailwind CSS CDN
              {
                urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
                handler: 'CacheFirst',
                options: { cacheName: 'tailwind-cdn-cache', expiration: { maxEntries: 5, maxAgeSeconds: 30 * 24 * 60 * 60 } }
              },
              // Transparent Textures
              {
                urlPattern: /^https:\/\/www\.transparenttextures\.com\/.*/i,
                handler: 'CacheFirst',
                options: { cacheName: 'textures-cache', expiration: { maxEntries: 5, maxAgeSeconds: 365 * 24 * 60 * 60 } }
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