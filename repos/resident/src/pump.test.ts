import { describe, it, expect, vi } from 'vitest'

import { createActionPump } from './pump'
import { makeFakeApi, makeConfig } from './testUtils'

const actionsFence = (json: string) => `\`\`\`tdsk-actions\n${json}\n\`\`\``
const memoriesFence = (json: string) => `\`\`\`tdsk-memories\n${json}\n\`\`\``

const manyActions = (count: number) =>
  JSON.stringify(
    Array.from({ length: count }, (_, i) => ({ function: `fn${i}`, args: { i } }))
  )

describe(`action pump`, () => {
  it(`is a no-op when the output has no fenced blocks`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(`just chatter, no fences`)

    expect(report.total).toBe(0)
    expect(api.dispatched).toHaveLength(0)
  })

  it(`dispatches parsed actions and reports successes`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(
      actionsFence(`[{"function":"sendAgentMessage","args":{"to":"ag_2"}}]`)
    )

    expect(report).toEqual({
      total: 1,
      dispatched: 1,
      failed: 0,
      allowlistRejected: 0,
      memoriesSkipped: 0,
    })
    expect(api.dispatched).toHaveLength(1)
    expect(api.dispatched[0][0]).toEqual({
      function: `sendAgentMessage`,
      args: { to: `ag_2` },
    })
  })

  it(`chunks dispatches to the endpoint's 20-action cap`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(actionsFence(manyActions(45)))

    expect(api.dispatched.map((chunk) => chunk.length)).toEqual([20, 20, 5])
    expect(report.dispatched).toBe(45)
  })

  it(`retries transport failures with backoff, then succeeds`, async () => {
    const api = makeFakeApi()
    let attempts = 0
    api.onDispatch((actions) => {
      attempts += 1
      return attempts < 3
        ? { ok: false, status: 0, error: `ECONNREFUSED` }
        : { ok: true, status: 200, data: actions.map(() => ({ ok: true })) }
    })
    const slept: number[] = []
    const pump = createActionPump({
      api,
      getConfig: () => makeConfig(),
      sleepFn: async (ms) => {
        slept.push(ms)
      },
    })

    const report = await pump.pump(actionsFence(`[{"function":"f","args":{}}]`))

    expect(attempts).toBe(3)
    expect(slept).toEqual([1000, 5000])
    expect(report.dispatched).toBe(1)
    expect(report.failed).toBe(0)
  })

  it(`gives up after max attempts and counts the chunk failed`, async () => {
    const api = makeFakeApi()
    api.onDispatch(() => ({ ok: false, status: 503, error: `unavailable` }))
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    const pump = createActionPump({ api, getConfig: () => makeConfig(), sleepFn })

    const report = await pump.pump(actionsFence(`[{"function":"f","args":{}}]`))

    expect(api.dispatched).toHaveLength(3)
    expect(report.failed).toBe(1)
    expect(report.dispatched).toBe(0)
  })

  it(`does NOT retry 4xx responses (terminal client errors)`, async () => {
    const api = makeFakeApi()
    api.onDispatch(() => ({ ok: false, status: 403, error: `forbidden` }))
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(actionsFence(`[{"function":"f","args":{}}]`))

    expect(api.dispatched).toHaveLength(1)
    expect(report.failed).toBe(1)
  })

  it(`counts allowlist rejections from per-action results`, async () => {
    const api = makeFakeApi()
    api.onDispatch(() => ({
      ok: true,
      status: 200,
      data: [{ ok: true }, { ok: false, error: `function not allowed: forbiddenFn` }],
    }))
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(
      actionsFence(`[{"function":"okFn","args":{}},{"function":"forbiddenFn","args":{}}]`)
    )

    expect(report.dispatched).toBe(1)
    expect(report.failed).toBe(1)
    expect(report.allowlistRejected).toBe(1)
  })

  it(`dispatches tdsk-memories through the configured writeMemory Function`, async () => {
    const api = makeFakeApi()
    const config = makeConfig({ functions: { writeMemory: `writeMemory` } })
    const pump = createActionPump({ api, getConfig: () => config })

    const report = await pump.pump(
      memoriesFence(`[{"text":"remember this","importance":8},{"text":""}]`)
    )

    expect(report.total).toBe(1)
    expect(api.dispatched[0][0]).toEqual({
      function: `writeMemory`,
      args: { text: `remember this`, importance: 8 },
    })
  })

  it(`logs-and-skips memories when no writeMemory Function is configured`, async () => {
    const api = makeFakeApi()
    const pump = createActionPump({ api, getConfig: () => makeConfig() })

    const report = await pump.pump(memoriesFence(`[{"text":"remember this"}]`))

    expect(report.memoriesSkipped).toBe(1)
    expect(report.total).toBe(0)
    expect(api.dispatched).toHaveLength(0)
  })

  it(`pumps actions and memories from the same turn output together`, async () => {
    const api = makeFakeApi()
    const config = makeConfig({ functions: { writeMemory: `writeMemory` } })
    const pump = createActionPump({ api, getConfig: () => config })

    const report = await pump.pump(
      `${actionsFence(`[{"function":"a","args":{}}]`)}\n${memoriesFence(`[{"text":"m"}]`)}`
    )

    expect(report.total).toBe(2)
    expect(api.dispatched[0].map((action) => action.function)).toEqual([
      `a`,
      `writeMemory`,
    ])
  })
})
