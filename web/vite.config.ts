import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Same-origin /api in dev, like nginx in production.
  server: { port: 5180, proxy: { '/api': loadEnv(mode, process.cwd(), '').VITE_API_PROXY || 'http://127.0.0.1:3202' } },
}))
