import type { UserConfig } from 'vitest/config'

import hq from 'alias-hq'
import { defineConfig } from 'vitest/config'
// TODO Fix this
import { loadEnvs } from '../scripts/loadEnvs'
import viteTsconfigPaths from 'vite-tsconfig-paths'

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
