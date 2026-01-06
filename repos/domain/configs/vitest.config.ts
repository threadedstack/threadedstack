import type { UserConfig } from 'vitest/config'

import './aliases'
import hq from 'alias-hq'
import { defineConfig } from 'vitest/config'
import viteTsconfigPaths from 'vite-tsconfig-paths'
import { loadEnvs } from '../src/environment/loadEnvs'

const alias = hq.get(`webpack`)

export default defineConfig(async () => {
  await loadEnvs({ force: true })

  return {
    test: {
      globals: true,
      environment: `node`,
      include: [`**/*.test.ts`],
    },
    resolve: {
      alias,
    },
    plugins: [viteTsconfigPaths()],
  } as unknown as UserConfig
})
