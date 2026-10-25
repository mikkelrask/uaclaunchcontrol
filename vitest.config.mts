import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Mirrors electron.vite.config.mts's renderer aliases, so renderer
    // modules that import via '@/...' resolve under vitest too.
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    include: ['src/**/*.test.ts']
    // node environment is default — fine for both main-process
    // and renderer pure-function tests
  }
})
