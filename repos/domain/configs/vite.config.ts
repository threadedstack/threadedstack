import type { UserConfig } from 'vitest/config'

import path from 'node:path'
import { defineConfig } from 'vitest/config'
import viteTsconfigPaths from 'vite-tsconfig-paths'

const rootDir = path.join(__dirname, '..')

export default defineConfig({
  plugins: [
    viteTsconfigPaths({
      root: rootDir,
      projects: [
        rootDir,
      ]
    }),
  ],
  test: {
    globals: true,
    environment: `node`,
    include: [`**/*.test.ts`],
  },
} as unknown as UserConfig)
