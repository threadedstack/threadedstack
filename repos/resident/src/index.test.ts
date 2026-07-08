import type { TEventLoop } from './loop'
import type { THeartbeat } from './heartbeat'

import { EventEmitter } from 'node:events'
import { describe, it, expect, vi } from 'vitest'

import { installSignalHandlers } from './index'

const makeLoopDouble = (shutdown: () => Promise<void>): TEventLoop =>
  ({ shutdown }) as unknown as TEventLoop

const makeHeartbeatDouble = (): THeartbeat & { stops: number[] } => {
  const stops: number[] = []
  return {
    stops,
    beat: async () => undefined,
    start: () => undefined,
    stop: () => {
      stops.push(Date.now())
    },
  }
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

describe(`SIGTERM graceful path (the rolling-restart contract)`, () => {
  it(`finishes shutdown (current turn + checkpoint) then exits 0`, async () => {
    const proc = new EventEmitter()
    const heartbeat = makeHeartbeatDouble()
    const shutdown = vi.fn().mockResolvedValue(undefined)
    const exits: number[] = []

    installSignalHandlers({
      loop: makeLoopDouble(shutdown),
      heartbeat,
      proc,
      exitFn: (code) => {
        exits.push(code)
      },
    })

    proc.emit(`SIGTERM`)
    await flush()

    expect(heartbeat.stops).toHaveLength(1)
    expect(shutdown).toHaveBeenCalledTimes(1)
    expect(exits).toEqual([0])
  })

  it(`exits 0 only AFTER the in-flight shutdown resolves`, async () => {
    const proc = new EventEmitter()
    const exits: number[] = []
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    installSignalHandlers({
      loop: makeLoopDouble(() => gate),
      heartbeat: makeHeartbeatDouble(),
      proc,
      exitFn: (code) => {
        exits.push(code)
      },
    })

    proc.emit(`SIGTERM`)
    await flush()
    expect(exits).toEqual([]) // still draining the turn/checkpoint

    release?.()
    await flush()
    expect(exits).toEqual([0])
  })

  it(`a second signal while draining is ignored (single shutdown)`, async () => {
    const proc = new EventEmitter()
    const shutdown = vi.fn().mockResolvedValue(undefined)
    const exits: number[] = []

    installSignalHandlers({
      loop: makeLoopDouble(shutdown),
      heartbeat: makeHeartbeatDouble(),
      proc,
      exitFn: (code) => {
        exits.push(code)
      },
    })

    proc.emit(`SIGTERM`)
    proc.emit(`SIGINT`)
    await flush()

    expect(shutdown).toHaveBeenCalledTimes(1)
    expect(exits).toEqual([0])
  })

  it(`exits 1 when the shutdown path itself fails`, async () => {
    const proc = new EventEmitter()
    const exits: number[] = []

    installSignalHandlers({
      loop: makeLoopDouble(() => Promise.reject(new Error(`disk gone`))),
      heartbeat: makeHeartbeatDouble(),
      proc,
      exitFn: (code) => {
        exits.push(code)
      },
    })

    proc.emit(`SIGTERM`)
    await flush()
    expect(exits).toEqual([1])
  })

  it(`handles SIGINT the same as SIGTERM`, async () => {
    const proc = new EventEmitter()
    const shutdown = vi.fn().mockResolvedValue(undefined)
    const exits: number[] = []

    installSignalHandlers({
      loop: makeLoopDouble(shutdown),
      heartbeat: makeHeartbeatDouble(),
      proc,
      exitFn: (code) => {
        exits.push(code)
      },
    })

    proc.emit(`SIGINT`)
    await flush()
    expect(shutdown).toHaveBeenCalledTimes(1)
    expect(exits).toEqual([0])
  })
})
