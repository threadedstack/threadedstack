import path from 'node:path'
import { tmpdir } from 'node:os'
import { readFileSync, mkdtempSync } from 'node:fs'
import { describe, it, expect, beforeEach } from 'vitest'

import { createSessionManager } from './session'
import { SessionStateFile } from './constants'
import { makeSpawnFn, claudeJson } from './testUtils'

let stateDir: string

beforeEach(() => {
  stateDir = mkdtempSync(path.join(tmpdir(), `resident-session-`))
})

describe(`session manager`, () => {
  it(`runs the first turn without --resume and captures the session id`, async () => {
    const { spawnFn, calls } = makeSpawnFn((call) => {
      call.child.emitStdout(claudeJson(`first result`, `sess-abc`))
      call.child.emitClose(0)
    })
    const session = createSessionManager({ stateDir, spawnFn })

    const result = await session.runTurn(`hello`)

    expect(calls).toHaveLength(1)
    expect(calls[0].bin).toBe(`claude`)
    expect(calls[0].args).not.toContain(`--resume`)
    expect(calls[0].args[calls[0].args.length - 1]).toBe(`hello`)
    expect(result.ok).toBe(true)
    expect(result.output).toBe(`first result`)
    expect(result.sessionId).toBe(`sess-abc`)
    expect(session.getSessionId()).toBe(`sess-abc`)
  })

  it(`resumes subsequent turns with the captured session id`, async () => {
    const { spawnFn, calls } = makeSpawnFn((call) => {
      call.child.emitStdout(claudeJson(`ok`, `sess-abc`))
      call.child.emitClose(0)
    })
    const session = createSessionManager({ stateDir, spawnFn })

    await session.runTurn(`turn one`)
    await session.runTurn(`turn two`)

    const resumeIdx = calls[1].args.indexOf(`--resume`)
    expect(resumeIdx).toBeGreaterThan(-1)
    expect(calls[1].args[resumeIdx + 1]).toBe(`sess-abc`)
  })

  it(`persists the session id to disk and resumes across manager restarts`, async () => {
    const { spawnFn } = makeSpawnFn((call) => {
      call.child.emitStdout(claudeJson(`ok`, `sess-persist`))
      call.child.emitClose(0)
    })
    const first = createSessionManager({ stateDir, spawnFn })
    await first.runTurn(`turn`)

    const persisted = JSON.parse(
      readFileSync(path.join(stateDir, SessionStateFile), `utf8`)
    )
    expect(persisted.sessionId).toBe(`sess-persist`)
    expect(persisted.turnCount).toBe(1)

    // A brand-new manager (pod restart) resumes the same session
    const { spawnFn: spawnFn2, calls: calls2 } = makeSpawnFn((call) => {
      call.child.emitStdout(claudeJson(`ok`, `sess-persist`))
      call.child.emitClose(0)
    })
    const second = createSessionManager({ stateDir, spawnFn: spawnFn2 })
    expect(second.getSessionId()).toBe(`sess-persist`)

    await second.runTurn(`after restart`)
    expect(calls2[0].args).toContain(`--resume`)
    expect(calls2[0].args).toContain(`sess-persist`)
  })

  it(`accumulates turn/byte counters for the compactor`, async () => {
    const { spawnFn } = makeSpawnFn((call) => {
      call.child.emitStdout(claudeJson(`12345`, `sess-a`))
      call.child.emitClose(0)
    })
    const session = createSessionManager({ stateDir, spawnFn })

    await session.runTurn(`abcde`)
    await session.runTurn(`fghij`)

    const state = session.getState()
    expect(state.turnCount).toBe(2)
    expect(state.totalBytes).toBe(2 * (5 + 5))
  })

  it(`rotateSession clears the id, resets counters, and stashes the summary`, async () => {
    const { spawnFn, calls } = makeSpawnFn((call) => {
      call.child.emitStdout(claudeJson(`ok`, `sess-old`))
      call.child.emitClose(0)
    })
    const session = createSessionManager({ stateDir, spawnFn })
    await session.runTurn(`turn`)

    session.rotateSession(`the checkpoint summary`)

    expect(session.hasSession()).toBe(false)
    expect(session.getCheckpointSummary()).toBe(`the checkpoint summary`)
    expect(session.getState().turnCount).toBe(0)
    expect(session.getState().totalBytes).toBe(0)

    await session.runTurn(`fresh session turn`)
    expect(calls[1].args).not.toContain(`--resume`)
  })

  it(`times out a hung turn and reports timedOut`, async () => {
    // Child never closes on its own; the timeout kill triggers close(null)
    const { spawnFn, calls } = makeSpawnFn()
    const session = createSessionManager({
      stateDir,
      spawnFn,
      turnTimeoutMs: 20,
      killGraceMs: 5,
    })

    const result = await session.runTurn(`never finishes`)

    expect(result.ok).toBe(false)
    expect(result.timedOut).toBe(true)
    expect(result.error).toMatch(/timed out/)
    expect(calls[0].child.killed).toContain(`SIGTERM`)
  })

  it(`degrades to raw stdout when the CLI output is not the JSON envelope`, async () => {
    const { spawnFn } = makeSpawnFn((call) => {
      call.child.emitStdout(`plain text output`)
      call.child.emitClose(0)
    })
    const session = createSessionManager({ stateDir, spawnFn })

    const result = await session.runTurn(`turn`)
    expect(result.ok).toBe(true)
    expect(result.output).toBe(`plain text output`)
    expect(session.hasSession()).toBe(false)
  })

  it(`reports a spawn error without throwing`, async () => {
    const spawnFn = (() => {
      throw new Error(`ENOENT: claude not found`)
    }) as any
    const session = createSessionManager({ stateDir, spawnFn })

    const result = await session.runTurn(`turn`)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/ENOENT/)
  })
})
