import type { UserConfig } from 'vitest/config'

import { defineConfig } from 'vitest/config'
import viteTsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    retry: 1,
    root: `./`,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: true,
    include: [`src/**/*.test.ts`],
    setupFiles: [`src/setup/test-env.ts`],
    globalSetup: [`src/setup/global-setup.ts`],
    pool: `forks`,
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 4,
      },
    },
  },
  plugins: [viteTsconfigPaths() as any],
} as UserConfig)
