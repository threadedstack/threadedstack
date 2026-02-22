import type { UserConfig } from 'vitest/config'

import { defineConfig } from 'vitest/config'
import viteTsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    root: './',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    include: [`src/**/*.test.ts`],
    globalSetup: [`src/setup/global-setup.ts`],
    setupFiles: [`src/setup/test-env.ts`],
  },
  plugins: [viteTsconfigPaths()],
} as UserConfig)
