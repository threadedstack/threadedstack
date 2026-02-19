import { defineConfig } from 'vitest/config'
import viteTsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    root: './',
    include: [`src/**/*.test.ts`],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    globalSetup: [`src/setup/global-setup.ts`],
    // Ensure TLS bypass is inherited by worker processes
    env: {
      NODE_TLS_REJECT_UNAUTHORIZED: `0`,
    },
  },
  plugins: [viteTsconfigPaths()],
})
