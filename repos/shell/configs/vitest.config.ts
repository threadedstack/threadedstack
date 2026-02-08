import type { UserConfig } from 'vitest/config'

import './aliases'
import hq from 'alias-hq'
import { defineConfig } from 'vitest/config'
import { loadEnvs } from '../scripts/loadEnvs'
import viteTsconfigPaths from 'vite-tsconfig-paths'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const alias = hq.get(`webpack`)

export default defineConfig(async () => {
  await loadEnvs({ force: true })

  return {
    test: {
      globals: true,

      // Run tests in both environments sequentially
      environmentMatchGlobs: [
        // Browser-specific tests (jsdom)
        ['tests/unit/IndexedDBFileSystem.test.ts', 'jsdom'],
        ['tests/fs/IndexedDBFileSystem.test.ts', 'jsdom'],
        ['tests/unit/WebWorker.test.ts', 'jsdom'],
        ['tests/integration/browser.test.ts', 'jsdom'],

        // All other tests run in node
        ['**/*.test.ts', 'node'],
      ],

      include: ['src/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],

      // Coverage configuration
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: ['tests/**', '**/*.test.ts', '**/*.config.ts', '**/types/**'],
        thresholds: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
      },

      // Test timeout
      testTimeout: 10000,
      hookTimeout: 10000,
    },

    resolve: {
      alias,
    },

    plugins: [
      viteTsconfigPaths(),
      nodePolyfills({
        include: ['buffer', 'process', 'stream'],
        globals: {
          Buffer: true,
          process: true,
        },
      }),
    ],
  } as unknown as UserConfig
})
