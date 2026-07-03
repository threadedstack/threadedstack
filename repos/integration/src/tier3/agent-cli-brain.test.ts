import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'
import { isFeatureEnabled } from '@tdsk/domain'

/**
 * Tier 3: Agent CLI Brain E2E
 *
 * A runtime-brain agent thinks with the CLI tool configured in its body
 * sandbox (via the runtime's promptCommand) instead of the pi-based API
 * runner. This flow validates the full loop on live K8s:
 *
 * 1. Create a sandbox with runtime `custom` and a promptCommand that echoes
 *    a marker plus the composed prompt
 * 2. Create an agent with brain='runtime', a soul, and environment.sandboxId
 *    pointing at that sandbox (no AI providers — CLI brains need none)
 * 3. Create a schedule bound to that agent + sandbox
 * 4. Trigger the schedule (starts the pod, execs the promptCommand, persists
 *    output to the continuity thread, stops the pod)
 * 5. Poll the schedule run to success
 * 6. Assert the schedule gained a threadId and the thread holds the raw user
 *    prompt plus an assistant message containing the CLI marker and soul
 */
describe.skipIf(!isFeatureEnabled('agents') || !isFeatureEnabled('schedules'))(
  'Tier 3: Agent CLI Brain',
  () => {
    const ctx = readContext()

    let projectId = ''
    let sandboxId = ''
    let agentId = ''
    let scheduleId = ''
    let threadId = ''
    let setupFailed = false

    const soul = 'I am the CLI brain steward'
    const prompt = 'Report platform status'

    beforeAll(async () => {
      try {
        const projRes = await post<Record<string, any>>(
          `/orgs/${ctx.orgId}/projects`,
          { name: uniqueName('cli-brain'), orgId: ctx.orgId }
        )
        if (!projRes.ok) { setupFailed = true; return }
        projectId = projRes.data.id

        const sbRes = await post<Record<string, any>>(
          `/orgs/${ctx.orgId}/sandboxes`,
          {
            name: uniqueName('cli-brain-sb'),
            orgId: ctx.orgId,
            projectIds: [projectId],
            config: {
              image: 'node:22-slim',
              runtime: 'custom',
              promptCommand: `echo 'CLI_BRAIN_OK: {prompt}'`,
              resources: {
                limits: { cpu: '500m', memory: '256Mi' },
                requests: { cpu: '100m', memory: '128Mi' },
              },
            },
          }
        )
        if (!sbRes.ok) { setupFailed = true; return }
        sandboxId = sbRes.data.id

        const agentRes = await post<Record<string, any>>(
          `/orgs/${ctx.orgId}/agents`,
          {
            name: uniqueName('cli-brain-agent'),
            orgId: ctx.orgId,
            brain: 'runtime',
            soul,
            environment: { sandboxId },
          }
        )
        if (!agentRes.ok) { setupFailed = true; return }
        agentId = agentRes.data.id

        const schedRes = await post<Record<string, any>>(
          `/orgs/${ctx.orgId}/projects/${projectId}/schedules`,
          {
            agentId,
            sandboxId,
            prompt,
            cronExpression: '0 9 * * MON',
            enabled: true,
          }
        )
        if (!schedRes.ok) { setupFailed = true; return }
        scheduleId = schedRes.data.id
      } catch (err) {
        console.error('[agent-cli-brain] Setup failed:', (err as Error).message)
        setupFailed = true
      }
    }, 60_000)

    afterAll(async () => {
      // Recover the continuity thread id when the test failed before capturing
      // it — a run may still have created and persisted a thread on the schedule
      if (!threadId && scheduleId) {
        try {
          const schedRes = await get<Record<string, any>>(
            `/orgs/${ctx.orgId}/projects/${projectId}/schedules/${scheduleId}`
          )
          if (schedRes.ok && schedRes.data.threadId) threadId = schedRes.data.threadId
        } catch (err) {
          console.warn('[agent-cli-brain] threadId recovery failed:', (err as Error).message)
        }
      }
      if (scheduleId) await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/schedules/${scheduleId}`)
      // Delete the continuity thread before the agent — threads.agentId is
      // set-null on agent delete, which would orphan the thread in the seeded org
      if (threadId && agentId) await tryDelete(`/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}`)
      if (agentId) await tryDelete(`/orgs/${ctx.orgId}/agents/${agentId}`)
      if (sandboxId) await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sandboxId}`)
      if (projectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}`)
    })

    test('agent create accepts brain=runtime without providerInputs', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const res = await get<Record<string, any>>(`/orgs/${ctx.orgId}/agents/${agentId}`)
      expect(res.status).toBe(200)
      expect(res.data.brain).toBe('runtime')
      expect(res.data.soul).toBe(soul)
      expect(res.data.environment?.sandboxId).toBe(sandboxId)
    })

    test('trigger executes the CLI brain and persists the report to the continuity thread', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      // Trigger runs the executor synchronously: pod start → exec → teardown
      const triggerRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects/${projectId}/schedules/${scheduleId}/trigger`,
        {},
        { timeout: 240_000 }
      )

      expect(triggerRes.status).toBe(200)
      expect(triggerRes.data.triggered).toBe(true)

      // Poll the run until it reports success
      let run: Record<string, any> | undefined
      const deadline = Date.now() + 60_000
      while (Date.now() < deadline) {
        const runsRes = await get<Record<string, any>[]>(
          `/orgs/${ctx.orgId}/projects/${projectId}/schedules/${scheduleId}/runs`
        )
        expect(runsRes.status).toBe(200)
        run = runsRes.data.find((r: any) => r.status === 'success')
        if (run) break
        const failed = runsRes.data.find(
          (r: any) => r.status === 'error' || r.status === 'timeout'
        )
        if (failed) throw new Error(`Schedule run failed: ${failed.status} — ${failed.error}`)
        await new Promise(r => setTimeout(r, 3_000))
      }

      expect(run, 'expected a successful schedule run').toBeTruthy()
      expect(run!.status).toBe('success')

      // The schedule gained a durable continuity thread
      const schedRes = await get<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects/${projectId}/schedules/${scheduleId}`
      )
      expect(schedRes.status).toBe(200)
      threadId = schedRes.data.threadId
      expect(threadId).toBeTruthy()

      // The thread holds the raw user prompt + the CLI tool's stdout report
      const msgRes = await get<Record<string, any>[]>(
        `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/messages`
      )
      expect(msgRes.status).toBe(200)
      expect(Array.isArray(msgRes.data)).toBe(true)

      const textOf = (msg: Record<string, any>) =>
        (msg.content || [])
          .filter((part: any) => part?.type === 'text')
          .map((part: any) => part.text)
          .join('\n')

      const userMsg = msgRes.data.find((m: any) => m.type === 'user')
      expect(userMsg, 'expected a persisted user message').toBeTruthy()
      expect(textOf(userMsg!)).toBe(prompt)

      const assistantMsg = msgRes.data.find((m: any) => m.type === 'assistant')
      expect(assistantMsg, 'expected a persisted assistant message').toBeTruthy()
      const report = textOf(assistantMsg!)
      expect(report).toContain('CLI_BRAIN_OK')
      // Soul is prepended to the prompt payload when the template has no {soul} placeholder
      expect(report).toContain(soul)
      expect(report).toContain(prompt)
    }, 300_000)
  }
)
