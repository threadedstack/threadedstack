import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { logger } from '@TBE/utils/logger'
import { signals } from './signals'

type THandler = (...args: any[]) => void

describe(`signals`, () => {
  let handlers: Record<string, THandler[]>
  let exitSpy: ReturnType<typeof vi.spyOn>
  let server: any

  beforeEach(() => {
    vi.useFakeTimers()
    handlers = {}
    vi.spyOn(process, `on`).mockImplementation(((event: string, cb: THandler) => {
      handlers[event] = handlers[event] || []
      handlers[event].push(cb)
      return process
    }) as any)
    exitSpy = vi.spyOn(process, `exit`).mockImplementation((() => undefined) as any)
    server = { close: vi.fn((cb?: () => void) => cb?.()) }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  const trigger = (sig = `SIGTERM`) => {
    handlers[sig]?.forEach((h) => h())
  }

  it(`registers a handler for SIGINT, SIGTERM, and SIGQUIT`, () => {
    signals(server)

    expect(Object.keys(handlers).sort()).toEqual([`SIGINT`, `SIGQUIT`, `SIGTERM`])
  })

  it(`stops the scheduler and resident watchdog before closing the server`, () => {
    const order: string[] = []
    const scheduler = { stop: vi.fn(() => order.push(`scheduler`)) }
    const residentWatchdog = { stop: vi.fn(() => order.push(`watchdog`)) }
    server.close = vi.fn((cb?: () => void) => {
      order.push(`server`)
      cb?.()
    })

    signals(server, { scheduler, residentWatchdog } as any)
    trigger()

    expect(order).toEqual([`scheduler`, `watchdog`, `server`])
  })

  it(`closes all connected websocket clients`, () => {
    const ws1 = { close: vi.fn() }
    const ws2 = { close: vi.fn() }
    const wss = { clients: new Set([ws1, ws2]) }

    signals(server, { wss } as any)
    trigger()

    expect(ws1.close).toHaveBeenCalledWith(1001, `Server shutting down`)
    expect(ws2.close).toHaveBeenCalledWith(1001, `Server shutting down`)
  })

  it(`swallows an error from a websocket client that is already closed and closes the rest`, () => {
    const ws1 = {
      close: vi.fn(() => {
        throw new Error(`already closed`)
      }),
    }
    const ws2 = { close: vi.fn() }
    const wss = { clients: new Set([ws1, ws2]) }

    signals(server, { wss } as any)

    expect(() => trigger()).not.toThrow()
    expect(ws2.close).toHaveBeenCalledWith(1001, `Server shutting down`)
  })

  it(`logs and continues when the scheduler throws on stop`, () => {
    const scheduler = {
      stop: vi.fn(() => {
        throw new Error(`boom`)
      }),
    }
    const residentWatchdog = { stop: vi.fn() }

    signals(server, { scheduler, residentWatchdog } as any)
    trigger()

    expect(logger.error).toHaveBeenCalledWith(`Failed to stop scheduler:`, `boom`)
    expect(residentWatchdog.stop).toHaveBeenCalled()
    expect(server.close).toHaveBeenCalled()
  })

  it(`logs and continues when the resident watchdog throws on stop`, () => {
    const residentWatchdog = {
      stop: vi.fn(() => {
        throw new Error(`kaboom`)
      }),
    }

    signals(server, { residentWatchdog } as any)
    trigger()

    expect(logger.error).toHaveBeenCalledWith(
      `Failed to stop resident watchdog:`,
      `kaboom`
    )
    expect(server.close).toHaveBeenCalled()
  })

  it(`exits 0 once the server finishes closing`, () => {
    signals(server)
    trigger()

    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it(`force-exits with code 1 if the server does not close before the timeout`, () => {
    server.close = vi.fn()
    signals(server)
    trigger()

    expect(exitSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(5_000)

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(logger.warn).toHaveBeenCalledWith(
      `Graceful shutdown timed out after 5000ms, forcing exit`
    )
  })

  it(`ignores a second signal once shutdown has already started`, () => {
    const scheduler = { stop: vi.fn() }
    signals(server, { scheduler } as any)

    trigger(`SIGTERM`)
    trigger(`SIGINT`)

    expect(scheduler.stop).toHaveBeenCalledTimes(1)
    expect(server.close).toHaveBeenCalledTimes(1)
  })
})
