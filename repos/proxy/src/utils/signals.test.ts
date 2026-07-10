import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock(`./logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { logger } from './logger'
import { signals } from './signals'

type THandler = (...args: any[]) => void

describe(`signals`, () => {
  let handlers: Record<string, THandler[]>
  let exitSpy: ReturnType<typeof vi.spyOn>
  let server: any

  beforeEach(() => {
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
  })

  const trigger = (sig = `SIGTERM`) => {
    handlers[sig]?.forEach((h) => h())
  }

  it(`registers a handler for SIGINT, SIGTERM, and SIGQUIT`, () => {
    signals(server)

    expect(Object.keys(handlers).sort()).toEqual([`SIGINT`, `SIGQUIT`, `SIGTERM`])
  })

  it(`closes the server and exits 0 on signal`, () => {
    signals(server)
    trigger()

    expect(server.close).toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(0)
    expect(logger.info).toHaveBeenCalledWith(`Server exited`)
  })

  it(`logs the received signal before shutting down`, () => {
    signals(server)
    trigger(`SIGINT`)

    expect(logger.debug).toHaveBeenCalledWith(`Received SIGINT signal`)
  })

  it(`registers a separate handler per signal that each close the server independently`, () => {
    signals(server)

    trigger(`SIGTERM`)
    trigger(`SIGINT`)
    trigger(`SIGQUIT`)

    expect(server.close).toHaveBeenCalledTimes(3)
    expect(exitSpy).toHaveBeenCalledTimes(3)
  })

  it(`logs and exits 1 if server.close throws synchronously`, () => {
    server.close = vi.fn(() => {
      throw new Error(`boom`)
    })

    signals(server)
    trigger()

    expect(logger.error).toHaveBeenCalledWith(
      `an error occurred while shutting down server`,
      { err: expect.any(Error) }
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it(`does not exit 0 if server.close never invokes its callback`, () => {
    server.close = vi.fn()

    signals(server)
    trigger()

    expect(exitSpy).not.toHaveBeenCalled()
  })
})
