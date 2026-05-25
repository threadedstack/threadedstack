import { describe, it, expect, vi, beforeEach } from 'vitest'
import type WebSocket from 'ws'
import type { IncomingMessage } from 'http'
import type { TApp } from '@TBE/types'

import { ERoleType, ApiKeyPrefix, hashKey } from '@tdsk/domain'

vi.mock(`@TBE/services/sessionToken`, () => ({
  verifyShellToken: vi.fn(),
}))

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}))

import { onMonitorConnect } from './onMonitorConnect'
import { verifyShellToken } from '@TBE/services/sessionToken'

const mockVerifyShellToken = verifyShellToken as ReturnType<typeof vi.fn>

const SANDBOX_ID = `sb-test-123`
const ORG_ID = `org-test-456`
const USER_ID = `user-test-789`

const buildMockWs = () => {
  const handlers: Record<string, Function> = {}
  return {
    close: vi.fn(),
    send: vi.fn(),
    ping: vi.fn(),
    readyState: 1,
    OPEN: 1,
    on: vi.fn((event: string, handler: Function) => {
      handlers[event] = handler
    }),
    _handlers: handlers,
  } as unknown as WebSocket & { _handlers: Record<string, Function> }
}

const buildMockReq = (url: string, headers: Record<string, string> = {}) =>
  ({ url, headers }) as unknown as IncomingMessage

const defInstanceSnapshot = {
  instances: [],
  maxInstances: 1,
  sandboxId: SANDBOX_ID,
  type: `instances-updated`,
}

const buildMockApp = (overrides: Record<string, any> = {}) => {
  const sandboxService = {
    addOrgMonitor: vi.fn(),
    removeOrgMonitor: vi.fn(),
    getSessionsForSandbox: vi.fn().mockReturnValue([]),
    getShellSession: vi.fn().mockReturnValue(null),
    buildInstanceSnapshot: vi.fn().mockResolvedValue(defInstanceSnapshot),
    ...overrides.sandbox,
  }

  return {
    locals: {
      db: {
        services: {
          sandbox: {
            listByOrg: vi.fn().mockResolvedValue({
              data: [{ id: SANDBOX_ID }],
            }),
            ...overrides.sandboxDb,
          },
          role: {
            getOrgRole: vi.fn().mockResolvedValue({
              data: { type: ERoleType.admin },
            }),
            ...overrides.role,
          },
          apiKey: {
            getByHash: vi.fn().mockResolvedValue({ data: null }),
            ...overrides.apiKey,
          },
          permissionOverride: {
            getForUser: vi.fn().mockResolvedValue({ data: [] }),
            ...overrides.permissionOverride,
          },
        },
      },
      sandbox: sandboxService,
      ...overrides.locals,
    },
  } as unknown as TApp
}

