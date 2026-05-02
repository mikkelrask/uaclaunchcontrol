import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
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
      'process.env.DEBUG': JSON.stringify(process.env.DEBUG)
    },
    plugins: [react()]
  }
})
