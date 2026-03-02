import { loadEnvs } from '../src/utils/loadEnvs'
import { env } from '../src/utils/env'
import { writeContext } from '../src/utils/test-context'


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
 * Ensure at least one thread exists for the test agent.
 * Many Playwright tests require thread data; without it they skip.
 */
async function ensureThread(proxyUrl: string, orgId: string, agentId: string, apiKey: string) {
  if (!orgId || !agentId || !apiKey) return

  try {
    const listRes = await fetch(`${proxyUrl}/_/orgs/${orgId}/agents/${agentId}/threads`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    })

    if (listRes.ok) {
      const body = await listRes.json() as { data?: unknown[] }
      if (body.data && body.data.length > 0) return
    }

    await fetch(`${proxyUrl}/_/orgs/${orgId}/agents/${agentId}/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ name: 'Playwright Test Thread' }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    console.warn(`[global-setup] Thread seed failed: ${err}`)
  }
}

/**
 * Playwright global setup — runs once before all spec files.
 *
 * 1. Load envs from values.yaml files
 * 2. Validate required env vars
 * 3. Seed test data (ensure thread exists)
 * 4. Write context to temp file for fixtures to read
 */
export default async function globalSetup() {
  loadEnvs()
  cancelAndSuppressTLSWarning()

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

  await ensureThread(env.proxyUrl, env.testOrgId, env.testAgentId, env.testApiKey)

  writeContext({
    orgName: '',
    orgId: env.testOrgId,
    apiKey: env.testApiKey,
    userId: env.testUserId,
    agentId: env.testAgentId,
    projectId: env.testProjectId,
  })
}
