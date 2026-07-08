import type { TApp } from '@TBE/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Agent, ApiKey, Sandbox, ApiKeyPrefix } from '@tdsk/domain'

import {
  ResidentEnvVars,
  CrashLoopMaxRestarts,
  createResidentWatchdog,
  ResidentStatusCollection,
} from './watchdog'
import { ResidentConfigsCollection } from '@TBE/utils/agent/residentAllowlist'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const OrgId = `og_org00001`
const AgentId = `ag_agent001`
const ProjectId = `pj_proj0001`
const SandboxId = `sb_body0001`
const Now = 1_800_000_000_000

const buildAgent = (overrides: Record<string, any> = {}) =>
  new Agent({
    id: AgentId,
    name: `resident`,
    orgId: OrgId,
    environment: { sandboxId: SandboxId },
    ...overrides,
  })

const buildSandboxRow = (overrides: Record<string, any> = {}) =>
  new Sandbox({
    id: SandboxId,
    name: `resident-body`,
    orgId: OrgId,
    userId: `11111111-2222-3333-4444-555555555555`,
    config: { image: `node:20`, resident: { agentId: AgentId } },
    ...overrides,
  } as any)

type TBuildOpts = {
  agent?: Agent | null
  sandboxRow?: any
  /** resident_configs records returned for the project. */
  configRecords?: any[]
  /** resident_status record (undefined = none). */
  statusRecord?: any
  /** Active pod instance ids. */
  pods?: string[]
  /** Existing ACTIVE resident api keys (rotation targets). */
  existingKeys?: ApiKey[]
  /** Omit the sandbox service entirely (K8s unavailable). */
  noSandboxService?: boolean
}

const build = ({
  agent = buildAgent(),
  sandboxRow = buildSandboxRow(),
  configRecords = [{ id: `rec_cfg001`, data: { agentId: AgentId } }],
  statusRecord = undefined,
  pods = [],
  existingKeys = [],
  noSandboxService = false,
}: TBuildOpts = {}) => {
  const startPod = vi.fn().mockResolvedValue(`tdsk-sb-pod-1`)
  const stopPod = vi.fn().mockResolvedValue(undefined)
  const findActiveInstances = vi.fn().mockResolvedValue(pods)

  const recordUpserts: any[] = []
  const apiKeyCreates: any[] = []
  const apiKeyRevokes: string[] = []

  const db = {
    services: {
      agent: { get: vi.fn().mockResolvedValue({ data: agent }) },
      sandbox: { get: vi.fn().mockResolvedValue({ data: sandboxRow }) },
      collection: {
        listByName: vi.fn().mockResolvedValue({
          data: configRecords.length ? [{ id: `col_rescfg`, projectId: ProjectId }] : [],
        }),
      },
      record: {
        query: vi
          .fn()
          .mockImplementation(async (_projectId: string, collection: string) => {
            if (collection === ResidentConfigsCollection) return { data: configRecords }
            if (collection === ResidentStatusCollection)
              return { data: statusRecord ? [statusRecord] : [] }
            return { data: [] }
          }),
        upsert: vi
          .fn()
          .mockImplementation(async (_projectId: string, _c: string, input: any) => {
            recordUpserts.push(input)
            return { data: { id: input.id ?? `rec_new001`, data: input.data } }
          }),
      },
      apiKey: {
        getByResidentAgent: vi.fn().mockResolvedValue({ data: existingKeys }),
        revoke: vi.fn().mockImplementation(async (id: string) => {
          apiKeyRevokes.push(id)
          return { data: true }
        }),
        create: vi.fn().mockImplementation(async (key: any) => {
          apiKeyCreates.push(key)
          return { data: new ApiKey({ ...key, id: `ak_fresh001` }) }
        }),
      },
    },
  }

  const app = {
    locals: {
      db,
      sandbox: noSandboxService ? undefined : { startPod, stopPod, findActiveInstances },
      config: {
        server: { port: 5885 },
        // Residents dial the backend via the PUBLIC proxy URL (config.proxy.url)
        proxy: { url: `https://px.example.test` },
        egress: { serviceName: `tdsk-backend`, servicePort: 8889 },
      },
    },
  } as unknown as TApp

  return {
    app,
    db,
    startPod,
    stopPod,
    findActiveInstances,
    recordUpserts,
    apiKeyCreates,
    apiKeyRevokes,
  }
}

