import type { TCompactor } from './compactor'
import type { TActionPump } from './pump'
import type { TSessionManager } from './session'
import type { TSubAgentPool } from './subagents'
import type { TResidentConfig, TSessionState } from './types/resident.types'

import { describe, it, expect, vi } from 'vitest'

import { createEventLoop } from './loop'
import { makeConfig, makeFakeApi } from './testUtils'
import { EResidentEventKind } from './types/resident.types'

type TFakeSession = TSessionManager & {
  turns: string[]
  scriptOutput: (output: string) => void
  scriptOk: (ok: boolean) => void
}

const makeFakeSession = (): TFakeSession => {
  const turns: string[] = []
  let nextOutput = `turn output`
  let nextOk = true
  const state: TSessionState = { turnCount: 0, totalBytes: 0 }

  return {
    turns,
    scriptOutput: (output: string) => {
      nextOutput = output
    },
    scriptOk: (ok: boolean) => {
      nextOk = ok
    },
    hasSession: () => Boolean(state.sessionId),
    getSessionId: () => state.sessionId,
    getState: () => ({ ...state }),
    getCheckpointSummary: () => state.checkpointSummary,
    rotateSession: (summary) => {
      state.sessionId = undefined
      state.turnCount = 0
      state.totalBytes = 0
      state.checkpointSummary = summary
    },
    runTurn: async (prompt: string) => {
      turns.push(prompt)
      state.sessionId = `sess-1`
      state.turnCount += 1
      return {
        ok: nextOk,
        output: nextOutput,
        sessionId: `sess-1`,
        exitCode: nextOk ? 0 : 1,
        timedOut: false,
        durationMs: 5,
      }
    },
  }
}

const makePump = (): TActionPump & { pumped: string[] } => {
  const pumped: string[] = []
  return {
    pumped,
    pump: async (text: string) => {
      pumped.push(text)
      return {
        total: 0,
        dispatched: 0,
        failed: 0,
        allowlistRejected: 0,
        memoriesSkipped: 0,
        functionsAuthored: 0,
        functionsRejected: 0,
        secretsStored: 0,
        secretsRejected: 0,
        endpointsAuthored: 0,
        endpointsRejected: 0,
      }
    },
  }
}

const makeCompactor = (
  shouldCompact = () => false
): TCompactor & { compactions: number[] } => {
  const compactions: number[] = []
  return {
    compactions,
    shouldCompact,
    compact: async () => {
      compactions.push(Date.now())
      return { compacted: true }
    },
  }
}

type TLoopHarness = {
  config: TResidentConfig
  now: { value: number }
}

const makeLoop = (
  overrides: Partial<TResidentConfig> = {},
  harness: Partial<TLoopHarness> = {}
) => {
  const api = makeFakeApi()
  const session = makeFakeSession()
  const pump = makePump()
  const compactor = makeCompactor()
  const config = harness.config ?? makeConfig(overrides)
  const now = harness.now ?? { value: 1_000_000 }

  const loop = createEventLoop({
    api,
    session,
    pump,
    compactor,
    getConfig: () => config,
    nowFn: () => now.value,
  })
  return { loop, api, session, pump, compactor, config, now }
}

