import { fileURLToPath, URL } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// Auth/antiforgery cookies are HttpOnly; Secure; SameSite=Strict in every environment (see
// docs/spec.md §5), so dev must be same-origin: serve over HTTPS and proxy /api to the backend.
// Cross-origin calls straight to VITE_API_URL make the browser silently drop the cookies.
// `npm run dev` runs the `predev` script first, which bootstraps a local self-signed cert.
const env = loadEnv('development', process.cwd(), '')
const keyFile = fileURLToPath(new URL('./.certs/dev-key.pem', import.meta.url))
const certFile = fileURLToPath(new URL('./.certs/dev-cert.pem', import.meta.url))
const hasDevCertificate = existsSync(keyFile) && existsSync(certFile)

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), ...(process.env.VITEST ? [] : [tailwindcss()])],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    https: hasDevCertificate
      ? { key: readFileSync(keyFile), cert: readFileSync(certFile) }
      : undefined,
    proxy: {
      '/api': {
        target: env.VITE_API_URL,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