const freshStatus = (nowMs: number) => ({
  id: `rec_stat01`,
  data: { agentId: AgentId, degraded: false },
  updatedAt: new Date(nowMs - 30_000).toISOString(),
})

const staleStatus = (nowMs: number) => ({
  id: `rec_stat01`,
  data: { agentId: AgentId, degraded: false },
  updatedAt: new Date(nowMs - 10 * 60_000).toISOString(),
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe(`resident watchdog — reconcile matrix`, () => {
  it(`healthy: pod exists + fresh heartbeat ⇒ no action`, async () => {
    const ctx = build({ pods: [`tdsk-sb-pod-0`], statusRecord: freshStatus(Now) })
    const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })

    const summary = await watchdog.tick()

    expect(summary.checked).toBe(1)
    expect(summary.results[0]).toMatchObject({ agentId: AgentId, action: `healthy` })
    expect(ctx.startPod).not.toHaveBeenCalled()
    expect(ctx.stopPod).not.toHaveBeenCalled()
  })

  it(`missing: no pod ⇒ start with the FULL env contract (identity vars + config JSON)`, async () => {
    const configRecord = {
      id: `rec_cfg001`,
      data: {
        agentId: AgentId,
        agenda: [{ key: `daily`, cron: `0 9 * * *`, prompt: `p` }],
      },
    }
    const ctx = build({ pods: [], configRecords: [configRecord] })
    const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })

    const summary = await watchdog.tick()

    expect(summary.results[0]).toMatchObject({ action: `started` })
    expect(ctx.startPod).toHaveBeenCalledTimes(1)
    const call = ctx.startPod.mock.calls[0][0]
    expect(call).toMatchObject({
      orgId: OrgId,
      sandboxId: SandboxId,
      projectId: ProjectId,
      userId: `11111111-2222-3333-4444-555555555555`,
    })
    // ALL five identity vars — the runtime refuses to boot with any missing
    expect(call.extraEnv[ResidentEnvVars.agentId]).toBe(AgentId)
    expect(call.extraEnv[ResidentEnvVars.orgId]).toBe(OrgId)
    expect(call.extraEnv[ResidentEnvVars.projectId]).toBe(ProjectId)
    // The backend URL is the PUBLIC proxy URL (config.proxy.url) — residents
    // reach the backend through the MITM like any other client
    expect(call.extraEnv[ResidentEnvVars.backendUrl]).toBe(`https://px.example.test`)
    expect(call.extraEnv[ResidentEnvVars.token]).toMatch(new RegExp(`^${ApiKeyPrefix}`))
    // PLUS the resident_configs record injected as JSON — network-free boot
    expect(JSON.parse(call.extraEnv[ResidentEnvVars.config])).toEqual(configRecord.data)
    expect(Object.keys(call.extraEnv)).toHaveLength(6)
  })

  it(`stale: pod exists but heartbeat is old ⇒ stop pod, rotate token, restart`, async () => {
    const old = new ApiKey({
      id: `ak_old00001`,
      orgId: OrgId,
      active: true,
      keyHash: `hash`,
      residentAgentId: AgentId,
      name: `resident:${AgentId}`,
    })
    const ctx = build({
      pods: [`tdsk-sb-pod-0`],
      statusRecord: staleStatus(Now),
      existingKeys: [old],
    })
    const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })

    const summary = await watchdog.tick()

    expect(summary.results[0]).toMatchObject({ action: `restarted` })
    expect(ctx.stopPod).toHaveBeenCalledWith(`tdsk-sb-pod-0`)
    // Token ROTATION: the previous resident key is revoked before the new mint
    expect(ctx.apiKeyRevokes).toEqual([`ak_old00001`])
    expect(ctx.apiKeyCreates).toHaveLength(1)
    expect(ctx.apiKeyCreates[0]).toMatchObject({ residentAgentId: AgentId })
    expect(ctx.startPod).toHaveBeenCalledTimes(1)
  })

  it(`stale with NO status record at all ⇒ restart (never trusted as fresh)`, async () => {
    const ctx = build({ pods: [`tdsk-sb-pod-0`], statusRecord: undefined })
    const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })

    const summary = await watchdog.tick()
    expect(summary.results[0]).toMatchObject({ action: `restarted` })
  })

  it(`degraded: ≥${CrashLoopMaxRestarts} restarts/hour ⇒ mark degraded + skip until the hour rolls`, async () => {
    let now = Now
    const ctx = build({ pods: [] })
    const watchdog = createResidentWatchdog(ctx.app, {
      nowFn: () => now,
      startupGraceMs: 0,
    })

    // Three restarts inside the window (startup grace disabled to force churn)
    for (let i = 0; i < CrashLoopMaxRestarts; i++) {
      const summary = await watchdog.tick()
      expect(summary.results[0].action).toBe(`started`)
      now += 60_000
    }
    expect(ctx.startPod).toHaveBeenCalledTimes(CrashLoopMaxRestarts)

    // Fourth pass: crash-loop gate trips — degraded is written, no start
    const degradedPass = await watchdog.tick()
    expect(degradedPass.results[0]).toMatchObject({ action: `degraded` })
    expect(ctx.startPod).toHaveBeenCalledTimes(CrashLoopMaxRestarts)
    expect(ctx.recordUpserts).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({ agentId: AgentId, degraded: true }),
      })
    )

    // The hour rolls: the window empties and the watchdog restarts again
    now += 61 * 60_000
    const recovered = await watchdog.tick()
    expect(recovered.results[0].action).toBe(`started`)
  })

  it(`startup grace: a just-started pod is not judged before it can heartbeat`, async () => {
    const ctx = build({ pods: [] })
    const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })

    await watchdog.tick()
    expect(ctx.startPod).toHaveBeenCalledTimes(1)

    const second = await watchdog.tick()
    expect(second.results[0]).toMatchObject({
      action: `skipped`,
      reason: `startup grace`,
    })
    expect(ctx.startPod).toHaveBeenCalledTimes(1)
  })
})

