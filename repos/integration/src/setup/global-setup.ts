import { env } from '../utils/env'
import { loadEnvs } from '../utils/loadEnvs'
import { checkHealth } from '../utils/health'
import { get, post, del } from '../utils/api-client'
import { writeContext, readContext } from '../utils/test-context'

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
 * Matches resources created by `uniqueName()` — pattern: "{prefix} {13-digit-ts}-{4-hex}".
 * Used to detect stale test resources left over from prior interrupted runs.
 */
const isTestResource = (name: string) => /\s\d{13}-[0-9a-f]{4}$/.test(name)

/**
 * Best-effort delete — swallows errors so cleanup continues for remaining resources.
 */
const tryDel = async (path: string) => {
  try {
    await del(path)
  }
  catch {
    /* best-effort */
    console.warn(`Failed to delete: ${path}\nManual cleanup required!`)
  }
}

/**
 * Remove stale test resources from previous interrupted runs.
 *
 * Runs at the START of each test session so leftovers from crashed/interrupted
 * runs don't accumulate and cause pagination-related test failures.
 *
 * Deletion order respects FK constraints (DB cascades handle children):
 *   agents → projects → providers → api-keys
 */
const cleanupStaleTestResources = async (orgId: string) => {
  type TResource = { id: string; name: string }

  const agentsRes = await get<{ data: TResource[] }>(`/orgs/${orgId}/agents?limit=200`)
  for (const agent of (agentsRes.data?.data || [])) {
    if (isTestResource(agent.name)) await tryDel(`/orgs/${orgId}/agents/${agent.id}`)
  }

  const projectsRes = await get<{ data: TResource[] }>(`/orgs/${orgId}/projects?limit=200`)
  for (const project of (projectsRes.data?.data || [])) {
    if (isTestResource(project.name)) await tryDel(`/orgs/${orgId}/projects/${project.id}`)
  }

  const providersRes = await get<{ data: TResource[] }>(`/orgs/${orgId}/providers?limit=200`)
  for (const provider of (providersRes.data?.data || [])) {
    if (isTestResource(provider.name)) await tryDel(`/orgs/${orgId}/providers/${provider.id}`)
  }

  const keysRes = await get<{ data: TResource[] }>(`/orgs/${orgId}/api-keys?limit=200`)
  for (const key of (keysRes.data?.data || [])) {
    if (key.name === 'integration-admin' || isTestResource(key.name))
      await tryDel(`/orgs/${orgId}/api-keys/${key.id}`)
  }

  const sandboxesRes = await get<{ data: TResource[] }>(`/orgs/${orgId}/sandboxes?limit=200`)
  for (const sandbox of (sandboxesRes.data?.data || [])) {
    if (isTestResource(sandbox.name)) await tryDel(`/orgs/${orgId}/sandboxes/${sandbox.id}`)
  }
}

/**
 * Vitest global setup — runs once before all test files.
 *
 * 1. Load envs from values.yaml files (same as other TDSK repos)
 * 2. Disable TLS verification (Caddy uses local CA for dev)
 * 3. Validate required env vars
 * 4. Health-check proxy
 * 5. Validate org exists using API key
 * 5b. Clean up stale test resources from prior runs
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

  // 5b. Clean up stale test resources from prior interrupted/failed runs
  await cleanupStaleTestResources(env.testOrgId)

  // 6. Create admin-scoped API key for role hierarchy tests
  //    Finds any admin member in the org (not the test user, who is the owner)
  //    and creates an API key for them, then verifies it works.
  let adminApiKey: string | undefined
  let adminApiKeyId: string | undefined
  let adminUserId: string | undefined

  type TMember = { userId: string; type: string }
  const membersRes = await get<{ data: TMember[] }>(`/orgs/${env.testOrgId}/members`)
  const orgMembers = membersRes.data?.data || []

  // Snapshot org members for teardown restoration
  const orgMemberSnapshot = orgMembers.map((m: TMember) => ({
    userId: m.userId,
    type: m.type,
  }))

  if (orgMembers.length < 3) {
    console.warn(
      `[global-setup] WARNING: Only ${orgMembers.length} org members found (expected ≥3). ` +
        `A prior test run may have removed members without restoring them. ` +
        `Re-run the database seed to fix: cd repos/database && pnpm seed`
    )
  }

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
    adminApiKey,
    adminUserId,
    adminApiKeyId,
    targetMemberUserId,
    orgMemberSnapshot,
    orgId: env.testOrgId,
    apiKey: env.testApiKey,
    userId: env.testUserId,
    agentId: env.testAgentId,
    projectId: env.testProjectId,
  })

  // Return teardown function to clean up resources and restore org members
  return async () => {
    try {
      loadEnvs()
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
      const ctx = readContext()

      if (ctx.adminApiKeyId) {
        await del(`/orgs/${ctx.orgId}/api-keys/${ctx.adminApiKeyId}`)
      }

      // Restore any org members that were removed during tests
      if (ctx.orgMemberSnapshot?.length) {
        const currentRes = await get<{ data: TMember[] }>(`/orgs/${ctx.orgId}/members`)
        const currentUserIds = new Set(
          (currentRes.data?.data || []).map((m: any) => m.userId)
        )

        for (const member of ctx.orgMemberSnapshot) {
          if (!currentUserIds.has(member.userId)) {
            console.warn(
              `[global-teardown] Restoring org member: ${member.userId} (${member.type})`
            )
            try {
              await post(`/orgs/${ctx.orgId}/members`, {
                userId: member.userId,
                roleType: member.type,
              })
            } catch {
              console.warn(
                `[global-teardown] Failed to restore org member: ${member.userId}`
              )
            }
          }
        }
      }
    } catch {
      // Best-effort cleanup
    }
  }
}
