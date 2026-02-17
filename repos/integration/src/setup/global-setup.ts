import { loadEnvs } from '../utils/loadEnvs'
import { env } from '../utils/env'
import { get } from '../utils/api-client'
import { checkHealth } from '../utils/health'
import { writeContext } from '../utils/test-context'

// TODO: use this to suppress UNAUTHORIZED warning, not needed for integration tests
const cancelAndSuppressTLSWarning = () => {
  const { emitWarning } = process
  process.emitWarning = (warning: string | Error, ...args: any) => {
    const m = typeof warning === `string` ? warning : warning.message
    if (m.includes(`NODE_TLS_REJECT_UNAUTHORIZED`)) {
      process.emitWarning = emitWarning
      return
    }
    return emitWarning(warning, ...args)
  }

  process.env[`NODE_TLS_REJECT_UNAUTHORIZED`] = `0`
}


/**
 * Vitest global setup — runs once before all test files.
 *
 * 1. Load envs from values.yaml files (same as other TDSK repos)
 * 2. Disable TLS verification (Caddy uses local CA for dev)
 * 3. Validate required env vars
 * 4. Health-check proxy
 * 5. Validate org exists using API key
 * 6. Write context to temp file for tests to read
 */
export default async function setup() {
  // 1. Load envs from values.yaml → process.env
  loadEnvs()

  // 2. Allow self-signed certs from Caddy local CA
  //cancelAndSuppressTLSWarning()
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

  // 3. Validate required env vars
  if (!env.testApiKey) {
    throw new Error(
      'TDSK_IT_API_KEY is required for integration tests.\n' +
        '  Set it in ~/.config/tdsk/values.yaml:\n' +
        '    TDSK_IT_API_KEY: tdsk_your_api_key_here\n' +
        '  Or pass it inline: TDSK_IT_API_KEY=tdsk_xxx pnpm test:api'
    )
  }

  if (!env.testOrgId) {
    throw new Error(
      'TDSK_IT_ORG_ID is required for integration tests.\n' +
        '  Set it in ~/.config/tdsk/values.yaml:\n' +
        '    TDSK_IT_ORG_ID: your_org_id_here\n' +
        '  Or pass it inline: TDSK_IT_ORG_ID=xxx pnpm test:api'
    )
  }

  // 4. Health check proxy
  await checkHealth()

  // 5. Validate org is accessible with the API key
  const orgRes = await get<{ data: { id: string; name: string } }>(
    `/orgs/${env.testOrgId}`
  )

  if (!orgRes.ok) {
    throw new Error(
      `Failed to fetch org ${env.testOrgId}: ${JSON.stringify(orgRes.data)}\n` +
        `  Status: ${orgRes.status}\n` +
        `  Hint: Verify TDSK_IT_API_KEY has access to this org`
    )
  }

  const orgName = orgRes.data?.data?.name || ''

  // 6. Write context for tests
  writeContext({
    orgName,
    orgId: env.testOrgId,
    apiKey: env.testApiKey,
    userId: env.testUserId,
    agentId: env.testAgentId,
    projectId: env.testProjectId,
  })
}
