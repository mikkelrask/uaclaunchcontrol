import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // node environment is default — fine for both main-process
    // and renderer pure-function tests
  }
})
