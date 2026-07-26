import { EShellMsg } from '@tdsk/domain'
import { toast } from 'sonner'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock(`@TTH/services/api`, () => ({
  apiService: { base: `https://api.test.com` },
}))

vi.mock(`@TTH/services/sandboxApi`, () => ({
  sandboxApi: { monitorToken: vi.fn() },
}))

vi.mock(`@TTH/state/accessors`, () => ({
  setBackendSessions: vi.fn(),
  setSandboxPorts: vi.fn(),
  setSandboxInstances: vi.fn(),
}))

vi.mock(`@TTH/actions/editor/handleFileTreeChanged`, () => ({
  handleFileTreeChanged: vi.fn(),
}))

vi.mock(`sonner`, () => ({
  toast: { warning: vi.fn() },
}))

import { sandboxApi } from '@TTH/services/sandboxApi'
import {
  setBackendSessions,
  setSandboxPorts,
  setSandboxInstances,
} from '@TTH/state/accessors'
import { handleFileTreeChanged } from '@TTH/actions/editor/handleFileTreeChanged'
import { monitorService } from './monitorService'

const mockInstances: any[] = []

class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3
  static CONNECTING = 0
  static CLOSING = 2

  readyState = MockWebSocket.OPEN
  onopen: ((event: any) => void) | null = null
  onmessage: ((event: any) => void) | null = null
  onclose: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED
  })

  constructor(public url: string) {
    mockInstances.push(this)
  }
}

const flush = () => vi.advanceTimersByTimeAsync(0)

