import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: './',
    include: [`src/**/*.test.ts`],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    globalSetup: [`src/setup/global-setup.ts`],
    // Ensure TLS bypass is inherited by worker processes
    env: {
      NODE_TLS_REJECT_UNAUTHORIZED: `0`,
    },
  },
})
