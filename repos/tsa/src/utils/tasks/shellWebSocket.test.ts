import WebSocket from 'ws'
import { EShellMsg } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockInstances: any[] = []

vi.mock(`ws`, () => {
  const MockWS: any = vi.fn().mockImplementation(() => {
    const handlers: Record<string, Function[]> = {}
    const instance = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1,
      binaryType: undefined as string | undefined,
      on: vi.fn((event: string, handler: Function) => {
        if (!handlers[event]) handlers[event] = []
        handlers[event].push(handler)
      }),
      _emit: (event: string, ...args: any[]) => {
        for (const h of handlers[event] || []) h(...args)
      },
    }
    mockInstances.push(instance)
    return instance
  })
  MockWS.OPEN = 1
  return { default: MockWS, __esModule: true }
})

vi.mock(`@TSA/theme`, () => ({
  themed: (_style: string, text: string) => text,
}))

import { connectShellWebSocket } from './shellWebSocket'

const baseOptions = {
  proxyUrl: `https://proxy.test`,
  sandboxId: `sb-1`,
  bearerToken: `tok-abc`,
}

describe(`connectShellWebSocket`, () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>
  let stderrWriteSpy: ReturnType<typeof vi.spyOn>
  let stdinDataHandler: (chunk: Buffer) => void

  beforeEach(() => {
    vi.clearAllMocks()
    mockInstances.length = 0

    stdoutWriteSpy = vi.spyOn(process.stdout, `write`).mockImplementation(() => true)
    stderrWriteSpy = vi.spyOn(process.stderr, `write`).mockImplementation(() => true)

    vi.spyOn(process.stdin, `on`).mockImplementation((event: any, handler: any) => {
      if (event === `data`) stdinDataHandler = handler
      return process.stdin
    })
    vi.spyOn(process.stdin, `off`).mockImplementation(() => process.stdin)
    vi.spyOn(process.stdin, `resume`).mockImplementation(() => process.stdin)
    vi.spyOn(process.stdin, `pause`).mockImplementation(() => process.stdin)
    // Not all test environments expose a real setRawMode (non-TTY stdin) —
    // stub it in first so vi.spyOn always has a method to wrap.
    if (!(process.stdin as any).setRawMode)
      (process.stdin as any).setRawMode = () => process.stdin
    vi.spyOn(process.stdin, `setRawMode`).mockImplementation(() => process.stdin)
    vi.spyOn(process.stdout, `on`).mockImplementation(() => process.stdout)
    vi.spyOn(process.stdout, `off`).mockImplementation(() => process.stdout)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const openConnection = () => {
    const runPromise = connectShellWebSocket(baseOptions)
    const ws = mockInstances[0]
    ws._emit(`open`)
    return { runPromise, ws }
  }

  const connectAndClose = async (ws: any, sessionId = `sess-123`) => {
    ws._emit(
      `message`,
      Buffer.from(JSON.stringify({ type: EShellMsg.Connected, sessionId })),
      false
    )
    ws._emit(`close`, 1000, Buffer.alloc(0))
  }

  describe(`tilde-escape / detach state machine`, () => {
    it(`shows the detach menu on a lone ctrl+] byte (0x1d)`, () => {
      const { ws } = openConnection()

      stdinDataHandler(Buffer.from([0x1d]))

      expect(stdoutWriteSpy.mock.calls.some((c) => String(c[0]).includes(`Detach`))).toBe(
        true
      )
      expect(ws.send).not.toHaveBeenCalled()
    })

    it(`closes and detaches when 'd' is pressed while the menu is visible`, async () => {
      const { runPromise, ws } = openConnection()

      stdinDataHandler(Buffer.from([0x1d])) // open menu
      stdinDataHandler(Buffer.from([0x64])) // 'd'

      expect(ws.close).toHaveBeenCalledTimes(1)

      // detaching before a session was ever established still rejects (close
      // only resolves when `connected` is true) — but the detach message is
      // still written since `detaching` and `connected` are independent flags.
      ws._emit(`close`, 1000, Buffer.alloc(0))
      await expect(runPromise).rejects.toThrow(/before session was established/)
      expect(
        stderrWriteSpy.mock.calls.some((c) => String(c[0]).includes(`Detached`))
      ).toBe(true)
    })

    it(`closes and detaches AFTER a session was established (resolves with the session id, writes the detach message)`, async () => {
      const { runPromise, ws } = openConnection()

      ws._emit(
        `message`,
        Buffer.from(JSON.stringify({ type: EShellMsg.Connected, sessionId: `sess-9` })),
        false
      )

      stdinDataHandler(Buffer.from([0x1d])) // open menu
      stdinDataHandler(Buffer.from([0x64])) // 'd'
      expect(ws.close).toHaveBeenCalledTimes(1)

      ws._emit(`close`, 1000, Buffer.alloc(0))
      await expect(runPromise).resolves.toBe(`sess-9`)
      expect(
        stderrWriteSpy.mock.calls.some((c) => String(c[0]).includes(`Detached`))
      ).toBe(true)
    })

    it(`hides the menu and swallows any other byte while the menu is visible (never forwarded)`, () => {
      const { ws } = openConnection()

      stdinDataHandler(Buffer.from([0x1d])) // open menu
      stdinDataHandler(Buffer.from([0x41])) // 'A' — dismiss, not forwarded

      expect(ws.send).not.toHaveBeenCalled()
      expect(ws.close).not.toHaveBeenCalled()
    })

    it(`forwards a literal '~' that is NOT preceded by a newline`, () => {
      const { ws } = openConnection()

      stdinDataHandler(Buffer.from(`a`)) // sets afterNewline=false
      ws.send.mockClear()
      stdinDataHandler(Buffer.from(`~`))

      expect(ws.send).toHaveBeenCalledWith(Buffer.from([0x7e]))
    })

    it(`'~.' after a newline (or at session start) closes as a detach WITHOUT forwarding the tilde`, () => {
      const { ws } = openConnection()

      stdinDataHandler(Buffer.from(`~.`))

      expect(ws.send).not.toHaveBeenCalled()
      expect(ws.close).toHaveBeenCalledTimes(1)
    })

    it(`flushes bytes preceding the '~.' escape before closing`, () => {
      const { ws } = openConnection()

      stdinDataHandler(Buffer.from(`hi\n~.`))

      expect(ws.send).toHaveBeenCalledWith(Buffer.from(`hi\n`))
      expect(ws.close).toHaveBeenCalledTimes(1)
    })

    it(`'~' followed by a non-'.' byte forwards BOTH the tilde and the byte`, () => {
      const { ws } = openConnection()

      stdinDataHandler(Buffer.from(`~x`))

      expect(ws.send).toHaveBeenCalledWith(Buffer.from(`~x`))
      expect(ws.close).not.toHaveBeenCalled()
    })

    it(`ignores stdin entirely while the socket is not OPEN`, () => {
      const { ws } = openConnection()
      ws.readyState = 3 // CLOSED

      stdinDataHandler(Buffer.from(`hello`))

      expect(ws.send).not.toHaveBeenCalled()
    })
  })

  describe(`30s connect timeout`, () => {
    it(`rejects with 'Connection timed out' and runs cleanup when no connect message arrives in time`, async () => {
      vi.useFakeTimers()
      const runPromise = connectShellWebSocket(baseOptions)
      const ws = mockInstances[0]

      // Attach the rejection assertion BEFORE advancing timers so a handler
      // is already in place the instant the timeout fires — otherwise the
      // reject/assert race can trip vitest's unhandled-rejection detector.
      const assertion = expect(runPromise).rejects.toThrow(`Connection timed out`)
      await vi.advanceTimersByTimeAsync(30_000)
      await assertion

      expect(ws.close).toHaveBeenCalledTimes(1)
      expect(process.stdin.off).toHaveBeenCalledWith(`data`, expect.any(Function))
      expect(process.stdout.off).toHaveBeenCalledWith(`resize`, expect.any(Function))
    })

    it(`does NOT time out once a ShellConnectMsgs-type message has already arrived`, async () => {
      vi.useFakeTimers()
      const runPromise = connectShellWebSocket(baseOptions)
      const ws = mockInstances[0]

      ws._emit(
        `message`,
        Buffer.from(JSON.stringify({ type: EShellMsg.Connected, sessionId: `sess-1` })),
        false
      )
      await vi.advanceTimersByTimeAsync(30_000)

      ws._emit(`close`, 1000, Buffer.alloc(0))
      const result = await runPromise
      expect(result).toBe(`sess-1`)
    })
  })

  describe(`message routing`, () => {
    it(`a Connected-type message marks the session connected and writes a success message`, async () => {
      const { runPromise, ws } = openConnection()

      await connectAndClose(ws, `sess-abc123`)

      const result = await runPromise
      expect(result).toBe(`sess-abc123`)
      expect(
        stderrWriteSpy.mock.calls.some((c) => String(c[0]).includes(`Connected`))
      ).toBe(true)
    })

    it(`an Error-type message before connection is established rejects immediately (does not wait for close)`, async () => {
      const { runPromise, ws } = openConnection()

      ws._emit(
        `message`,
        Buffer.from(JSON.stringify({ type: EShellMsg.Error, message: `boom` })),
        false
      )

      await expect(runPromise).rejects.toThrow(`boom`)
    })

    it(`an Error-type message AFTER connection does not reject (already resolved by the eventual close)`, async () => {
      const { runPromise, ws } = openConnection()

      ws._emit(
        `message`,
        Buffer.from(JSON.stringify({ type: EShellMsg.Connected, sessionId: `s1` })),
        false
      )
      ws._emit(
        `message`,
        Buffer.from(JSON.stringify({ type: EShellMsg.Error, message: `transient` })),
        false
      )
      ws._emit(`close`, 1000, Buffer.alloc(0))

      const result = await runPromise
      expect(result).toBe(`s1`)
    })

    it(`a non-JSON-parseable text message is written straight to stdout instead of routed`, async () => {
      const { runPromise, ws } = openConnection()

      ws._emit(`message`, Buffer.from(`raw terminal output`), false)
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining(`raw terminal output`)
      )

      await connectAndClose(ws)
      await runPromise
    })

    it(`a binary message is written straight to stdout`, async () => {
      const { runPromise, ws } = openConnection()

      const binaryChunk = Buffer.from([0x01, 0x02, 0x03])
      ws._emit(`message`, binaryChunk, true)
      expect(stdoutWriteSpy).toHaveBeenCalledWith(binaryChunk)

      await connectAndClose(ws)
      await runPromise
    })
  })

  describe(`close handler`, () => {
    it(`resolves with the session id when the socket closes AFTER connection`, async () => {
      const { runPromise, ws } = openConnection()

      await connectAndClose(ws, `sess-final`)

      await expect(runPromise).resolves.toBe(`sess-final`)
    })

    it(`rejects with a 'before session was established' error including the close reason`, async () => {
      const { runPromise, ws } = openConnection()

      ws._emit(`close`, 1006, Buffer.from(`abnormal closure`))

      await expect(runPromise).rejects.toThrow(
        /before session was established.*abnormal closure/
      )
    })

    it(`rejects with the close code when no reason is provided`, async () => {
      const { runPromise, ws } = openConnection()

      ws._emit(`close`, 1000, Buffer.alloc(0))

      await expect(runPromise).rejects.toThrow(
        /before session was established.*code 1000/
      )
    })
  })

  describe(`error handler`, () => {
    it(`rejects with the WebSocket error message`, async () => {
      const { runPromise, ws } = openConnection()

      ws._emit(`error`, new Error(`ECONNREFUSED`))

      await expect(runPromise).rejects.toThrow(`ECONNREFUSED`)
    })
  })
})