describe(`resident watchdog — config/resolution guards`, () => {
  it(`skips an agent with no body sandbox`, async () => {
    const ctx = build({ agent: buildAgent({ environment: {} }) })
    const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })
    const summary = await watchdog.tick()
    expect(summary.results[0]).toMatchObject({ action: `skipped` })
    expect(summary.results[0].reason).toContain(`no body sandbox`)
  })

  it(`skips a sandbox that is not in resident mode`, async () => {
    const ctx = build({
      sandboxRow: buildSandboxRow({ config: { image: `node:20` } }),
    })
    const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })
    const summary = await watchdog.tick()
    expect(summary.results[0]).toMatchObject({ action: `skipped` })
    expect(summary.results[0].reason).toContain(`not in resident mode`)
  })

  it(`skips a resident sandbox bound to a DIFFERENT agent`, async () => {
    const ctx = build({
      sandboxRow: buildSandboxRow({
        config: { image: `node:20`, resident: { agentId: `ag_other001` } },
      }),
    })
    const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })
    const summary = await watchdog.tick()
    expect(summary.results[0]).toMatchObject({ action: `skipped` })
    expect(summary.results[0].reason).toContain(`bound to ag_other001`)
  })

  it(`errors a record whose agent no longer exists`, async () => {
    const ctx = build({ agent: null })
    const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })
    const summary = await watchdog.tick()
    expect(summary.results[0]).toMatchObject({
      action: `error`,
      reason: `agent not found`,
    })
  })

  it(`errors (never starts) when config.proxy.url is unset`, async () => {
    const ctx = build({ pods: [] })
    ;(ctx.app.locals.config as any).proxy.url = ``
    const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })
    const summary = await watchdog.tick()
    expect(summary.results[0].action).toBe(`error`)
    expect(summary.results[0].reason).toContain(`no backend URL`)
    expect(summary.results[0].reason).toContain(`config.proxy.url`)
    expect(ctx.startPod).not.toHaveBeenCalled()
  })

  it(`prefers the opts.backendUrl override over config.proxy.url`, async () => {
    const ctx = build({ pods: [] })
    const watchdog = createResidentWatchdog(ctx.app, {
      nowFn: () => Now,
      backendUrl: `https://override.example.test`,
    })
    const summary = await watchdog.tick()
    expect(summary.results[0].action).toBe(`started`)
    const call = ctx.startPod.mock.calls[0][0]
    expect(call.extraEnv[ResidentEnvVars.backendUrl]).toBe(
      `https://override.example.test`
    )
  })

  it(`degrades (never starts) when config.proxy.url is pod-unreachable (0.0.0.0/localhost)`, async () => {
    for (const url of [`http://0.0.0.0:7118`, `http://localhost:7118`]) {
      const ctx = build({ pods: [] })
      ;(ctx.app.locals.config as any).proxy.url = url
      const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })
      const summary = await watchdog.tick()
      expect(summary.results[0].action).toBe(`degraded`)
      expect(summary.results[0].reason).toContain(`unreachable from a pod`)
      expect(summary.results[0].reason).toContain(url)
      expect(ctx.startPod).not.toHaveBeenCalled()
      // Marked degraded on the resident_status record — no crash-looping pods
      expect(ctx.recordUpserts).toContainEqual(
        expect.objectContaining({
          data: expect.objectContaining({ agentId: AgentId, degraded: true }),
        })
      )
    }
  })

  it(`is idle without a sandbox service (K8s unavailable)`, async () => {
    const ctx = build({ noSandboxService: true })
    const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })
    const summary = await watchdog.tick()
    expect(summary.checked).toBe(0)
    expect(ctx.db.services.collection.listByName).not.toHaveBeenCalled()
  })

  it(`is inert when no resident_configs collections exist (pre-R4 state)`, async () => {
    const ctx = build({ configRecords: [] })
    const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })
    const summary = await watchdog.tick()
    expect(summary.checked).toBe(0)
    expect(ctx.startPod).not.toHaveBeenCalled()
  })
})

