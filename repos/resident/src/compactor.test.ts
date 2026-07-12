import type { TSessionManager } from './session'

import { describe, it, expect, vi } from 'vitest'

import { createCompactor } from './compactor'
import { makeConfig } from './testUtils'
import { CheckpointPrompt } from './constants'

const makeSession = (
  state: { sessionId?: string; turnCount: number; totalBytes: number },
  turnOutput = `checkpoint summary text`
) => {
  const rotations: Array<string | undefined> = []
  const turns: string[] = []
  const session: TSessionManager = {
    hasSession: () => Boolean(state.sessionId),
    getSessionId: () => state.sessionId,
    getState: () => ({ ...state }),
    getCheckpointSummary: () => undefined,
    rotateSession: (summary) => {
      rotations.push(summary)
      state.sessionId = undefined
      state.turnCount = 0
      state.totalBytes = 0
    },
    runTurn: async (prompt: string) => {
      turns.push(prompt)
      return { ok: true, output: turnOutput, timedOut: false, durationMs: 1 }
    },
  }
  return { session, rotations, turns }
}

const makePump = () => {
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
        discardedActionBlocks: 0,
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

describe(`compactor`, () => {
  const config = makeConfig({ compaction: { maxTurns: 10, maxBytes: 1000 } })

  it(`does not trigger below both thresholds`, () => {
    const { session } = makeSession({ sessionId: `s`, turnCount: 9, totalBytes: 999 })
    const compactor = createCompactor({
      session,
      pump: makePump(),
      getConfig: () => config,
    })
    expect(compactor.shouldCompact()).toBe(false)
  })

  it(`triggers at the turn threshold`, () => {
    const { session } = makeSession({ sessionId: `s`, turnCount: 10, totalBytes: 0 })
    const compactor = createCompactor({
      session,
      pump: makePump(),
      getConfig: () => config,
    })
    expect(compactor.shouldCompact()).toBe(true)
  })

  it(`triggers at the byte threshold`, () => {
    const { session } = makeSession({ sessionId: `s`, turnCount: 1, totalBytes: 1000 })
    const compactor = createCompactor({
      session,
      pump: makePump(),
      getConfig: () => config,
    })
    expect(compactor.shouldCompact()).toBe(true)
  })

  it(`never triggers without a live session (nothing to checkpoint)`, () => {
    const { session } = makeSession({ turnCount: 99, totalBytes: 999_999 })
    const compactor = createCompactor({
      session,
      pump: makePump(),
      getConfig: () => config,
    })
    expect(compactor.shouldCompact()).toBe(false)
  })

  it(`compact() runs the checkpoint turn, pumps its effects, and rotates with the summary`, async () => {
    const { session, rotations, turns } = makeSession(
      { sessionId: `s`, turnCount: 10, totalBytes: 0 },
      `durable memories written; summary: mid-flight on the pricing page`
    )
    const pump = makePump()
    const compactor = createCompactor({ session, pump, getConfig: () => config })

    const result = await compactor.compact()

    expect(result.compacted).toBe(true)
    expect(turns).toEqual([CheckpointPrompt])
    expect(pump.pumped).toHaveLength(1) // checkpoint memories ride the pump
    expect(rotations).toEqual([
      `durable memories written; summary: mid-flight on the pricing page`,
    ])
    expect(session.hasSession()).toBe(false)
  })

  it(`rotates with an empty seed when the checkpoint turn fails`, async () => {
    const state = { sessionId: `s`, turnCount: 10, totalBytes: 0 }
    const rotations: Array<string | undefined> = []
    const session: TSessionManager = {
      hasSession: () => Boolean(state.sessionId),
      getSessionId: () => state.sessionId,
      getState: () => ({ ...state }),
      getCheckpointSummary: () => undefined,
      rotateSession: (summary) => {
        rotations.push(summary)
        state.sessionId = undefined
      },
      runTurn: async () => ({
        ok: false,
        output: ``,
        timedOut: true,
        durationMs: 1,
        error: `timed out`,
      }),
    }
    const compactor = createCompactor({
      session,
      pump: makePump(),
      getConfig: () => config,
    })

    const result = await compactor.compact()
    expect(result.compacted).toBe(true)
    expect(rotations).toEqual([undefined])
  })

  it(`compact() is a no-op without a live session`, async () => {
    const { session, rotations } = makeSession({ turnCount: 0, totalBytes: 0 })
    const compactor = createCompactor({
      session,
      pump: makePump(),
      getConfig: () => config,
    })

    const result = await compactor.compact()
    expect(result.compacted).toBe(false)
    expect(rotations).toHaveLength(0)
  })
})
