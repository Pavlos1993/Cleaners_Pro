import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      // Avoid browser CORS: forward Hosthub API (path after /hosthub → /api/2019-03-01)
      '/hosthub': {
        target: 'https://app.hosthub.com',
        changeOrigin: true,
        rewrite: (path) => '/api/2019-03-01' + path.slice('/hosthub'.length),
        secure: true,
        /** Ensure Hosthub receives the same `Authorization` header the browser sent to Vite. */
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, req) => {
            const auth = req.headers.authorization
            if (auth) proxyReq.setHeader('Authorization', auth)
          })
        },
      },
    },
  },
})