describe(`onMonitorConnect`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyShellToken.mockReset()
  })

  describe(`authorization`, () => {
    it(`closes with 4001 when no auth provided`, async () => {
      const ws = buildMockWs()
      await onMonitorConnect(ws, buildMockReq(`/_/sandboxes/monitor`), buildMockApp())
      expect(ws.close).toHaveBeenCalledWith(4001, `Authentication required`)
    })

    it(`authenticates with valid API key`, async () => {
      const ws = buildMockWs()
      const testKey = `${ApiKeyPrefix}test-key-123`
      const app = buildMockApp({
        apiKey: {
          getByHash: vi.fn().mockResolvedValue({
            data: { orgId: ORG_ID, userId: USER_ID, isValid: () => true },
          }),
        },
      })
      await onMonitorConnect(
        ws,
        buildMockReq(`/_/sandboxes/monitor`, { authorization: `Bearer ${testKey}` }),
        app
      )
      expect(ws.close).not.toHaveBeenCalledWith(4001, expect.any(String))
      expect(app.locals.sandbox!.addOrgMonitor).toHaveBeenCalledWith(
        ORG_ID,
        ws,
        null,
        USER_ID
      )
    })

    it(`closes with 4001 for invalid API key`, async () => {
      const ws = buildMockWs()
      const testKey = `${ApiKeyPrefix}bad-key`
      await onMonitorConnect(
        ws,
        buildMockReq(`/_/sandboxes/monitor`, { authorization: `Bearer ${testKey}` }),
        buildMockApp()
      )
      expect(ws.close).toHaveBeenCalledWith(4001, `Invalid or expired API key`)
    })

    it(`closes with 4001 for invalid token`, async () => {
      const ws = buildMockWs()
      mockVerifyShellToken.mockReturnValue(null)
      await onMonitorConnect(
        ws,
        buildMockReq(`/_/sandboxes/monitor?token=bad`),
        buildMockApp()
      )
      expect(ws.close).toHaveBeenCalledWith(4001, `Invalid or expired token`)
    })

    it(`closes with 4003 when user lacks sandbox read permission`, async () => {
      const ws = buildMockWs()
      mockVerifyShellToken.mockReturnValue({ orgId: ORG_ID, userId: USER_ID })
      const app = buildMockApp({
        role: { getOrgRole: vi.fn().mockResolvedValue({ data: null }) },
      })
      await onMonitorConnect(ws, buildMockReq(`/_/sandboxes/monitor?token=valid`), app)
      expect((ws.close as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(4003)
    })

    it(`closes with 4003 when sandbox service unavailable`, async () => {
      const ws = buildMockWs()
      mockVerifyShellToken.mockReturnValue({ orgId: ORG_ID, userId: USER_ID })
      const app = buildMockApp()
      ;(app.locals as any).sandbox = undefined
      await onMonitorConnect(ws, buildMockReq(`/_/sandboxes/monitor?token=valid`), app)
      expect(ws.close).toHaveBeenCalledWith(4003, `Sandbox service not available`)
    })
  })

  describe(`connection`, () => {
    it(`registers org monitor and sends initial snapshots`, async () => {
      const ws = buildMockWs()
      const sessions = [{ sessionId: `sess-1`, userId: USER_ID, sandboxId: SANDBOX_ID }]
      const app = buildMockApp({
        sandbox: {
          addOrgMonitor: vi.fn(),
          removeOrgMonitor: vi.fn(),
          getSessionsForSandbox: vi.fn().mockReturnValue(sessions),
          getShellSession: vi.fn().mockReturnValue(null),
        },
      })
      mockVerifyShellToken.mockReturnValue({ orgId: ORG_ID, userId: USER_ID })

      await onMonitorConnect(ws, buildMockReq(`/_/sandboxes/monitor?token=valid`), app)

      expect(app.locals.sandbox!.addOrgMonitor).toHaveBeenCalledWith(
        ORG_ID,
        ws,
        null,
        USER_ID
      )
      expect(ws.send).toHaveBeenCalledTimes(2)

      const sessionSnap = JSON.parse(
        (ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]
      )
      expect(sessionSnap.type).toBe(`sessions-updated`)
      expect(sessionSnap.sandboxId).toBe(SANDBOX_ID)
      expect(sessionSnap.sessions).toHaveLength(1)

      const instanceSnap = JSON.parse(
        (ws.send as ReturnType<typeof vi.fn>).mock.calls[1][0]
      )
      expect(instanceSnap.type).toBe(`instances-updated`)
      expect(instanceSnap.sandboxId).toBe(SANDBOX_ID)
    })

    it(`sends empty sessions snapshot for sandboxes with no active sessions`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        sandboxDb: {
          listByOrg: vi
            .fn()
            .mockResolvedValue({ data: [{ id: `sb-1` }, { id: `sb-2` }] }),
        },
      })
      mockVerifyShellToken.mockReturnValue({ orgId: ORG_ID, userId: USER_ID })

      await onMonitorConnect(ws, buildMockReq(`/_/sandboxes/monitor?token=valid`), app)

      expect(app.locals.sandbox!.addOrgMonitor).toHaveBeenCalledWith(
        ORG_ID,
        ws,
        null,
        USER_ID
      )
      expect(ws.send).toHaveBeenCalledTimes(4)

      const sent1 = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0])
      expect(sent1.type).toBe(`sessions-updated`)
      expect(sent1.sandboxId).toBe(`sb-1`)
      expect(sent1.sessions).toHaveLength(0)

      const sent2 = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[1][0])
      expect(sent2.type).toBe(`instances-updated`)

      const sent3 = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[2][0])
      expect(sent3.type).toBe(`sessions-updated`)
      expect(sent3.sandboxId).toBe(`sb-2`)
      expect(sent3.sessions).toHaveLength(0)

      const sent4 = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[3][0])
      expect(sent4.type).toBe(`instances-updated`)
    })

    it(`enriches sessions with hasShellSession flag`, async () => {
      const ws = buildMockWs()
      const sessions = [
        { sessionId: `sess-1`, userId: USER_ID },
        { sessionId: `sess-2`, userId: `other` },
      ]
      const app = buildMockApp({
        sandbox: {
          addOrgMonitor: vi.fn(),
          removeOrgMonitor: vi.fn(),
          getSessionsForSandbox: vi.fn().mockReturnValue(sessions),
          getShellSession: vi.fn((id: string) => (id === `sess-1` ? {} : null)),
          buildInstanceSnapshot: vi.fn().mockResolvedValue(defInstanceSnapshot),
        },
      })
      mockVerifyShellToken.mockReturnValue({ orgId: ORG_ID, userId: USER_ID })

      await onMonitorConnect(ws, buildMockReq(`/_/sandboxes/monitor?token=valid`), app)

      const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0])
      expect(sent.sessions[0].hasShellSession).toBe(true)
      expect(sent.sessions[1].hasShellSession).toBe(false)
    })
  })

  describe(`cleanup`, () => {
    it(`removes org monitor on close`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp()
      mockVerifyShellToken.mockReturnValue({ orgId: ORG_ID, userId: USER_ID })

      await onMonitorConnect(ws, buildMockReq(`/_/sandboxes/monitor?token=valid`), app)

      ;(ws as any)._handlers.close()
      expect(app.locals.sandbox!.removeOrgMonitor).toHaveBeenCalledWith(ORG_ID, ws)
    })

    it(`removes org monitor on error`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp()
      mockVerifyShellToken.mockReturnValue({ orgId: ORG_ID, userId: USER_ID })

      await onMonitorConnect(ws, buildMockReq(`/_/sandboxes/monitor?token=valid`), app)

      ;(ws as any)._handlers.error(new Error(`test`))
      expect(app.locals.sandbox!.removeOrgMonitor).toHaveBeenCalledWith(ORG_ID, ws)
    })

    it(`removes org monitor when snapshot send throws`, async () => {
      const ws = buildMockWs()
      ;(ws.send as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error(`Connection closed`)
      })
      const app = buildMockApp({
        sandbox: {
          addOrgMonitor: vi.fn(),
          removeOrgMonitor: vi.fn(),
          getSessionsForSandbox: vi.fn().mockReturnValue([{ sessionId: `s1` }]),
          getShellSession: vi.fn().mockReturnValue(null),
          buildInstanceSnapshot: vi.fn().mockResolvedValue(defInstanceSnapshot),
        },
      })
      mockVerifyShellToken.mockReturnValue({ orgId: ORG_ID, userId: USER_ID })

      await onMonitorConnect(ws, buildMockReq(`/_/sandboxes/monitor?token=valid`), app)

      expect(app.locals.sandbox!.removeOrgMonitor).toHaveBeenCalledWith(ORG_ID, ws)
    })
  })

  describe(`error handling`, () => {
    it(`closes with 4002 on unhandled exception`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        sandboxDb: { listByOrg: vi.fn().mockRejectedValue(new Error(`DB crashed`)) },
      })
      mockVerifyShellToken.mockReturnValue({ orgId: ORG_ID, userId: USER_ID })

      await onMonitorConnect(ws, buildMockReq(`/_/sandboxes/monitor?token=valid`), app)

      expect(ws.close).toHaveBeenCalledWith(4002, `Internal server error`)
    })
  })
})