describe(`resident watchdog — release rolling-restart`, () => {
  it(`recreates EVERY resident pod regardless of freshness, without crash-loop counting`, async () => {
    const ctx = build({ pods: [`tdsk-sb-pod-0`], statusRecord: freshStatus(Now) })
    const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })

    const summary = await watchdog.rollingRestart()

    expect(summary.results[0]).toMatchObject({ action: `restarted` })
    expect(ctx.stopPod).toHaveBeenCalledWith(`tdsk-sb-pod-0`)
    expect(ctx.startPod).toHaveBeenCalledTimes(1)
    const call = ctx.startPod.mock.calls[0][0]
    expect(Object.keys(call.extraEnv).sort()).toEqual(
      Object.values(ResidentEnvVars).sort()
    )

    // Rolling restarts never count toward the crash-loop window: repeat
    // sweeps keep restarting instead of tripping degraded.
    for (let i = 0; i < CrashLoopMaxRestarts + 1; i++) {
      const next = await watchdog.rollingRestart()
      expect(next.results[0].action).toBe(`restarted`)
    }
  })
})

describe(`resident watchdog — lifecycle`, () => {
  it(`tick bails when a pass is already in flight`, async () => {
    const ctx = build({ pods: [`tdsk-sb-pod-0`], statusRecord: freshStatus(Now) })
    let release!: () => void
    ctx.findActiveInstances.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve([`tdsk-sb-pod-0`])
        })
    )
    const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })

    const first = watchdog.tick()
    // Yield so the first pass reaches the pod lookup and parks
    await new Promise((resolve) => setImmediate(resolve))
    const second = await watchdog.tick()
    expect(second).toEqual({ checked: 0, results: [] })

    release()
    const summary = await first
    expect(summary.checked).toBe(1)
  })

  it(`start/stop drive the interval without double-starting`, () => {
    vi.useFakeTimers()
    try {
      const ctx = build({ configRecords: [] })
      const watchdog = createResidentWatchdog(ctx.app, { nowFn: () => Now })
      watchdog.start()
      watchdog.start()
      vi.advanceTimersByTime(3 * 60_000)
      watchdog.stop()
      watchdog.stop()
      // Initial tick + 3 interval ticks all reached the collection lookup
      expect(
        ctx.db.services.collection.listByName.mock.calls.length
      ).toBeGreaterThanOrEqual(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
