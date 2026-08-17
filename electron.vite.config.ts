import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// The registry browse frontend is embedded as an iframe; its origin must be
// allowed by frame-src (default-src 'self' would block external frames).
// Resolved at config-eval time so a dev override of UAC_REGISTRY_FRONTEND_URL
// (local frontend dev) lands in the dev CSP too.
const REGISTRY_FRAME_ORIGIN = process.env.UAC_REGISTRY_FRONTEND_URL
  ? new URL(process.env.UAC_REGISTRY_FRONTEND_URL).origin
  : 'https://registry.uac-soft.online'

const csp = (isDev: boolean): string =>
  isDev
    ? `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http: https:; connect-src 'self' ws: http: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src ${REGISTRY_FRAME_ORIGIN}`
    : `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http: https:; connect-src 'self' http: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src ${REGISTRY_FRAME_ORIGIN}`

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
      'process.env.UAC_REGISTRY_URL': JSON.stringify(process.env.UAC_REGISTRY_URL ?? ''),
      'process.env.UAC_REGISTRY_FRONTEND_URL': JSON.stringify(
        process.env.UAC_REGISTRY_FRONTEND_URL ?? ''
      )
    },
    plugins: [react(), cspPlugin()]
  }
})