describe(`queue ordering`, () => {
  it(`runs overdue agenda before inbox, inbox before watches (priority preemption)`, async () => {
    const { loop, session } = makeLoop()

    // Enqueue in reverse-priority order — the queue must reorder
    loop.enqueue({ kind: EResidentEventKind.watch, key: `w1`, prompt: `watch prompt` })
    loop.enqueue({
      kind: EResidentEventKind.inbox,
      key: `m1`,
      messages: [{ id: `msg-1`, data: { subject: `hi` } }],
    })
    loop.enqueue({ kind: EResidentEventKind.agenda, key: `a1`, prompt: `agenda prompt` })

    expect(loop.getQueueDepth()).toBe(3)
    await loop.runNext()
    await loop.runNext()
    await loop.runNext()

    expect(session.turns[0]).toContain(`# Agenda: a1`)
    expect(session.turns[1]).toContain(`# Inbox — 1 new message(s)`)
    expect(session.turns[2]).toContain(`# Watch fired: w1`)
  })

  it(`preserves FIFO within the same priority`, async () => {
    const { loop, session } = makeLoop()

    loop.enqueue({ kind: EResidentEventKind.agenda, key: `first`, prompt: `p1` })
    loop.enqueue({ kind: EResidentEventKind.agenda, key: `second`, prompt: `p2` })

    await loop.runNext()
    await loop.runNext()

    expect(session.turns[0]).toContain(`# Agenda: first`)
    expect(session.turns[1]).toContain(`# Agenda: second`)
  })

  it(`an overdue agenda item preempts a queued self-directed turn (drops it)`, async () => {
    const { loop, session } = makeLoop({
      selfDirected: { prompt: `choose your next action`, minIdleMs: 0 },
    })

    await loop.scan() // idle ≥ 0ms → self-directed queued
    expect(loop.getQueueDepth()).toBe(1)

    loop.enqueue({ kind: EResidentEventKind.agenda, key: `board`, prompt: `agenda` })
    // Real work superseded the queued self-directed intent
    expect(loop.getQueueDepth()).toBe(1)

    await loop.runNext()
    expect(session.turns).toHaveLength(1)
    expect(session.turns[0]).toContain(`# Agenda: board`)
  })

  it(`dedupes a pending event key (agenda cannot double-queue)`, () => {
    const { loop } = makeLoop()
    loop.enqueue({ kind: EResidentEventKind.agenda, key: `a1`, prompt: `p` })
    loop.enqueue({ kind: EResidentEventKind.agenda, key: `a1`, prompt: `p` })
    expect(loop.getQueueDepth()).toBe(1)
  })

  it(`single-flight: runNext refuses while a turn is in flight`, async () => {
    const { loop } = makeLoop()
    loop.enqueue({ kind: EResidentEventKind.agenda, key: `a1`, prompt: `p` })
    loop.enqueue({ kind: EResidentEventKind.agenda, key: `a2`, prompt: `p` })

    const first = loop.runNext()
    expect(await loop.runNext()).toBe(false)
    await first
    expect(loop.getQueueDepth()).toBe(1)
  })
})

describe(`agenda scheduling`, () => {
  it(`fires an agenda item when its cron comes due, then reschedules`, async () => {
    const now = { value: Date.parse(`2026-07-08T10:00:30Z`) }
    const config = makeConfig({
      agenda: [{ key: `every-minute`, cron: `* * * * *`, prompt: `do the rounds` }],
    })
    const { loop } = makeLoop({}, { config, now })

    await loop.scan() // primes nextRunAt (next minute boundary) — nothing due yet
    expect(loop.getQueueDepth()).toBe(0)

    now.value += 61_000
    await loop.scan()
    expect(loop.getQueueDepth()).toBe(1)

    // Not due again until the following boundary
    await loop.runNext()
    await loop.scan()
    expect(loop.getQueueDepth()).toBe(0)
  })

  it(`reschedules an agenda item when its cron changes under a live config refresh`, async () => {
    const now = { value: Date.parse(`2026-07-08T10:00:30Z`) }
    const config = makeConfig({
      agenda: [{ key: `groom`, cron: `0 * * * *`, prompt: `groom` }],
    })
    const { loop } = makeLoop({}, { config, now })

    await loop.scan() // hourly cron → nextRunAt is 11:00; nothing due yet
    expect(loop.getQueueDepth()).toBe(0)

    // A live config refresh tightens the cadence to every minute. Without the
    // cron-change detection the stale 11:00 nextRunAt would persist and nothing
    // would fire for ~an hour; with it, the item reschedules onto the new cron.
    config.agenda[0].cron = `* * * * *`
    now.value += 61_000 // 10:01:31 — reschedules forward to 10:02:00 (not due yet)
    await loop.scan()
    expect(loop.getQueueDepth()).toBe(0)

    now.value += 60_000 // 10:02:31 — past the NEW cron's boundary
    await loop.scan()
    expect(loop.getQueueDepth()).toBe(1)
  })
})

