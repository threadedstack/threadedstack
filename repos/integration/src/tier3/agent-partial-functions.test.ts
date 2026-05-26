import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { post, get, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { consumeSSE } from '../utils/sse'
import { tryDelete } from '../utils/cleanup'
import { cleanupThread } from '../utils/tsa-cleanup'
import { uniqueName } from '../utils/unique-name'
import { setupFixtures, cleanupFixtures, type TFixtureResult } from '../utils/fixtures'
import { isFeatureEnabled } from '@tdsk/domain'

/**
 * Tier 3: Agent with Partial (Deleted) Functions
 *
 * Validates that an agent can still start in degraded mode when some of its
 * linked functions have been deleted. This exercises:
 *   - Fix 4: resolveAgentDeps partial-load warning (logs warning, doesn't crash)
 *   - Fix 3: getByIds error normalization (missing IDs don't throw)
 *
 * Flow:
 *   1. Quickstart to get project + agent
 *   2. Create 2 functions, link both to agent via project config functionIds
 *   3. Delete one function
 *   4. Verify config still references both IDs (no auto-cleanup)
 *   5. Run agent via SSE — verify it starts despite the missing function
 *   6. Verify the remaining function is still queryable
 */
describe.skipIf(!isFeatureEnabled('agents'))('Tier 3: Agent with Partial (Deleted) Functions', () => {
  const ctx = readContext()

  let setupFailed = false
  let fixtures: TFixtureResult | null = null
  let agentId = ''
  let projectId = ''
  let fn1Id = ''
  let fn2Id = ''
  let deleteForbidden = false
  const threadIds: string[] = []

  const functionContent = `export default async function handler(request, context) {
  return { body: { message: 'test' } }
}`

  beforeAll(async () => {
    // Step 1: Create fixtures (provider + secret + project + agent + endpoint)
    try {
      fixtures = await setupFixtures({
        orgId: ctx.orgId,
        providerBrand: 'anthropic',
        apiKey: 'sk-test-fake-key-12345',
        projectName: uniqueName('Partial Fn Test Project'),
        agentName: uniqueName('Partial Fn Test Agent'),
      })
    } catch {
      setupFailed = true
      return
    }

    if (!fixtures.agent?.id) {
      setupFailed = true
      return
    }

    agentId = fixtures.agent.id
    projectId = fixtures.project!.id

    // Step 2: Create two functions in the project
    const [fn1Res, fn2Res] = await Promise.all([
      post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects/${projectId}/functions`,
        {
          name: uniqueName('partial-fn-keep'),
          content: functionContent,
          language: 'typescript',
          description: 'Function that will be kept',
        }
      ),
      post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects/${projectId}/functions`,
        {
          name: uniqueName('partial-fn-delete'),
          content: functionContent,
          language: 'typescript',
          description: 'Function that will be deleted',
        }
      ),
    ])

    if (
      fn1Res.status !== 201 || !fn1Res.data?.id ||
      fn2Res.status !== 201 || !fn2Res.data?.id
    ) {
      setupFailed = true
      return
    }

    fn1Id = fn1Res.data.id
    fn2Id = fn2Res.data.id

    // Step 3: Link both functions to the agent via project config functionIds
    const configRes = await put(
      `/orgs/${ctx.orgId}/projects/${projectId}/agents/${agentId}/config`,
      { functionIds: [fn1Id, fn2Id] }
    )

    if (!configRes.ok) {
      setupFailed = true
      return
    }

    // Step 4: Verify both functions are in the config before deletion
    const verifyRes = await get<{ functionIds: string[] }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/agents/${agentId}/config`
    )

    if (
      verifyRes.status !== 200 ||
      !verifyRes.data?.functionIds?.includes(fn1Id) ||
      !verifyRes.data?.functionIds?.includes(fn2Id)
    ) {
      setupFailed = true
      return
    }

    // Step 5: Delete the second function (fn2)
    const delRes = await del(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${fn2Id}`
    )

    // DELETE may return 403 if API key lacks admin scope — flag for skipping
    if (delRes.status === 403) {
      deleteForbidden = true
    } else if (!delRes.ok) {
      setupFailed = true
    }
  }, 30_000)

  afterAll(async () => {
    // Clean up threads created by consumeSSE calls
    for (const tid of threadIds) {
      if (agentId) await cleanupThread(ctx.orgId, agentId, tid)
    }

    // Clean up remaining function (fn1) — fn2 already deleted
    if (fn1Id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/functions/${fn1Id}`)

    // If delete was forbidden, fn2 still exists — clean it up
    if (fn2Id && deleteForbidden)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/functions/${fn2Id}`)

    // Cleanup fixture resources
    if (fixtures) await cleanupFixtures(ctx.orgId, fixtures)
  })

  test('config still references both function IDs after one is deleted', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)
    if (deleteForbidden) return // skip gracefully if delete was forbidden

    const configRes = await get<{ functionIds: string[] }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/agents/${agentId}/config`
    )

    expect(configRes.status).toBe(200)

    const { functionIds } = configRes.data
    // Config is NOT auto-cleaned — both IDs remain even though fn2 is deleted
    expect(functionIds).toContain(fn1Id)
    expect(functionIds).toContain(fn2Id)
  })

  test('deleted function returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)
    if (deleteForbidden) return

    const res = await get(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${fn2Id}`
    )

    expect(res.status).toBe(404)
  })

  test('remaining function returns 200', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${fn1Id}`
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBe(fn1Id)
  })

  test('agent SSE stream starts despite missing function', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)
    if (deleteForbidden) return

    // The agent references a deleted function in its config.
    // resolveAgentDeps should log a warning but NOT crash.
    const { events, threadId } = await consumeSSE(
      `/orgs/${ctx.orgId}/agents/${agentId}/run`,
      { prompt: 'Say hello' }
    )
    if (threadId) threadIds.push(threadId)

    expect(events).toBeDefined()
    expect(events.length).toBeGreaterThanOrEqual(1)

    // With a fake API key the LLM call will fail, but the SSE mechanics
    // should still work — we expect a thread event, or an error event.
    // The key assertion is that the stream started at all (didn't crash).
    const hasThread = events.some((e) => e.type === 'thread')
    const hasError = events.some((e) => e.type === 'error')
    const hasCompletion = events.some((e) => e.type === 'complete' || e.type === 'done')

    expect(hasThread || hasError || hasCompletion).toBe(true)
  })

  test('remaining function is still queryable after agent run', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${fn1Id}`
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBe(fn1Id)
  })
})
