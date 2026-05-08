import { env } from '../utils/env'
import { loadEnvs } from '../utils/loadEnvs'
import { checkHealth } from '../utils/health'
import { api, get, post, del } from '../utils/api-client'
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

  // Agents first — delete threads before agents (agent deletion orphans threads via set null)
  const agentsRes = await get<TResource[]>(`/orgs/${orgId}/agents?limit=200`)
  const staleAgents = (agentsRes.data || []).filter(a => isTestResource(a.name))
  for (const agent of staleAgents) {
    const threadsRes = await get<TResource[]>(`/orgs/${orgId}/agents/${agent.id}/threads?limit=200`)
    if (threadsRes.ok) {
      for (const thread of (threadsRes.data || [])) {
        await tryDel(`/orgs/${orgId}/agents/${agent.id}/threads/${thread.id}`)
      }
    }
    await tryDel(`/orgs/${orgId}/agents/${agent.id}`)
  }

  // Projects (endpoints, functions cascade from projects)
  const projectsRes = await get<TResource[]>(`/orgs/${orgId}/projects?limit=200`)
  for (const project of (projectsRes.data || [])) {
    if (isTestResource(project.name)) await tryDel(`/orgs/${orgId}/projects/${project.id}`)
  }

  // Secrets
  const secretsRes = await get<TResource[]>(`/orgs/${orgId}/secrets?limit=200`)
  for (const secret of (secretsRes.data || [])) {
    if (isTestResource(secret.name)) await tryDel(`/orgs/${orgId}/secrets/${secret.id}`)
  }

  // Providers (after secrets — secrets may reference providers)
  const providersRes = await get<TResource[]>(`/orgs/${orgId}/providers?limit=200`)
  for (const provider of (providersRes.data || [])) {
    if (isTestResource(provider.name)) await tryDel(`/orgs/${orgId}/providers/${provider.id}`)
  }

  // API keys
  const keysRes = await get<TResource[]>(`/orgs/${orgId}/api-keys?limit=200`)
  for (const key of (keysRes.data || [])) {
    if (key.name === 'integration-admin' || key.name === 'integration-member' || isTestResource(key.name))
      await tryDel(`/orgs/${orgId}/api-keys/${key.id}`)
  }

  // Assets
  const assetsRes = await get<TResource[]>(`/assets?orgId=${orgId}&limit=200`)
  for (const asset of (assetsRes.data || [])) {
    if (isTestResource(asset.name)) await tryDel(`/assets/${asset.id}`)
  }

  // Orgs created by tests (NOT the seed org)
  const orgsRes = await get<TResource[]>(`/orgs?limit=200`)
  for (const org of (orgsRes.data || [])) {
    if (org.id !== orgId && isTestResource(org.name)) await tryDel(`/orgs/${org.id}`)
  }

  type TSandboxResource = { id: string; name: string; projectId?: string }
  const sandboxesRes = await get<TSandboxResource[]>(`/orgs/${orgId}/sandboxes?limit=200`)
  const staleSandboxes = (sandboxesRes.data || []).filter(sb => isTestResource(sb.name))

  try {
    const { execFileSync } = await import('node:child_process')
    const podsRaw = execFileSync(
      'kubectl',
      ['get', 'pods', '-l', 'tdsk.app/managed=true', '-o', 'json'],
      { encoding: 'utf-8', timeout: 15_000 }
    ).trim()

    if (podsRaw) {
      const pods = JSON.parse(podsRaw)
      for (const pod of (pods.items || [])) {
        const podName = pod.metadata?.name
        const sbId = pod.metadata?.labels?.['tdsk.app/sandbox-id']
        const projId = pod.metadata?.labels?.['tdsk.app/project-id']
        if (!podName || !sbId || !projId) continue

        if (!staleSandboxes.some(sb => sb.id === sbId)) continue

        try {
          await api(`/orgs/${orgId}/projects/${projId}/sandboxes/${sbId}/stop`, {
            method: 'DELETE',
            body: { podName },
          })
        } catch (err) {
          console.warn(`[global-setup] Failed to stop pod ${podName}: ${(err as Error).message}`)
        }
      }
    }
  } catch (err) {
    const msg = (err as Error).message || ''
    if (!msg.includes('ENOENT')) {
      console.warn(`[global-setup] Pod cleanup failed: ${msg}`)
    }
  }

  for (const sandbox of staleSandboxes) {
    await tryDel(`/orgs/${orgId}/sandboxes/${sandbox.id}`)
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
  const orgRes = await get<{ id: string; name: string }>(
    `/orgs/${env.testOrgId}`
  )

  if (!orgRes.ok) {
    throw new Error(
      `Failed to fetch org ${env.testOrgId}: ${JSON.stringify(orgRes.data)}\n` +
        `  Status: ${orgRes.status}\n` +
        `  Hint: Verify TDSK_IT_API_KEY has access to this org`
    )
  }

  const orgName = orgRes.data?.name || ''

  // 5b. Clean up stale test resources from prior interrupted/failed runs
  await cleanupStaleTestResources(env.testOrgId)

  // 6. Use dedicated test users from env (TDSK_IT_*_USER) for role-specific tests.
  //    These are seeded users — no dynamic member discovery needed.
  let adminApiKey: string | undefined
  let adminApiKeyId: string | undefined
  let adminUserId: string | undefined
  let memberApiKey: string | undefined
  let memberApiKeyId: string | undefined
  let memberUserId: string | undefined
  let targetMemberUserId: string | undefined

  type TMember = { userId: string; type: string }
  const membersRes = await get<TMember[]>(`/orgs/${env.testOrgId}/members`)
  const orgMembers = membersRes.data || []

  const orgMemberSnapshot = orgMembers.map((m: TMember) => ({
    userId: m.userId,
    type: m.type,
  }))

  // Use the dedicated admin user from env vars
  if (env.adminUserId) {
    adminUserId = env.adminUserId
    const keyRes = await post<{ id: string; key: string }>(
      `/orgs/${env.testOrgId}/api-keys`,
      { name: 'integration-admin', scopes: 'admin', userId: adminUserId }
    )

    if (keyRes.ok && keyRes.data) {
      const verifyRes = await get(`/orgs/${env.testOrgId}`, { apiKey: keyRes.data.key })
      if (verifyRes.ok) {
        adminApiKey = keyRes.data.key
        adminApiKeyId = keyRes.data.id
      } else {
        console.warn(`[global-setup] Admin key verification failed (${verifyRes.status}). Role hierarchy tests will be skipped.`)
        await del(`/orgs/${env.testOrgId}/api-keys/${keyRes.data.id}`)
        adminUserId = undefined
      }
    } else {
      console.warn(`[global-setup] Failed to create admin API key (${keyRes.status}). Role hierarchy tests will be skipped.`)
      adminUserId = undefined
    }
  } else {
    console.warn(`[global-setup] TDSK_IT_ADMIN_USER not set. Role hierarchy tests will be skipped.`)
  }

  // 7. Use the dedicated member user from env vars
  if (env.memberUserId) {
    memberUserId = env.memberUserId
    const keyRes = await post<{ id: string; key: string }>(
      `/orgs/${env.testOrgId}/api-keys`,
      { name: 'integration-member', scopes: 'member', userId: memberUserId }
    )

    if (keyRes.ok && keyRes.data) {
      const verifyRes = await get(`/orgs/${env.testOrgId}`, { apiKey: keyRes.data.key })
      if (verifyRes.ok) {
        memberApiKey = keyRes.data.key
        memberApiKeyId = keyRes.data.id
      } else {
        console.warn(`[global-setup] Member key verification failed (${verifyRes.status}). Permission boundary tests will be skipped.`)
        await del(`/orgs/${env.testOrgId}/api-keys/${keyRes.data.id}`)
        memberUserId = undefined
      }
    } else {
      console.warn(`[global-setup] Failed to create member API key (${keyRes.status}). Permission boundary tests will be skipped.`)
      memberUserId = undefined
    }
  } else {
    console.warn(`[global-setup] TDSK_IT_MEMBER_USER not set. Permission boundary tests will be skipped.`)
  }

  // 8. Use the dedicated viewer user as the target for role hierarchy tests
  targetMemberUserId = env.viewerUserId || undefined
  if (!targetMemberUserId) {
    console.warn(`[global-setup] TDSK_IT_VIEWER_USER not set. Role hierarchy target tests will be skipped.`)
  }

  // 9. Write context for tests
  writeContext({
    orgName,
    adminApiKey,
    adminUserId,
    adminApiKeyId,
    memberApiKey,
    memberUserId,
    memberApiKeyId,
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

      try {
        await cleanupStaleTestResources(ctx.orgId)
      } catch (err) {
        console.warn(`[global-teardown] Stale resource cleanup failed: ${(err as Error).message}`)
      }

      if (ctx.adminApiKeyId) {
        await del(`/orgs/${ctx.orgId}/api-keys/${ctx.adminApiKeyId}`)
      }

      if (ctx.memberApiKeyId) {
        await del(`/orgs/${ctx.orgId}/api-keys/${ctx.memberApiKeyId}`)
      }

      // Restore any org members that were removed during tests
      if (ctx.orgMemberSnapshot?.length) {
        const currentRes = await get<TMember[]>(`/orgs/${ctx.orgId}/members`)
        const currentUserIds = new Set(
          (currentRes.data || []).map((m: any) => m.userId)
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
    } catch (err) {
      console.warn(`[global-teardown] Cleanup failed: ${(err as Error).message}`)
    }
  }
}
