import type { UserConfig } from 'vitest/config'

import { defineConfig } from 'vitest/config'
import viteTsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(async () => {
  return {
    test: {
      globals: true,
      setupFiles: [],
      environment: `node`,
      include: [`**/*.test.ts`, `**/*.test.tsx`],
    },
    plugins: [viteTsconfigPaths()],
  } as unknown as UserConfig
})
