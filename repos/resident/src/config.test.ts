import { describe, it, expect } from 'vitest'

import { makeFakeApi } from './testUtils'
import { ResidentConfigCollection } from './constants'
import { readResidentEnv, createConfigManager, normalizeResidentConfig } from './config'

const fullEnv = {
  TDSK_RESIDENT_AGENT_ID: `ag_1`,
  TDSK_RESIDENT_TOKEN: `tdsk_secret`,
  TDSK_BACKEND_URL: `http://tdsk-backend:5885`,
  TDSK_RESIDENT_ORG_ID: `org_1`,
  TDSK_RESIDENT_PROJECT_ID: `proj_1`,
}

describe(`readResidentEnv`, () => {
  it(`reads the full env contract`, () => {
    const env = readResidentEnv(fullEnv)
    expect(env).toMatchObject({
      agentId: `ag_1`,
      token: `tdsk_secret`,
      backendUrl: `http://tdsk-backend:5885`,
      orgId: `org_1`,
      projectId: `proj_1`,
      stateDir: `/workspace/.tdsk-resident`,
      workdir: `/workspace`,
    })
  })

  it(`throws listing EVERY missing var`, () => {
    expect(() => readResidentEnv({})).toThrow(
      /TDSK_RESIDENT_AGENT_ID, TDSK_RESIDENT_TOKEN, TDSK_BACKEND_URL, TDSK_RESIDENT_ORG_ID, TDSK_RESIDENT_PROJECT_ID/
    )
  })

  it(`lets the injected config JSON supply org/project/agent scope`, () => {
    const env = readResidentEnv({
      TDSK_RESIDENT_TOKEN: `tdsk_secret`,
      TDSK_BACKEND_URL: `http://backend`,
      TDSK_RESIDENT_CONFIG: JSON.stringify({
        agentId: `ag_inline`,
        orgId: `org_inline`,
        projectId: `proj_inline`,
      }),
    })
    expect(env.agentId).toBe(`ag_inline`)
    expect(env.orgId).toBe(`org_inline`)
    expect(env.projectId).toBe(`proj_inline`)
  })

  it(`respects state/workdir overrides`, () => {
    const env = readResidentEnv({
      ...fullEnv,
      TDSK_RESIDENT_STATE_DIR: `/data/.state`,
      TDSK_RESIDENT_WORKDIR: `/repo`,
    })
    expect(env.stateDir).toBe(`/data/.state`)
    expect(env.workdir).toBe(`/repo`)
  })

  it(`rejects malformed inline config JSON`, () => {
    expect(() =>
      readResidentEnv({ ...fullEnv, TDSK_RESIDENT_CONFIG: `{not json` })
    ).toThrow(/not valid JSON/)
  })
})

describe(`normalizeResidentConfig`, () => {
  it(`applies full defaults to an empty document`, () => {
    const config = normalizeResidentConfig({}, `ag_1`)
    expect(config.agentId).toBe(`ag_1`)
    expect(config.agenda).toEqual([])
    expect(config.watches).toEqual([])
    expect(config.inbox).toEqual({ pollMs: 15_000, collection: `agent_messages` })
    expect(config.compaction).toEqual({ maxTurns: 40, maxBytes: 400_000 })
    expect(config.subAgents).toEqual({ maxConcurrent: 3 })
    expect(config.selfDirected.minIdleMs).toBe(60_000)
    expect(config.functions).toEqual({})
  })

  it(`drops agenda items with invalid cron or missing fields`, () => {
    const config = normalizeResidentConfig(
      {
        agenda: [
          { key: `good`, cron: `*/5 * * * *`, prompt: `p` },
          { key: `bad-cron`, cron: `not a cron`, prompt: `p` },
          { key: ``, cron: `* * * * *`, prompt: `p` },
          { key: `no-prompt`, cron: `* * * * *`, prompt: `` },
        ],
      },
      `ag_1`
    )
    expect(config.agenda.map((item) => item.key)).toEqual([`good`])
  })

  it(`drops malformed watches`, () => {
    const config = normalizeResidentConfig(
      {
        watches: [
          { key: `good`, collection: `c`, query: {}, prompt: `p` },
          { key: ``, collection: `c`, query: {}, prompt: `p` },
          { key: `no-collection`, collection: ``, query: {}, prompt: `p` },
        ],
      },
      `ag_1`
    )
    expect(config.watches.map((watch) => watch.key)).toEqual([`good`])
  })
})

