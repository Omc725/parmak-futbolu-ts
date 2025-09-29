import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub depo adını bir değişkene atayarak hataları önle
const repoName = 'parmak-futbolu-ts';

export default defineConfig({
  // Projenin GitHub Pages'deki alt klasör yolunu belirtir.
  // Bu, 'https://.../reponame/' şeklinde yayınlanmasını sağlar.
  base: `/${repoName}/`,
  
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      
      // Derleme sırasında public klasöründeki her şeyin kopyalanmasını sağlar.
      // Vite varsayılan olarak bunu yapar, ama PWA için açıkça belirtmek iyidir.
      includeAssets: ['assets/**/*'],
      
      manifest: {
        name: 'Parmak Futbolu',
        short_name: 'Parmak Futbolu',
        description: 'Hızlı tempolu bir langırt oyunu! Çevrimdışı oynanabilir.',
        
        // PWA'nın başlangıç ve etki alanını belirtir.
        // base ayarı ile birleşerek tam yolu oluşturur.
        start_url: '.',
        scope: '.',
        
        display: 'standalone',
        background_color: '#2c3e50',
        theme_color: '#2c3e50',
        icons: [
          // İkon yolları `base` ayarına göre otomatik olarak ayarlanır.
          { src: 'icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      
      workbox: {
        // Derlenmiş projedeki tüm dosyaları önbelleğe alır.
        globPatterns: ['**/*.{js,css,html,png,svg,jpg,jpeg,gif,woff,woff2}'],
        
        // Harici CDN'leri önbelleğe alır.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/aistudiocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'aistudio-cdn-cache', expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } }
          },
          {
            urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'tailwind-cdn-cache', expiration: { maxEntries: 5, maxAgeSeconds: 30 * 24 * 60 * 60 } }
          },
          {
            urlPattern: /^https:\/\/www\.transparenttextures\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'textures-cache', expiration: { maxEntries: 5, maxAgeSeconds: 365 * 24 * 60 * 60 } }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
        '@': path.resolve(__dirname, './src') // Genellikle src klasörü hedeflenir.
    }
  }
});