describe(`self-directed turns`, () => {
  it(`fires ONLY after the queue has been empty ≥ minIdleMs`, async () => {
    const now = { value: 1_000_000 }
    const { loop } = makeLoop(
      { selfDirected: { prompt: `pick your next action`, minIdleMs: 5000 } },
      { now }
    )

    await loop.scan()
    expect(loop.getQueueDepth()).toBe(0) // not idle long enough

    now.value += 4999
    await loop.scan()
    expect(loop.getQueueDepth()).toBe(0)

    now.value += 2
    await loop.scan()
    expect(loop.getQueueDepth()).toBe(1)
  })

  it(`does not fire while other work is queued`, async () => {
    const now = { value: 1_000_000 }
    const { loop } = makeLoop({ selfDirected: { prompt: `pick`, minIdleMs: 0 } }, { now })
    loop.enqueue({ kind: EResidentEventKind.watch, key: `w`, prompt: `p` })

    now.value += 60_000
    await loop.scan()

    // Only the watch is queued — no self-directed alongside real work
    expect(loop.getQueueDepth()).toBe(1)
  })

  it(`idle clock resets after a turn completes`, async () => {
    const now = { value: 1_000_000 }
    const { loop, session } = makeLoop(
      { selfDirected: { prompt: `pick`, minIdleMs: 5000 } },
      { now }
    )

    now.value += 6000
    await loop.scan()
    await loop.runNext()
    expect(session.turns[0]).toContain(`# Self-directed turn`)

    // Turn completion refreshed lastActivityAt → not idle yet
    await loop.scan()
    expect(loop.getQueueDepth()).toBe(0)

    now.value += 5001
    await loop.scan()
    expect(loop.getQueueDepth()).toBe(1)
  })
})

describe(`watches`, () => {
  const watchConfig = (debounceMs: number) =>
    makeConfig({
      watches: [
        {
          key: `open-decisions`,
          collection: `decision_proposals`,
          query: { limit: 10 },
          prompt: `a decision changed`,
          pollMs: 1,
          debounceMs,
        },
      ],
    })

  it(`primes on first poll (no fire on boot), fires on change-hash, stays quiet when unchanged`, async () => {
    const now = { value: 1_000_000 }
    const config = watchConfig(0)
    const { loop, api } = makeLoop({}, { config, now })

    let records = [{ id: `r1`, data: { status: `open` } }]
    api.onQuery((collection) =>
      collection === `decision_proposals`
        ? { ok: true, status: 200, data: records }
        : undefined
    )

    await loop.scan() // prime — baseline hash, NO event
    expect(loop.getQueueDepth()).toBe(0)

    now.value += 10
    await loop.scan() // unchanged — no event
    expect(loop.getQueueDepth()).toBe(0)

    records = [{ id: `r1`, data: { status: `deliberating` } }]
    now.value += 10
    await loop.scan() // changed — fires
    expect(loop.getQueueDepth()).toBe(1)

    await loop.runNext()
    now.value += 10
    await loop.scan() // same hash as last fire — no event
    expect(loop.getQueueDepth()).toBe(0)
  })

  it(`debounces: a change within the debounce window does not fire`, async () => {
    const now = { value: 1_000_000 }
    const config = watchConfig(10_000)
    const { loop, api } = makeLoop({}, { config, now })

    let records = [{ id: `r1`, data: { v: 1 } }]
    api.onQuery((collection) =>
      collection === `decision_proposals`
        ? { ok: true, status: 200, data: records }
        : undefined
    )

    await loop.scan() // prime
    records = [{ id: `r1`, data: { v: 2 } }]
    now.value += 10
    await loop.scan() // first change fires (lastFiredAt=0 → window passed)
    expect(loop.getQueueDepth()).toBe(1)
    await loop.runNext()

    records = [{ id: `r1`, data: { v: 3 } }]
    now.value += 100
    await loop.scan() // inside the 10s debounce window — no fire
    expect(loop.getQueueDepth()).toBe(0)

    now.value += 10_000
    await loop.scan() // window passed and hash still differs — fires
    expect(loop.getQueueDepth()).toBe(1)
  })

  it(`includes the matched records in the watch turn framing`, async () => {
    const now = { value: 1_000_000 }
    const config = watchConfig(0)
    const { loop, api, session } = makeLoop({}, { config, now })

    let records = [{ id: `r9`, data: { title: `Ship it?` } }]
    api.onQuery((collection) =>
      collection === `decision_proposals`
        ? { ok: true, status: 200, data: records }
        : undefined
    )

    await loop.scan()
    records = [{ id: `r9`, data: { title: `Ship it!` } }]
    now.value += 10
    await loop.scan()
    await loop.runNext()

    expect(session.turns[0]).toContain(`# Watch fired: open-decisions`)
    expect(session.turns[0]).toContain(`Ship it!`)
    expect(session.turns[0]).toContain(`r9`)
  })

  it(`re-checks live state at dispatch time — a record that left the watch's target condition between poll and dispatch is not framed as stale`, async () => {
    const now = { value: 1_000_000 }
    const config = watchConfig(0)
    const { loop, api, session } = makeLoop({}, { config, now })

    // The fake api ignores query CONTENT, so this handler stands in for the
    // real backend evaluating watch.query server-side: `queryLive` is the
    // ground truth both scanWatches' poll AND the dispatch-time refresh read.
    let queryLive: () => Array<{ id: string; data: Record<string, unknown> }> = () => [
      { id: `r1`, data: { state: `backlog` } },
    ]
    api.onQuery((collection) =>
      collection === `decision_proposals`
        ? { ok: true, status: 200, data: queryLive() as any }
        : undefined
    )

    queryLive = () => []
    await loop.scan() // prime — baseline hash on an empty board

    queryLive = () => [{ id: `r1`, data: { state: `backlog` } }]
    now.value += 10
    await loop.scan() // the task enters backlog — hash changed, fires

    expect(loop.getQueueDepth()).toBe(1)

    // Simulate the record leaving the watch's target condition (e.g. an
    // abandon) WHILE the event still sits queued, before it is dispatched.
    queryLive = () => []

    await loop.runNext()

    expect(api.queries.filter((q) => q.collection === `decision_proposals`)).toHaveLength(
      3
    )
    expect(session.turns[0]).toContain(`# Watch fired: open-decisions`)
    expect(session.turns[0]).not.toContain(`r1`)
    expect(session.turns[0]).toContain(`## Matched records\n[]`)
  })
})

