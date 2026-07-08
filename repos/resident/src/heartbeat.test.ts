import { describe, it, expect } from 'vitest'

import { createHeartbeat } from './heartbeat'
import { makeConfig, makeFakeApi } from './testUtils'

const status = {
  sessionId: `sess-1`,
  queueDepth: 2,
  currentActivity: `agenda:board`,
  lastTurnAt: `2026-07-08T10:00:00.000Z`,
  turnCount: 7,
}

describe(`heartbeat`, () => {
  it(`dispatches the status through the configured heartbeat Function`, async () => {
    const api = makeFakeApi()
    const heartbeat = createHeartbeat({
      api,
      getConfig: () => makeConfig({ functions: { heartbeat: `heartbeat` } }),
      getStatus: () => ({ ...status }),
    })

    await heartbeat.beat()

    expect(api.dispatched).toHaveLength(1)
    expect(api.dispatched[0][0]).toEqual({
      function: `heartbeat`,
      args: {
        sessionId: `sess-1`,
        queueDepth: 2,
        currentActivity: `agenda:board`,
        lastTurnAt: `2026-07-08T10:00:00.000Z`,
        turnCount: 7,
      },
    })
  })

  it(`skips (log-only) when no heartbeat Function is configured — no platform assumption`, async () => {
    const api = makeFakeApi()
    const heartbeat = createHeartbeat({
      api,
      getConfig: () => makeConfig(),
      getStatus: () => ({ ...status }),
    })

    await heartbeat.beat()
    expect(api.dispatched).toHaveLength(0)
  })

  it(`survives a failing dispatch`, async () => {
    const api = makeFakeApi()
    api.onDispatch(() => ({ ok: false, status: 503, error: `down` }))
    const heartbeat = createHeartbeat({
      api,
      getConfig: () => makeConfig({ functions: { heartbeat: `heartbeat` } }),
      getStatus: () => ({ ...status }),
    })

    await expect(heartbeat.beat()).resolves.toBeUndefined()
  })

  it(`start/stop manage the interval idempotently`, () => {
    const api = makeFakeApi()
    const heartbeat = createHeartbeat({
      api,
      getConfig: () => makeConfig(),
      getStatus: () => ({ ...status }),
      intervalMs: 60_000,
    })
    heartbeat.start()
    heartbeat.start()
    heartbeat.stop()
    heartbeat.stop()
  })
})
