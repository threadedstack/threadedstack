import type { UserConfig } from 'vitest/config'

import { defineConfig } from 'vitest/config'
import viteTsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    globals: true,
    environment: `node`,
    include: [`**/*.test.ts`],
  },
  plugins: [viteTsconfigPaths()],
} as unknown as UserConfig)