describe(`config manager`, () => {
  it(`boots from the injected env config with NO HTTP fetch`, async () => {
    const api = makeFakeApi()
    const env = readResidentEnv({
      ...fullEnv,
      TDSK_RESIDENT_CONFIG: JSON.stringify({
        agenda: [{ key: `daily`, cron: `0 9 * * *`, prompt: `run the day` }],
      }),
    })
    const manager = createConfigManager({ env, api })

    // Boot succeeds on the env config alone — zero records queries
    const config = await manager.load()
    expect(config.agenda).toHaveLength(1)
    expect(api.queries).toHaveLength(0)
  })

  it(`refresh OVERRIDES the env-boot config once the records fetch succeeds`, async () => {
    const api = makeFakeApi()
    api.onQuery((collection) =>
      collection === ResidentConfigCollection
        ? {
            ok: true,
            status: 200,
            data: [
              {
                id: `cfg-1`,
                data: { selfDirected: { prompt: `from-records`, minIdleMs: 1000 } },
              },
            ],
          }
        : undefined
    )
    const env = readResidentEnv({
      ...fullEnv,
      TDSK_RESIDENT_CONFIG: JSON.stringify({
        selfDirected: { prompt: `from-env`, minIdleMs: 1000 },
      }),
    })
    const now = { value: 1_000_000 }
    const manager = createConfigManager({
      env,
      api,
      refreshMs: 10_000,
      nowFn: () => now.value,
    })

    await manager.load()
    expect(manager.get().selfDirected.prompt).toBe(`from-env`)
    expect(api.queries).toHaveLength(0)

    // The refresh window passes — the records API becomes the live source
    now.value += 10_001
    await manager.maybeRefresh()
    expect(api.queries).toHaveLength(1)
    expect(manager.get().selfDirected.prompt).toBe(`from-records`)
  })

  it(`refresh failure keeps the last good (env-boot) config — never fatal`, async () => {
    const api = makeFakeApi()
    api.onQuery(() => ({ ok: false, status: 500, error: `boom` }))
    const env = readResidentEnv({
      ...fullEnv,
      TDSK_RESIDENT_CONFIG: JSON.stringify({
        selfDirected: { prompt: `from-env`, minIdleMs: 1000 },
      }),
    })
    const now = { value: 1_000_000 }
    const manager = createConfigManager({
      env,
      api,
      refreshMs: 10_000,
      nowFn: () => now.value,
    })

    await manager.load()
    now.value += 10_001
    await expect(manager.maybeRefresh()).resolves.toBeUndefined()
    expect(api.queries).toHaveLength(1)
    expect(manager.get().selfDirected.prompt).toBe(`from-env`)
  })

  it(`records mode: loads the resident_configs record by agentId`, async () => {
    const api = makeFakeApi()
    api.onQuery((collection) =>
      collection === ResidentConfigCollection
        ? {
            ok: true,
            status: 200,
            data: [
              {
                id: `cfg-1`,
                data: {
                  agenda: [{ key: `daily`, cron: `0 9 * * *`, prompt: `run` }],
                  functions: { heartbeat: `heartbeat` },
                },
              },
            ],
          }
        : undefined
    )
    const manager = createConfigManager({ env: readResidentEnv(fullEnv), api })

    const config = await manager.load()

    expect(api.queries[0].collection).toBe(ResidentConfigCollection)
    expect(api.queries[0].query).toMatchObject({
      where: [{ field: `agentId`, op: `eq`, value: `ag_1` }],
      limit: 1,
    })
    expect(config.agenda[0].key).toBe(`daily`)
    expect(config.functions.heartbeat).toBe(`heartbeat`)
  })

  it(`records mode: throws when no config record exists`, async () => {
    const api = makeFakeApi()
    const manager = createConfigManager({ env: readResidentEnv(fullEnv), api })
    await expect(manager.load()).rejects.toThrow(/No resident_configs record/)
  })

  it(`refresh is throttled and keeps the last good config on failure`, async () => {
    const api = makeFakeApi()
    let payload = { selfDirected: { prompt: `v1`, minIdleMs: 1000 } }
    let fail = false
    api.onQuery(() =>
      fail
        ? { ok: false, status: 500, error: `boom` }
        : { ok: true, status: 200, data: [{ id: `cfg`, data: payload }] }
    )

    const now = { value: 1_000_000 }
    const manager = createConfigManager({
      api,
      env: readResidentEnv(fullEnv),
      refreshMs: 10_000,
      nowFn: () => now.value,
    })
    await manager.load()
    expect(manager.get().selfDirected.prompt).toBe(`v1`)

    // Inside the throttle window — no query
    payload = { selfDirected: { prompt: `v2`, minIdleMs: 1000 } }
    now.value += 5000
    await manager.maybeRefresh()
    expect(api.queries).toHaveLength(1)
    expect(manager.get().selfDirected.prompt).toBe(`v1`)

    // Window passed — refetches and applies (the agent evolved its own config)
    now.value += 5001
    await manager.maybeRefresh()
    expect(manager.get().selfDirected.prompt).toBe(`v2`)

    // A failing refresh keeps the last good config
    fail = true
    now.value += 10_001
    await manager.maybeRefresh()
    expect(manager.get().selfDirected.prompt).toBe(`v2`)
  })

  it(`get() before load() throws`, () => {
    const manager = createConfigManager({
      env: readResidentEnv(fullEnv),
      api: makeFakeApi(),
    })
    expect(() => manager.get()).toThrow(/not loaded/)
  })
})
