import { loadEnvs } from '../utils/loadEnvs'
import { env } from '../utils/env'
import { get, post, del } from '../utils/api-client'
import { checkHealth } from '../utils/health'
import { writeContext, readContext } from '../utils/test-context'

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
  cancelAndSuppressTLSWarning()

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

  // 6. Create admin-scoped API key for role hierarchy tests
  //    Finds any admin member in the org (not the test user, who is the owner)
  //    and creates an API key for them, then verifies it works.
  let adminApiKey: string | undefined
  let adminApiKeyId: string | undefined
  let adminUserId: string | undefined

  type TMember = { userId: string; type: string }
  const membersRes = await get<{ data: TMember[] }>(`/orgs/${env.testOrgId}/members`)
  const orgMembers = membersRes.data?.data || []

  // Find an admin member who is NOT the test user (test user is typically the owner)
  const adminMember = orgMembers.find(
    (m: TMember) => m.type === 'admin' && m.userId !== env.testUserId
  )

  if (adminMember) {
    adminUserId = adminMember.userId
    const keyRes = await post<{ data: { id: string; key: string } }>(
      `/orgs/${env.testOrgId}/api-keys`,
      { name: 'integration-admin', scopes: 'admin', userId: adminUserId }
    )

    if (keyRes.ok && keyRes.data?.data) {
      const candidateKey = keyRes.data.data.key
      const candidateKeyId = keyRes.data.data.id

      // Verify the key works — user must exist in users table for backend auth
      const verifyRes = await get(`/orgs/${env.testOrgId}`, { apiKey: candidateKey })

      if (verifyRes.ok) {
        adminApiKey = candidateKey
        adminApiKeyId = candidateKeyId
      } else {
        console.warn(
          `[global-setup] Admin API key created but verification failed (status ${verifyRes.status}). ` +
            `User ${adminUserId} may not exist in users table. Role hierarchy tests will be skipped.`
        )
        // Clean up the unusable key
        await del(`/orgs/${env.testOrgId}/api-keys/${candidateKeyId}`)
        adminUserId = undefined
      }
    } else {
      console.warn(
        `[global-setup] Failed to create admin API key (status ${keyRes.status}). ` +
          `Role hierarchy tests will be skipped.`
      )
      adminUserId = undefined
    }
  } else {
    console.warn(
      `[global-setup] No admin member found in org (excluding test user). ` +
        `Role hierarchy tests will be skipped.`
    )
  }

  // 7. Find a target org member for role hierarchy tests
  //    Must be different from both the test user (owner) and the admin user (actor)
  let targetMemberUserId: string | undefined
  if (adminUserId) {
    const targetMember = orgMembers.find(
      (m: TMember) => m.userId !== env.testUserId && m.userId !== adminUserId
    )
    if (targetMember) {
      targetMemberUserId = targetMember.userId
    } else {
      console.warn(
        `[global-setup] No target member found for role hierarchy tests. ` +
          `Need at least 3 org members (owner, admin, target).`
      )
    }
  }

  // 8. Write context for tests
  writeContext({
    orgName,
    orgId: env.testOrgId,
    apiKey: env.testApiKey,
    userId: env.testUserId,
    agentId: env.testAgentId,
    projectId: env.testProjectId,
    adminApiKey,
    adminApiKeyId,
    adminUserId,
    targetMemberUserId,
  })

  // Return teardown function to clean up resources
  return async () => {
    try {
      loadEnvs()
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
      const ctx = readContext()
      if (ctx.adminApiKeyId) {
        await del(`/orgs/${ctx.orgId}/api-keys/${ctx.adminApiKeyId}`)
      }
    } catch {
      // Best-effort cleanup
    }
  }
}