describe(`inbox`, () => {
  it(`polls unread messages, runs the turn, and marks them read via records upsert`, async () => {
    const now = { value: 1_000_000 }
    const config = makeConfig({ inbox: { pollMs: 1, collection: `agent_messages` } })
    const { loop, api, session } = makeLoop({}, { config, now })

    api.onQuery((collection) =>
      collection === `agent_messages`
        ? {
            ok: true,
            status: 200,
            data: [
              { id: `m1`, data: { from: `ag_ceo`, subject: `align` } },
              {
                id: `m2`,
                data: { from: `ag_cto`, subject: `review`, readAt: `2026-07-08` },
              },
            ],
          }
        : undefined
    )

    now.value += 10
    await loop.scan()
    expect(loop.getQueueDepth()).toBe(1)
    await loop.runNext()

    // Only the UNREAD message rode the turn
    expect(session.turns[0]).toContain(`ag_ceo`)
    expect(session.turns[0]).not.toContain(`ag_cto`)

    // Read receipt patched through the records API (no markMessageRead configured)
    expect(api.upserts).toHaveLength(1)
    expect(api.upserts[0].record.id).toBe(`m1`)
    expect(api.upserts[0].record.data.readAt).toBeTruthy()

    // The seen-set prevents refire even before the patch lands server-side
    now.value += 10
    await loop.scan()
    expect(loop.getQueueDepth()).toBe(0)
  })

  it(`does NOT mark a message read when the turn FAILED (so it is reprocessed)`, async () => {
    const now = { value: 1_000_000 }
    const config = makeConfig({ inbox: { pollMs: 1, collection: `agent_messages` } })
    const { loop, api, session } = makeLoop({}, { config, now })

    api.onQuery((collection) =>
      collection === `agent_messages`
        ? {
            ok: true,
            status: 200,
            data: [{ id: `m1`, data: { from: `ag_ceo`, subject: `align` } }],
          }
        : undefined
    )

    // Every provider is down → the turn fails.
    session.scriptOk(false)

    now.value += 10
    await loop.scan()
    await loop.runNext()

    expect(session.turns).toHaveLength(1) // the turn ran
    // …but the message was NOT marked read — no read-receipt upsert.
    expect(api.upserts).toHaveLength(0)
  })

  it(`uses the configured markMessageRead Function when present`, async () => {
    const now = { value: 1_000_000 }
    const config = makeConfig({
      inbox: { pollMs: 1, collection: `agent_messages` },
      functions: { markMessageRead: `markMessageRead` },
    })
    const { loop, api } = makeLoop({}, { config, now })

    api.onQuery((collection) =>
      collection === `agent_messages`
        ? { ok: true, status: 200, data: [{ id: `m1`, data: { subject: `s` } }] }
        : undefined
    )

    now.value += 10
    await loop.scan()
    await loop.runNext()

    expect(api.upserts).toHaveLength(0)
    const markCalls = api.dispatched
      .flat()
      .filter((a) => a.function === `markMessageRead`)
    expect(markCalls).toEqual([{ function: `markMessageRead`, args: { id: `m1` } }])
  })
})

