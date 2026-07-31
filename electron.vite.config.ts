import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const csp = (isDev: boolean): string =>
  isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http: https:; connect-src 'self' ws: http: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http: https:; connect-src 'self' http: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'"

const cspPlugin = (): Plugin => ({
  name: 'inject-csp',
  transformIndexHtml(html, ctx) {
    const isDev = !!ctx.server
    return {
      html,
      tags: [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: csp(isDev)
          },
          injectTo: 'head-prepend'
        }
      ]
    }
  }
})

export default defineConfig({
  main: {},
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: {
        external: ['electron']
      }
    }
  },
  renderer: {
    build: {
      rollupOptions: {
        input: resolve('src/renderer/index.html')
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:7666',
          changeOrigin: true
        }
      }
    },
    define: {
      'process.env.DEBUG': JSON.stringify(process.env.DEBUG),
      'process.env.UAC_REGISTRY_URL': JSON.stringify(process.env.UAC_REGISTRY_URL ?? '')
    },
    plugins: [react(), cspPlugin()]
  }
})
