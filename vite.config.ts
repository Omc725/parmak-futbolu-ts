import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/parmak-futbolu3/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon-512x512.png', 'icon-192x192.png', 'icon-144x144.png'],
          manifest: {
            name: 'Parmak Futbolu',
            short_name: 'Parmak Futbolu',
            description: 'Hızlı tempolu bir langırt oyunu! Takımını seç, yapay zekaya karşı lig ve turnuva modlarında mücadele et ve şampiyon ol!',
            theme_color: '#2c3e50',
            background_color: '#2c3e50',
            display: 'standalone',
            start_url: '.',
            icons: [
              {
                src: 'icon-144x144.png',
                sizes: '144x144',
                type: 'image/png'
              },
              {
                src: 'icon-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      }
    };
});