describe(`turn assembly + effects`, () => {
  it(`seeds the FIRST turn of a session (seed + directives + checkpoint summary), not later turns`, async () => {
    const config = makeConfig({
      session: {
        seedPrompt: `You are the CMO.`,
        standingDirectives: `Never wait for humans.`,
        contextSources: [],
      },
    })
    const { loop, session } = makeLoop({}, { config })
    session.rotateSession(`prior summary`)

    loop.enqueue({ kind: EResidentEventKind.agenda, key: `a1`, prompt: `p1` })
    await loop.runNext()

    expect(session.turns[0]).toContain(`You are the CMO.`)
    expect(session.turns[0]).toContain(`## Standing directives`)
    expect(session.turns[0]).toContain(`prior summary`)

    loop.enqueue({ kind: EResidentEventKind.agenda, key: `a2`, prompt: `p2` })
    await loop.runNext()
    expect(session.turns[1]).not.toContain(`You are the CMO.`)
  })

  it(`renders fresh contextSources into every turn`, async () => {
    const config = makeConfig({
      session: {
        contextSources: [{ collection: `plans`, query: {}, as: `Active plans` }],
      },
    })
    const { loop, api, session } = makeLoop({}, { config })
    api.onQuery((collection) =>
      collection === `plans`
        ? { ok: true, status: 200, data: [{ id: `p1`, data: { goal: `growth` } }] }
        : undefined
    )

    loop.enqueue({ kind: EResidentEventKind.agenda, key: `a1`, prompt: `p` })
    await loop.runNext()

    expect(session.turns[0]).toContain(`## Active plans`)
    expect(session.turns[0]).toContain(`growth`)
    expect(session.turns[0]).toContain(`p1`)
  })

  it(`pumps every turn's output and spawns requested sub-agents`, async () => {
    const { loop, session, pump } = makeLoop()
    const spawned: string[] = []
    const pool: TSubAgentPool = {
      activeCount: () => 0,
      spawnSubAgent: (request) => {
        spawned.push(request.prompt)
        return { ok: true }
      },
    }
    loop.attachSubAgents(pool)

    session.scriptOutput(
      `working...\n\`\`\`tdsk-spawn\n[{"key":"r1","prompt":"research the market"}]\n\`\`\``
    )
    loop.enqueue({ kind: EResidentEventKind.agenda, key: `a1`, prompt: `p` })
    await loop.runNext()

    expect(pump.pumped).toHaveLength(1)
    expect(spawned).toEqual([`research the market`])
  })

  it(`enqueues sub-agent completions as internal (inbox-priority) events with the tail output`, async () => {
    const { loop, session } = makeLoop()

    loop.enqueueSubAgentResult({
      key: `research`,
      ok: true,
      output: `the findings`,
      exitCode: 0,
      timedOut: false,
      durationMs: 2000,
    })
    loop.enqueue({ kind: EResidentEventKind.watch, key: `w`, prompt: `p` })

    await loop.runNext()
    expect(session.turns[0]).toContain(`# Sub-agent completed: research`)
    expect(session.turns[0]).toContain(`the findings`)
  })

  it(`compacts after a turn when the compactor says so`, async () => {
    const api = makeFakeApi()
    const session = makeFakeSession()
    const pump = makePump()
    const compactor = makeCompactor(() => true)
    const loop = createEventLoop({
      api,
      session,
      pump,
      compactor,
      getConfig: () => makeConfig(),
      nowFn: () => 1_000_000,
    })

    loop.enqueue({ kind: EResidentEventKind.agenda, key: `a1`, prompt: `p` })
    await loop.runNext()

    expect(compactor.compactions).toHaveLength(1)
  })
})