describe(`MonitorService`, () => {
  const monitorTokenMock = sandboxApi.monitorToken as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    mockInstances.length = 0
    vi.stubGlobal(`WebSocket`, MockWebSocket)
    monitorTokenMock.mockReset()
    ;(setBackendSessions as ReturnType<typeof vi.fn>).mockClear()
    ;(setSandboxPorts as ReturnType<typeof vi.fn>).mockClear()
    ;(setSandboxInstances as ReturnType<typeof vi.fn>).mockClear()
    ;(handleFileTreeChanged as ReturnType<typeof vi.fn>).mockClear()
    ;(toast.warning as ReturnType<typeof vi.fn>).mockClear()
    monitorService.disconnect()
  })

  afterEach(() => {
    monitorService.disconnect()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe(`connect / disconnect`, () => {
    it(`is a no-op when already OPEN for the same orgId (no second token fetch, no second socket)`, async () => {
      monitorTokenMock.mockResolvedValue({ data: { token: `tok-1` } })
      monitorService.connect(`org-1`)
      await flush()
      expect(mockInstances).toHaveLength(1)

      monitorService.connect(`org-1`)
      await flush()

      expect(monitorTokenMock).toHaveBeenCalledTimes(1)
      expect(mockInstances).toHaveLength(1)
    })

    it(`reconnects when connect() is called with a different orgId`, async () => {
      monitorTokenMock.mockResolvedValue({ data: { token: `tok-1` } })
      monitorService.connect(`org-1`)
      await flush()
      expect(mockInstances).toHaveLength(1)
      const first = mockInstances[0]

      monitorService.connect(`org-2`)
      await flush()

      expect(first.close).toHaveBeenCalled()
      expect(monitorTokenMock).toHaveBeenCalledTimes(2)
      expect(monitorTokenMock).toHaveBeenLastCalledWith(`org-2`)
      expect(mockInstances).toHaveLength(2)
    })

    it(`disconnect() clears handlers, closes the socket, and prevents a pending token fetch from constructing one`, async () => {
      let resolveToken: (v: any) => void = () => {}
      monitorTokenMock.mockReturnValue(
        new Promise((resolve) => {
          resolveToken = resolve
        })
      )

      monitorService.connect(`org-1`)
      monitorService.disconnect()
      resolveToken({ data: { token: `tok-1` } })
      await flush()

      expect(mockInstances).toHaveLength(0)
    })
  })

  describe(`token acquisition failure`, () => {
    it(`gives up permanently on a 401 (does not schedule a reconnect)`, async () => {
      monitorTokenMock.mockResolvedValue({ error: { status: 401, message: `nope` } })
      monitorService.connect(`org-1`)
      await flush()

      expect(mockInstances).toHaveLength(0)
      await vi.advanceTimersByTimeAsync(60_000)
      expect(monitorTokenMock).toHaveBeenCalledTimes(1)
    })

    it(`gives up permanently on a 403 (does not schedule a reconnect)`, async () => {
      monitorTokenMock.mockResolvedValue({ error: { status: 403, message: `forbidden` } })
      monitorService.connect(`org-1`)
      await flush()

      await vi.advanceTimersByTimeAsync(60_000)
      expect(monitorTokenMock).toHaveBeenCalledTimes(1)
    })

    it(`schedules a reconnect on any other token-fetch error`, async () => {
      monitorTokenMock.mockResolvedValueOnce({ error: { status: 500, message: `boom` } })
      monitorTokenMock.mockResolvedValueOnce({ data: { token: `tok-1` } })

      monitorService.connect(`org-1`)
      await flush()
      expect(monitorTokenMock).toHaveBeenCalledTimes(1)
      expect(mockInstances).toHaveLength(0)

      // InitialReconnectDelay (2000ms) with retries=0
      await vi.advanceTimersByTimeAsync(2_000)

      expect(monitorTokenMock).toHaveBeenCalledTimes(2)
      expect(mockInstances).toHaveLength(1)
    })

    it(`schedules a reconnect when no token is returned even without an error field`, async () => {
      monitorTokenMock.mockResolvedValue({ data: undefined })
      monitorService.connect(`org-1`)
      await flush()

      await vi.advanceTimersByTimeAsync(2_000)
      expect(monitorTokenMock).toHaveBeenCalledTimes(2)
    })
  })

  describe(`stale in-flight connection guard`, () => {
    it(`does not construct a WebSocket if disconnect() was called while the token fetch was in flight`, async () => {
      let resolveToken: (v: any) => void = () => {}
      monitorTokenMock.mockReturnValue(
        new Promise((resolve) => {
          resolveToken = resolve
        })
      )

      monitorService.connect(`org-1`)
      monitorService.disconnect()
      resolveToken({ data: { token: `tok-1` } })
      await flush()

      expect(mockInstances).toHaveLength(0)
    })

    it(`does not construct a WebSocket if the orgId changed while the token fetch was in flight`, async () => {
      let resolveFirst: (v: any) => void = () => {}
      monitorTokenMock.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          })
      )
      monitorTokenMock.mockResolvedValueOnce({ data: { token: `tok-2` } })

      monitorService.connect(`org-1`)
      monitorService.connect(`org-2`)
      await flush()

      // Only org-2's connection attempt should have produced a socket.
      expect(mockInstances).toHaveLength(1)

      resolveFirst({ data: { token: `tok-1` } })
      await flush()

      // The stale org-1 resolution must not construct a second socket.
      expect(mockInstances).toHaveLength(1)
    })
  })

  describe(`message routing`, () => {
    const connectAndGetSocket = async () => {
      monitorTokenMock.mockResolvedValue({ data: { token: `tok-1` } })
      monitorService.connect(`org-1`)
      await flush()
      return mockInstances[0] as MockWebSocket
    }

    const send = (ws: MockWebSocket, payload: unknown) => {
      ws.onmessage?.({ data: JSON.stringify(payload) } as any)
    }

    it(`routes a well-formed SessionsUpdated message to setBackendSessions`, async () => {
      const ws = await connectAndGetSocket()
      send(ws, {
        type: EShellMsg.SessionsUpdated,
        sandboxId: `sb-1`,
        sessions: [{ id: `sess-1` }],
      })

      expect(setBackendSessions).toHaveBeenCalledWith(`sb-1`, [{ id: `sess-1` }])
    })

    it(`defaults SessionsUpdated's sessions to [] when omitted`, async () => {
      const ws = await connectAndGetSocket()
      send(ws, { type: EShellMsg.SessionsUpdated, sandboxId: `sb-1` })

      expect(setBackendSessions).toHaveBeenCalledWith(`sb-1`, [])
    })

    it(`routes a well-formed InstancesUpdated message to setSandboxInstances`, async () => {
      const ws = await connectAndGetSocket()
      send(ws, {
        type: EShellMsg.InstancesUpdated,
        sandboxId: `sb-1`,
        instances: [{ id: `i-1` }],
        maxInstances: 3,
      })

      expect(setSandboxInstances).toHaveBeenCalledWith(`sb-1`, {
        instances: [{ id: `i-1` }],
        maxInstances: 3,
      })
    })

    it(`warns and skips a malformed InstancesUpdated message instead of throwing`, async () => {
      const warnSpy = vi.spyOn(console, `warn`).mockImplementation(() => {})
      const ws = await connectAndGetSocket()

      expect(() =>
        send(ws, {
          type: EShellMsg.InstancesUpdated,
          sandboxId: `sb-1`,
          instances: `not-an-array`,
        })
      ).not.toThrow()

      expect(setSandboxInstances).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Malformed InstancesUpdated`),
        expect.anything()
      )
    })

    it(`routes a well-formed FileTreeChanged message to handleFileTreeChanged`, async () => {
      const ws = await connectAndGetSocket()
      const payload = {
        type: EShellMsg.FileTreeChanged,
        sandboxId: `sb-1`,
        path: `/a.txt`,
        instanceId: `inst-1`,
        changeType: `create`,
        entryType: `file`,
      }
      send(ws, payload)

      expect(handleFileTreeChanged).toHaveBeenCalledWith(payload)
    })

    it(`warns and skips a malformed FileTreeChanged message (missing entryType)`, async () => {
      const warnSpy = vi.spyOn(console, `warn`).mockImplementation(() => {})
      const ws = await connectAndGetSocket()

      send(ws, {
        type: EShellMsg.FileTreeChanged,
        sandboxId: `sb-1`,
        path: `/a.txt`,
        instanceId: `inst-1`,
        changeType: `create`,
      })

      expect(handleFileTreeChanged).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Malformed FileTreeChanged`),
        expect.anything()
      )
    })

    it(`routes a well-formed PortsChanged message to setSandboxPorts`, async () => {
      const ws = await connectAndGetSocket()
      send(ws, {
        type: EShellMsg.PortsChanged,
        instanceId: `inst-1`,
        exposed: { '3000': { port: 3000 } },
        detected: [{ port: 3000, protocol: `http` }],
      })

      expect(setSandboxPorts).toHaveBeenCalledWith(`inst-1`, {
        instanceId: `inst-1`,
        exposed: { '3000': { port: 3000 } },
        detected: [{ port: 3000, protocol: `http` }],
      })
    })

    it(`warns and skips a malformed PortsChanged message (missing exposed/detected)`, async () => {
      const warnSpy = vi.spyOn(console, `warn`).mockImplementation(() => {})
      const ws = await connectAndGetSocket()

      send(ws, { type: EShellMsg.PortsChanged, instanceId: `inst-1` })

      expect(setSandboxPorts).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Malformed PortsChanged`),
        expect.anything()
      )
    })

    it(`warns and skips a non-JSON-parseable text message instead of throwing`, async () => {
      const warnSpy = vi.spyOn(console, `warn`).mockImplementation(() => {})
      const ws = await connectAndGetSocket()

      expect(() => ws.onmessage?.({ data: `not json` } as any)).not.toThrow()

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to parse message`),
        expect.anything()
      )
    })

    it(`ignores a binary (non-string) message`, async () => {
      const ws = await connectAndGetSocket()

      expect(() => ws.onmessage?.({ data: new ArrayBuffer(4) } as any)).not.toThrow()
      expect(setBackendSessions).not.toHaveBeenCalled()
    })
  })

  describe(`close handling`, () => {
    it(`does not reconnect on a permanent close code (>= PermanentCloseFloor)`, async () => {
      monitorTokenMock.mockResolvedValue({ data: { token: `tok-1` } })
      monitorService.connect(`org-1`)
      await flush()
      const ws = mockInstances[0] as MockWebSocket

      ws.onclose?.({ code: 4001, reason: `banned` } as any)
      await vi.advanceTimersByTimeAsync(60_000)

      expect(monitorTokenMock).toHaveBeenCalledTimes(1)
      expect(mockInstances).toHaveLength(1)
    })

    it(`reconnects on a non-permanent close code`, async () => {
      monitorTokenMock.mockResolvedValue({ data: { token: `tok-1` } })
      monitorService.connect(`org-1`)
      await flush()
      const ws = mockInstances[0] as MockWebSocket

      ws.onclose?.({ code: 1006, reason: `abnormal` } as any)
      await vi.advanceTimersByTimeAsync(2_000)

      expect(monitorTokenMock).toHaveBeenCalledTimes(2)
      expect(mockInstances).toHaveLength(2)
    })
  })

  describe(`error handling`, () => {
    it(`closes the socket on a WebSocket error event`, async () => {
      monitorTokenMock.mockResolvedValue({ data: { token: `tok-1` } })
      monitorService.connect(`org-1`)
      await flush()
      const ws = mockInstances[0] as MockWebSocket

      ws.onerror?.({ message: `boom` } as any)

      expect(ws.close).toHaveBeenCalled()
    })
  })

  describe(`scheduleReconnect backoff`, () => {
    it(`backs off exponentially (InitialReconnectDelay * 2^retries) and caps at MaxReconnectDelay`, async () => {
      monitorTokenMock.mockResolvedValue({ error: { status: 500, message: `boom` } })
      monitorService.connect(`org-1`)
      await flush()
      expect(monitorTokenMock).toHaveBeenCalledTimes(1)

      // retries=0 -> 2000ms
      await vi.advanceTimersByTimeAsync(1_999)
      expect(monitorTokenMock).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(monitorTokenMock).toHaveBeenCalledTimes(2)

      // retries=1 -> 4000ms
      await vi.advanceTimersByTimeAsync(3_999)
      expect(monitorTokenMock).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(monitorTokenMock).toHaveBeenCalledTimes(3)

      // retries=2 -> 8000ms
      await vi.advanceTimersByTimeAsync(7_999)
      expect(monitorTokenMock).toHaveBeenCalledTimes(3)
      await vi.advanceTimersByTimeAsync(1)
      expect(monitorTokenMock).toHaveBeenCalledTimes(4)
    })

    it(`stops after MaxRetries and fires the sonner toast instead of scheduling again`, async () => {
      monitorTokenMock.mockResolvedValue({ error: { status: 500, message: `boom` } })
      monitorService.connect(`org-1`)
      await flush()

      // Drain retries 1..8 (MaxRetries=8): each subsequent wait uses the
      // capped/growing delay, so just advance far enough each time.
      for (let i = 0; i < 8; i++) {
        await vi.advanceTimersByTimeAsync(60_000)
      }

      expect(monitorTokenMock).toHaveBeenCalledTimes(9)
      expect(toast.warning).toHaveBeenCalledWith(
        `Live session updates lost`,
        expect.objectContaining({ id: `monitor-org` })
      )

      // No further reconnect attempts scheduled.
      await vi.advanceTimersByTimeAsync(120_000)
      expect(monitorTokenMock).toHaveBeenCalledTimes(9)
    })
  })
})
