import { loadEnvs } from '../src/utils/loadEnvs'
import { env } from '../src/utils/env'
import { writeContext } from '../src/utils/test-context'

/**
 * Playwright global setup — runs once before all spec files.
 *
 * 1. Load envs from values.yaml files
 * 2. Validate required env vars
 * 3. Write context to temp file for fixtures to read
 */
export default async function globalSetup() {
  loadEnvs()

  if (!env.testApiKey) {
    throw new Error(
      'TDSK_IT_API_KEY is required for Playwright tests.\n' +
        '  Set it in ~/.config/tdsk/values.yaml'
    )
  }

  if (!env.testOrgId) {
    throw new Error(
      'TDSK_IT_ORG_ID is required for Playwright tests.\n' +
        '  Set it in ~/.config/tdsk/values.yaml'
    )
  }

  writeContext({
    orgName: '',
    orgId: env.testOrgId,
    apiKey: env.testApiKey,
    userId: env.testUserId,
    agentId: env.testAgentId,
    projectId: env.testProjectId,
  })
}
