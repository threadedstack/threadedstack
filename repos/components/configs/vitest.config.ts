import type { UserConfig } from 'vitest/config'

import './aliases'
import hq from 'alias-hq'
import { defineConfig } from 'vitest/config'
import { loadEnvs } from '../scripts/loadEnvs'
import viteTsconfigPaths from 'vite-tsconfig-paths'


const nodeEnv = process.env.NODE_ENV || `local`
const alias = hq.get(`webpack`)

export default defineConfig(async () => {
  loadEnvs({
    env: nodeEnv,
    force: true
  })

  return {
    test: {
      globals: true,
      environment: `jsdom`,
      include: [`**/*.test.ts`],
      setupFiles: `./scripts/setupTests.ts`,
    },
    resolve: {
      alias,
    },
    plugins: [viteTsconfigPaths()],
  } as unknown as UserConfig
})
