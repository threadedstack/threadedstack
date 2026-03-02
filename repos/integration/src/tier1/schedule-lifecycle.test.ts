import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'
import { env } from '../utils/env'

/**
 * Tier 1: Schedule Lifecycle
 *
 * Validates schedule CRUD and the trigger endpoint.
 *
 * Covers fix C2: triggerSchedule must set nextRunAt to a future cron time
 * (not `now`), preventing double-execution on the next scheduler tick.
 */
describe('Tier 1: Schedule Lifecycle', () => {
  const ctx = readContext()
  let agentId = ''
  let scheduleId = ''
  let quickstartResult: Record<string, any> = {}
  let setupFailed = false

  beforeAll(async () => {
    if (!env.testProviderKey) {
      setupFailed = true
      return
    }

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'zai',
        apiKey: env.testProviderKey,
        projectName: uniqueName('Schedule Test'),
        agentName: uniqueName('Schedule Agent'),
      }
    )

    if (res.status !== 201 || !res.data?.data?.agent?.id) {
      setupFailed = true
      return
    }

    quickstartResult = res.data.data
    agentId = quickstartResult.agent.id
  })

  afterAll(async () => {
    if (scheduleId) await tryDelete(`/orgs/${ctx.orgId}/schedules/${scheduleId}`)
    if (quickstartResult.endpoint?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project?.id}/endpoints/${quickstartResult.endpoint.id}`)
    if (quickstartResult.agent?.id)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${quickstartResult.agent.id}`)
    if (quickstartResult.project?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project.id}`)
    if (quickstartResult.secret?.id)
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${quickstartResult.secret.id}`)
    if (quickstartResult.provider?.id)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${quickstartResult.provider.id}`)
  })

  // ─── Create ────────────────────────────────────────────────────────

  test('POST creates a schedule with valid cron expression', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/schedules`,
      {
        agentId,
        cronExpression: '0 9 * * MON',
        prompt: 'Weekly status report',
        enabled: true,
        createThread: true,
        maxConsecutiveErrors: 3,
      }
    )

    expect(res.status).toBe(201)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.id).toBeTruthy()
    expect(res.data.data.agentId).toBe(agentId)
    expect(res.data.data.cronExpression).toBe('0 9 * * MON')
    expect(res.data.data.prompt).toBe('Weekly status report')
    expect(res.data.data.enabled).toBe(true)
    expect(res.data.data.createThread).toBe(true)

    scheduleId = res.data.data.id
  })

  test('POST rejects invalid cron expression', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post(`/orgs/${ctx.orgId}/schedules`, {
      agentId,
      cronExpression: 'not-a-cron',
      prompt: 'Should fail',
    })

    expect(res.status).toBe(400)
  })

  test('POST requires cronExpression, prompt, and agentId', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const missing1 = await post(`/orgs/${ctx.orgId}/schedules`, {
      agentId,
      prompt: 'missing cron',
    })
    expect(missing1.status).toBe(400)

    const missing2 = await post(`/orgs/${ctx.orgId}/schedules`, {
      agentId,
      cronExpression: '0 9 * * MON',
    })
    expect(missing2.status).toBe(400)

    const missing3 = await post(`/orgs/${ctx.orgId}/schedules`, {
      cronExpression: '0 9 * * MON',
      prompt: 'missing agentId',
    })
    expect(missing3.status).toBe(400)
  })

  // ─── Read ──────────────────────────────────────────────────────────

  test('GET retrieves the created schedule', async () => {
    if (setupFailed || !scheduleId) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/schedules/${scheduleId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.data.id).toBe(scheduleId)
    expect(res.data.data.prompt).toBe('Weekly status report')
  })

  test('GET list returns schedules for the org', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any>[] }>(
      `/orgs/${ctx.orgId}/schedules`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data.data)).toBe(true)

    if (scheduleId) {
      const found = res.data.data.some((s: any) => s.id === scheduleId)
      expect(found).toBe(true)
    }
  })

  // ─── Update ────────────────────────────────────────────────────────

  test('PUT updates the schedule prompt', async () => {
    if (setupFailed || !scheduleId) return expect(setupFailed).toBe(false)

    const res = await put<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/schedules/${scheduleId}`,
      { prompt: 'Updated weekly report' }
    )

    expect(res.status).toBe(200)
    expect(res.data.data.prompt).toBe('Updated weekly report')
  })

  // ─── Update ownership verification ─────────────────────────────────

  test('PUT rejects update with non-existent agentId → 404', async () => {
    if (setupFailed || !scheduleId) return expect(setupFailed).toBe(false)

    const res = await put(
      `/orgs/${ctx.orgId}/schedules/${scheduleId}`,
      { agentId: 'zz99999999' }
    )

    expect(res.status).toBe(404)
  })

  test('PUT rejects update with non-existent threadId → 404', async () => {
    if (setupFailed || !scheduleId) return expect(setupFailed).toBe(false)

    const res = await put(
      `/orgs/${ctx.orgId}/schedules/${scheduleId}`,
      { threadId: 'zz99999999' }
    )

    expect(res.status).toBe(404)
  })

  test('PUT update with valid agentId from same org succeeds', async () => {
    if (setupFailed || !scheduleId || !agentId) return expect(setupFailed).toBe(false)

    const res = await put<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/schedules/${scheduleId}`,
      { agentId }
    )

    expect(res.status).toBe(200)
    expect(res.data.data.agentId).toBe(agentId)
  })

  // ─── Boolean defaults (.notNull) ───────────────────────────────────

  test('POST schedule without enabled/createThread returns boolean defaults', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/schedules`,
      {
        agentId,
        cronExpression: '0 12 * * *',
        prompt: 'Boolean defaults test',
      }
    )

    expect(res.status).toBe(201)
    expect(typeof res.data.data.enabled).toBe('boolean')
    expect(res.data.data.enabled).toBe(true)
    expect(typeof res.data.data.createThread).toBe('boolean')
    expect(res.data.data.createThread).toBe(true)

    if (res.data.data.id) await tryDelete(`/orgs/${ctx.orgId}/schedules/${res.data.data.id}`)
  })

  // ─── Impossible cron expression ────────────────────────────────────

  test('POST rejects cron that parses but never matches (Feb 31)', async () => {
    if (setupFailed || !agentId) return expect(setupFailed).toBe(false)

    const res = await post(`/orgs/${ctx.orgId}/schedules`, {
      agentId,
      cronExpression: '0 0 31 2 *',
      prompt: 'Impossible cron test',
    })

    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  // ─── Trigger (C2 fix) ─────────────────────────────────────────────

  test('POST trigger sets nextRunAt to a future time, not now (C2 fix)', async () => {
    if (setupFailed || !scheduleId) return expect(setupFailed).toBe(false)

    const beforeTrigger = Date.now()
    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/schedules/${scheduleId}/trigger`
    )

    expect(res.status).toBe(200)
    expect(res.data.data.triggered).toBe(true)
    expect(res.data.data.lastRunAt).toBeTruthy()
    expect(res.data.data.nextRunAt).toBeTruthy()

    // C2 fix: nextRunAt should be in the future (next Monday 9am),
    // NOT equal to "now". A value close to `now` would mean the old
    // bug is still present (new Date() was used instead of parseNextRun).
    const nextRunAt = new Date(res.data.data.nextRunAt).getTime()
    const oneMinuteFromNow = beforeTrigger + 60_000

    expect(nextRunAt).toBeGreaterThan(oneMinuteFromNow)
  })

  test('POST trigger returns 404 for non-existent schedule', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Use a valid-format 10-char ID that doesn't exist in the DB
    const res = await post(`/orgs/${ctx.orgId}/schedules/zz99999999/trigger`)
    expect(res.status).toBe(404)
  })

  // ─── Delete ────────────────────────────────────────────────────────

  test('DELETE removes the schedule', async () => {
    if (setupFailed || !scheduleId) return expect(setupFailed).toBe(false)

    const res = await del(`/orgs/${ctx.orgId}/schedules/${scheduleId}`)
    expect(res.status).toBe(200)

    // Verify it's gone
    const getRes = await get(`/orgs/${ctx.orgId}/schedules/${scheduleId}`)
    expect(getRes.status).toBe(404)

    // Clear scheduleId so afterAll doesn't try to delete again
    scheduleId = ''
  })

  // ─── Auth ──────────────────────────────────────────────────────────

  test('GET schedules without auth returns 401', async () => {
    const res = await get(`/orgs/${ctx.orgId}/schedules`, { noAuth: true })
    expect(res.status).toBe(401)
  })
})