describe(`status + shutdown`, () => {
  it(`start() holds a REF'D interval — the process must not exit while the loop runs`, async () => {
    // Live failure 2026-07-08: unref'd timers let Node exit 0 minutes after
    // "runtime is live" (pods Completed). The scan interval IS the process
    // keepalive; it must stay ref'd until shutdown clears it.
    const setIntervalSpy = vi.spyOn(globalThis, `setInterval`)
    const { loop } = makeLoop()
    loop.start()
    try {
      const timer = setIntervalSpy.mock.results.at(-1)?.value as NodeJS.Timeout
      expect(timer.hasRef?.()).not.toBe(false)
    } finally {
      await loop.shutdown()
      setIntervalSpy.mockRestore()
    }
  })

  it(`exposes queue depth + activity for the heartbeat`, async () => {
    const { loop } = makeLoop()
    loop.enqueue({ kind: EResidentEventKind.agenda, key: `a1`, prompt: `p` })

    const before = loop.getStatus()
    expect(before.queueDepth).toBe(1)
    expect(before.currentActivity).toBe(`idle`)
    expect(before.turnCount).toBe(0)

    await loop.runNext()
    const after = loop.getStatus()
    expect(after.queueDepth).toBe(0)
    expect(after.turnCount).toBe(1)
    expect(after.sessionId).toBe(`sess-1`)
    expect(after.lastTurnAt).toBeTruthy()
  })

  it(`shutdown finishes the in-flight turn, then checkpoints (SIGTERM contract)`, async () => {
    const api = makeFakeApi()
    const pump = makePump()
    const compactor = makeCompactor()
    const turns: string[] = []
    let releaseTurn: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      releaseTurn = resolve
    })
    let sessionLive = false
    const session: TSessionManager = {
      hasSession: () => sessionLive,
      getSessionId: () => (sessionLive ? `sess-1` : undefined),
      getState: () => ({ turnCount: 1, totalBytes: 10 }),
      getCheckpointSummary: () => undefined,
      rotateSession: () => {
        sessionLive = false
      },
      runTurn: async (prompt: string) => {
        turns.push(prompt)
        await gate
        sessionLive = true
        return { ok: true, output: `done`, timedOut: false, durationMs: 1 }
      },
    }
    const loop = createEventLoop({
      api,
      session,
      pump,
      compactor,
      getConfig: () => makeConfig(),
      nowFn: Date.now,
    })

    loop.enqueue({ kind: EResidentEventKind.agenda, key: `a1`, prompt: `p` })
    const turnPromise = loop.runNext()

    let shutdownDone = false
    const shutdownPromise = loop.shutdown().then(() => {
      shutdownDone = true
    })
    await new Promise((resolve) => setImmediate(resolve))
    expect(shutdownDone).toBe(false) // waiting on the in-flight turn

    releaseTurn?.()
    await turnPromise
    await shutdownPromise

    expect(shutdownDone).toBe(true)
    expect(compactor.compactions).toHaveLength(1) // the exit checkpoint
  })

  it(`shutdown with no live session skips the checkpoint`, async () => {
    const { loop, compactor } = makeLoop()
    await loop.shutdown()
    expect(compactor.compactions).toHaveLength(0)
  })
})
