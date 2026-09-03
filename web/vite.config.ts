import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' y no 'autoUpdate': recargar sola la app a mitad de una
      // escritura es un riesgo innecesario cuando el dispositivo es la
      // fuente de verdad. El aviso de versión nueva lo da la UI.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Saldus — finanzas personales',
        short_name: 'Saldus',
        description:
          'Registro de ingresos y gastos que funciona sin conexión.',
        lang: 'es-EC',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf9f7',
        theme_color: '#faf9f7',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'icons/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icono-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icono-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // El atajo del ícono de inicio es el toque 1 de los dos toques
        // que exige el objetivo de captura.
        shortcuts: [
          {
            name: 'Registrar gasto',
            short_name: 'Gasto',
            description: 'Abre el formulario de gasto con el monto enfocado',
            url: '/registrar?tipo=GASTO',
            icons: [
              { src: 'icons/icono-192.png', sizes: '192x192', type: 'image/png' },
            ],
          },
          {
            name: 'Registrar ingreso',
            short_name: 'Ingreso',
            description: 'Abre el formulario de ingreso',
            url: '/registrar?tipo=INGRESO',
            icons: [
              { src: 'icons/icono-192.png', sizes: '192x192', type: 'image/png' },
            ],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Navegar sin conexión: cualquier ruta cae en el index cacheado.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // El service worker en desarrollo estorba más de lo que ayuda:
        // se prueba con `npm run build && npm run preview`.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Para abrir la app desde el celular en la misma red Wi-Fi.
    host: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/pruebas/preparacion.ts'],
  },
})
