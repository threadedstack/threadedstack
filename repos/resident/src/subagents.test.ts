import type { TSubAgentResult } from './types/resident.types'

import { describe, it, expect } from 'vitest'
import { DelegationMaxDepth, DelegationDepthEnvVar } from '@tdsk/domain'

import { claudeJson, makeSpawnFn } from './testUtils'
import { parseSpawnBlock, createSubAgentPool } from './subagents'

const spawnFence = (json: string) => `\`\`\`tdsk-spawn\n${json}\n\`\`\``

const waitForResults = async (results: TSubAgentResult[], count: number) => {
  for (let i = 0; i < 50 && results.length < count; i++)
    await new Promise((resolve) => setImmediate(resolve))
}

describe(`parseSpawnBlock`, () => {
  it(`parses spawn requests and drops malformed entries`, () => {
    const out = parseSpawnBlock(
      spawnFence(
        `[{"key":"research","prompt":"go research","timeoutMs":5000},{"prompt":""},{"nope":true},{"prompt":"bare"}]`
      )
    )
    expect(out).toEqual([
      { key: `research`, prompt: `go research`, timeoutMs: 5000 },
      { key: undefined, prompt: `bare`, timeoutMs: undefined },
    ])
  })

  it(`returns [] for missing/malformed blocks`, () => {
    expect(parseSpawnBlock(`no fence`)).toEqual([])
    expect(parseSpawnBlock(spawnFence(`{ not an array }`))).toEqual([])
  })
})

describe(`sub-agent pool`, () => {
  it(`spawns a fresh-session child and enqueues its completion`, async () => {
    const results: TSubAgentResult[] = []
    const { spawnFn, calls } = makeSpawnFn((call) => {
      call.child.emitStdout(claudeJson(`sub-agent findings`, `sub-sess`))
      call.child.emitClose(0)
    })
    const pool = createSubAgentPool({
      maxConcurrent: 2,
      depth: 0,
      spawnFn,
      onComplete: (result) => results.push(result),
    })

    const spawned = pool.spawnSubAgent({ key: `research`, prompt: `dig in` })
    expect(spawned.ok).toBe(true)
    await waitForResults(results, 1)

    // Fresh session: no --resume; depth env threaded for defense in depth
    expect(calls[0].args).not.toContain(`--resume`)
    expect(calls[0].options.env[DelegationDepthEnvVar]).toBe(`1`)
    expect(results[0]).toMatchObject({
      key: `research`,
      ok: true,
      output: `sub-agent findings`,
      exitCode: 0,
      timedOut: false,
    })
  })

  it(`refuses to spawn past the concurrency cap, then frees the slot`, async () => {
    const results: TSubAgentResult[] = []
    let releaseFirst: (() => void) | undefined
    const { spawnFn } = makeSpawnFn((call, index) => {
      if (index === 0)
        releaseFirst = () => {
          call.child.emitStdout(claudeJson(`done`))
          call.child.emitClose(0)
        }
      else {
        call.child.emitStdout(claudeJson(`done`))
        call.child.emitClose(0)
      }
    })
    const pool = createSubAgentPool({
      maxConcurrent: 1,
      depth: 0,
      spawnFn,
      onComplete: (result) => results.push(result),
    })

    expect(pool.spawnSubAgent({ prompt: `first` }).ok).toBe(true)
    // Give the script a tick to register the release handle
    await new Promise((resolve) => setImmediate(resolve))

    const second = pool.spawnSubAgent({ prompt: `second` })
    expect(second.ok).toBe(false)
    expect(second.error).toMatch(/concurrency cap/)
    expect(pool.activeCount()).toBe(1)

    releaseFirst?.()
    await waitForResults(results, 1)
    expect(pool.activeCount()).toBe(0)

    expect(pool.spawnSubAgent({ prompt: `third` }).ok).toBe(true)
  })

  it(`refuses to spawn at max delegation depth`, () => {
    const { spawnFn, calls } = makeSpawnFn()
    const pool = createSubAgentPool({
      maxConcurrent: 3,
      depth: DelegationMaxDepth,
      spawnFn,
      onComplete: () => undefined,
    })

    const spawned = pool.spawnSubAgent({ prompt: `too deep` })
    expect(spawned.ok).toBe(false)
    expect(spawned.error).toMatch(/depth/)
    expect(calls).toHaveLength(0)
  })

  it(`times out a hung child and reports timedOut with captured output`, async () => {
    const results: TSubAgentResult[] = []
    const { spawnFn, calls } = makeSpawnFn((call) => {
      call.child.emitStdout(`partial output before hanging`)
      // never closes — the pool's timeout kills it
    })
    const pool = createSubAgentPool({
      maxConcurrent: 1,
      depth: 0,
      spawnFn,
      killGraceMs: 5,
      onComplete: (result) => results.push(result),
    })

    // Request timeout is clamped to the 1s floor — real-time but bounded
    pool.spawnSubAgent({ prompt: `hang`, timeoutMs: 1 })
    for (let i = 0; i < 80 && !results.length; i++)
      await new Promise((resolve) => setTimeout(resolve, 50))

    expect(results[0].timedOut).toBe(true)
    expect(results[0].ok).toBe(false)
    expect(results[0].output).toContain(`partial output`)
    expect(calls[0].child.killed).toContain(`SIGTERM`)
    expect(pool.activeCount()).toBe(0)
  }, 10_000)

  it(`caps completion output to the delegation tail cap`, async () => {
    const results: TSubAgentResult[] = []
    const huge = `x`.repeat(50_000)
    const { spawnFn } = makeSpawnFn((call) => {
      call.child.emitStdout(claudeJson(huge))
      call.child.emitClose(0)
    })
    const pool = createSubAgentPool({
      maxConcurrent: 1,
      depth: 0,
      spawnFn,
      outputMaxChars: 16_000,
      onComplete: (result) => results.push(result),
    })

    pool.spawnSubAgent({ prompt: `big` })
    await waitForResults(results, 1)

    expect(results[0].output.length).toBeLessThanOrEqual(16_000)
  })
})
