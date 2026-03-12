import { defineConfig, devices } from '@playwright/test'
import { loadEnvs } from '../src/utils/loadEnvs'

// Populate process.env from values.yaml files before config is evaluated
loadEnvs()

const adminUrl = process.env.TDSK_IT_ADMIN_URL
  || `http://localhost:${process.env.TDSK_AD_PORT || '5887'}`

export default defineConfig({
  testDir: '../playwright/tier2',
  globalSetup: '../playwright/global-setup.ts',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: adminUrl,
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
