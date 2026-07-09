import type WebSocket from 'ws'
import type { IncomingMessage } from 'http'
import type { TApp } from '@TBE/types'

import { PassThrough } from 'stream'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiKeyPrefix, ESandboxSessionVisibility } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/services/sessionToken`, () => ({
  verifyShellToken: vi.fn(),
}))

vi.mock(`@TBE/utils/auth/checkUserPermission`, () => ({
  checkUserPermission: vi.fn(),
}))

import { onShellConnect } from './onShellConnect'
import { verifyShellToken } from '@TBE/services/sessionToken'
import { checkUserPermission } from '@TBE/utils/auth/checkUserPermission'

const mockVerifyShellToken = verifyShellToken as ReturnType<typeof vi.fn>
const mockCheckUserPermission = checkUserPermission as ReturnType<typeof vi.fn>

const SANDBOX_ID = `sb-test-123`
const ORG_ID = `org-test-456`
const USER_ID = `user-test-789`
const INSTANCE_ID = `pod-test-abc`

const buildMockWs = () => {
  const handlers: Record<string, Function> = {}
  return {
    close: vi.fn(),
    send: vi.fn(),
    ping: vi.fn(),
    readyState: 1,
    OPEN: 1,
    CONNECTING: 0,
    on: vi.fn((event: string, handler: Function) => {
      handlers[event] = handler
    }),
    _handlers: handlers,
  } as unknown as WebSocket & { _handlers: Record<string, Function> }
}

const buildMockReq = (url: string, headers: Record<string, string> = {}) =>
  ({ url, headers }) as unknown as IncomingMessage

const buildExecStream = () => ({
  stdin: new PassThrough(),
  stdout: new PassThrough(),
  stderr: new PassThrough(),
  close: vi.fn(),
  resize: vi.fn(),
})

const buildMockApp = (overrides: Record<string, any> = {}) => {
  const sandboxService = {
    detachFromShellSession: vi.fn(),
    getShellSession: vi.fn().mockReturnValue(undefined),
    attachToShellSession: vi.fn(),
    findRunningInstance: vi.fn().mockResolvedValue(INSTANCE_ID),
    findRunningInstances: vi.fn().mockResolvedValue([INSTANCE_ID]),
    validateInstanceOwnership: vi.fn().mockResolvedValue(undefined),
    getOrgShellSessionCount: vi.fn().mockReturnValue(0),
    addShellSession: vi.fn(),
    addSession: vi.fn(),
    broadcastSessionList: vi.fn(),
    updateActivity: vi.fn(),
    updateSessionVisibility: vi.fn(),
    removeSession: vi.fn(),
    removeShellSession: vi.fn(),
    ...overrides.sandbox,
  }

  const kube = {
    getPod: vi.fn().mockResolvedValue({
      metadata: { labels: { [`tdsk.app/user-id`]: USER_ID } },
    }),
    execStream: vi.fn().mockResolvedValue(buildExecStream()),
    ...overrides.kube,
  }

  const s3 = {
    createUploadStream: vi.fn().mockReturnValue({
      stream: new PassThrough(),
      done: vi.fn().mockResolvedValue(undefined),
    }),
    ...overrides.s3,
  }

  return {
    locals: {
      db: {
        services: {
          apiKey: {
            getByHash: vi.fn().mockResolvedValue({ data: null }),
            ...overrides.apiKey,
          },
          sandbox: {
            get: vi.fn().mockResolvedValue({
              data: { orgId: ORG_ID, config: { runtime: `claude` }, projects: [] },
            }),
            ...overrides.sandboxDb,
          },
          org: {
            get: vi.fn().mockResolvedValue({ data: { id: ORG_ID, ownerId: USER_ID } }),
            ...overrides.org,
          },
          subscription: {
            findByUser: vi.fn().mockResolvedValue({ data: { tier: `pro` } }),
            ...overrides.subscription,
          },
          sandboxSession: {
            create: vi.fn().mockResolvedValue({ data: { id: `sbsess_1` } }),
            complete: vi.fn().mockResolvedValue({ data: {} }),
            ...overrides.sandboxSession,
          },
        },
      },
      sandbox: sandboxService,
      kube,
      s3,
      ...overrides.locals,
    },
  } as unknown as TApp
}

describe(`onShellConnect`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyShellToken.mockReset()
    mockCheckUserPermission.mockReset()
    mockCheckUserPermission.mockResolvedValue({ allowed: true })
  })

  describe(`path validation`, () => {
    it(`closes with 4000 for a malformed shell path`, async () => {
      const ws = buildMockWs()
      await onShellConnect(ws, buildMockReq(`/_/sandboxes/shell`), buildMockApp())
      expect(ws.close).toHaveBeenCalledWith(4000, `Invalid shell path`)
    })
  })

  describe(`authentication`, () => {
    it(`closes with 4001 when no auth is provided`, async () => {
      const ws = buildMockWs()
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell`),
        buildMockApp()
      )
      expect(ws.close).toHaveBeenCalledWith(4001, `Authorization required`)
    })

    it(`closes with 4001 for an invalid API key`, async () => {
      const ws = buildMockWs()
      const testKey = `${ApiKeyPrefix}bad-key`
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell`, {
          authorization: `Bearer ${testKey}`,
        }),
        buildMockApp()
      )
      expect(ws.close).toHaveBeenCalledWith(4001, `Invalid or expired API key`)
    })

    it(`closes with 4001 when the API key lacks org/user scope`, async () => {
      const ws = buildMockWs()
      const testKey = `${ApiKeyPrefix}scoped-key`
      const app = buildMockApp({
        apiKey: {
          getByHash: vi.fn().mockResolvedValue({
            data: { orgId: null, userId: null, isValid: () => true },
          }),
        },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell`, {
          authorization: `Bearer ${testKey}`,
        }),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(4001, `API key missing org or user scope`)
    })

    it(`authenticates with a valid API key and proceeds`, async () => {
      const ws = buildMockWs()
      const testKey = `${ApiKeyPrefix}good-key`
      const app = buildMockApp({
        apiKey: {
          getByHash: vi.fn().mockResolvedValue({
            data: {
              orgId: ORG_ID,
              userId: USER_ID,
              isValid: () => true,
              permissions: [],
            },
          }),
        },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell`, {
          authorization: `Bearer ${testKey}`,
        }),
        app
      )
      expect(ws.close).not.toHaveBeenCalledWith(4001, expect.any(String))
      expect(app.locals.sandbox!.addShellSession).toHaveBeenCalled()
    })

    it(`closes with 4001 for an invalid Bearer shell token`, async () => {
      const ws = buildMockWs()
      mockVerifyShellToken.mockReturnValue(null)
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell`, {
          authorization: `Bearer sometoken`,
        }),
        buildMockApp()
      )
      expect(ws.close).toHaveBeenCalledWith(4001, `Invalid or expired token`)
    })

    it(`closes with 4001 when the Bearer shell token targets a different sandbox`, async () => {
      const ws = buildMockWs()
      mockVerifyShellToken.mockReturnValue({
        orgId: ORG_ID,
        userId: USER_ID,
        sandboxId: `other-sb`,
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell`, {
          authorization: `Bearer sometoken`,
        }),
        buildMockApp()
      )
      expect(ws.close).toHaveBeenCalledWith(4001, `Token not authorized for this sandbox`)
    })

    it(`closes with 4001 for an invalid query token`, async () => {
      const ws = buildMockWs()
      mockVerifyShellToken.mockReturnValue(null)
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=bad`),
        buildMockApp()
      )
      expect(ws.close).toHaveBeenCalledWith(4001, `Invalid or expired shell token`)
    })

    it(`closes with 4001 when the query token targets a different sandbox`, async () => {
      const ws = buildMockWs()
      mockVerifyShellToken.mockReturnValue({
        orgId: ORG_ID,
        userId: USER_ID,
        sandboxId: `other-sb`,
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        buildMockApp()
      )
      expect(ws.close).toHaveBeenCalledWith(4001, `Invalid or expired shell token`)
    })
  })

  describe(`sandbox verification`, () => {
    beforeEach(() => {
      mockVerifyShellToken.mockReturnValue({
        orgId: ORG_ID,
        userId: USER_ID,
        sandboxId: SANDBOX_ID,
      })
    })

    it(`closes with 4005 when the sandbox lookup errors`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        sandboxDb: { get: vi.fn().mockResolvedValue({ error: new Error(`db down`) }) },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(
        4005,
        `Failed to verify sandbox, please retry`
      )
    })

    it(`closes with 4004 when the sandbox does not exist`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        sandboxDb: { get: vi.fn().mockResolvedValue({ data: null }) },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(4004, `Sandbox not found`)
    })

    it(`closes with 4001 when the sandbox belongs to a different org`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        sandboxDb: {
          get: vi.fn().mockResolvedValue({ data: { orgId: `other-org`, config: {} } }),
        },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(4001, `Sandbox not authorized`)
    })
  })

  describe(`permission check`, () => {
    beforeEach(() => {
      mockVerifyShellToken.mockReturnValue({
        orgId: ORG_ID,
        userId: USER_ID,
        sandboxId: SANDBOX_ID,
      })
    })

    it(`closes with the permission denial reason when connect is not allowed`, async () => {
      const ws = buildMockWs()
      mockCheckUserPermission.mockResolvedValue({ allowed: false, reason: `Not allowed` })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        buildMockApp()
      )
      expect(ws.close).toHaveBeenCalledWith(4003, `Not allowed`)
    })
  })

  describe(`service availability`, () => {
    beforeEach(() => {
      mockVerifyShellToken.mockReturnValue({
        orgId: ORG_ID,
        userId: USER_ID,
        sandboxId: SANDBOX_ID,
      })
    })

    it(`closes with 4003 when the sandbox service is unavailable`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp()
      ;(app.locals as any).sandbox = undefined
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(4003, `Sandbox service not available`)
    })

    it(`closes with 4003 when the kube client is unavailable`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp()
      ;(app.locals as any).kube = undefined
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(4003, `Sandbox service not available`)
    })
  })

  describe(`reconnect flow`, () => {
    beforeEach(() => {
      mockVerifyShellToken.mockReturnValue({
        orgId: ORG_ID,
        userId: USER_ID,
        sandboxId: SANDBOX_ID,
      })
    })

    it(`re-attaches the owner's own session and sends "reconnected"`, async () => {
      const ws = buildMockWs()
      const drain = vi.fn().mockReturnValue(Buffer.from(``))
      const app = buildMockApp({
        sandbox: {
          getShellSession: vi
            .fn()
            .mockReturnValue({
              sandboxId: SANDBOX_ID,
              userId: USER_ID,
              visibility: ESandboxSessionVisibility.private,
            }),
          attachToShellSession: vi.fn().mockReturnValue({
            visibility: ESandboxSessionVisibility.private,
            buffer: { drain },
          }),
        },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid&sessionId=sess-own`),
        app
      )
      const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0])
      expect(sent.type).toBe(`reconnected`)
      expect(sent.sessionId).toBe(`sess-own`)
    })

    it(`closes with 4005 when the session expired during reconnect`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        sandbox: {
          getShellSession: vi
            .fn()
            .mockReturnValue({
              sandboxId: SANDBOX_ID,
              userId: USER_ID,
              visibility: ESandboxSessionVisibility.private,
            }),
          attachToShellSession: vi.fn().mockReturnValue(null),
        },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid&sessionId=sess-gone`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(4005, `Session expired during reconnection`)
    })

    it(`refuses a cross-user join when the session is not public`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        sandbox: {
          getShellSession: vi.fn().mockReturnValue({
            sandboxId: SANDBOX_ID,
            userId: `other-user`,
            visibility: ESandboxSessionVisibility.private,
          }),
        },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid&sessionId=sess-other`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(4003, `Session is not shared`)
    })

    it(`refuses a cross-user join when the joiner lacks manage permission`, async () => {
      const ws = buildMockWs()
      // First call is the top-level "connect" check (allowed); the join-time
      // sandboxSession:manage and sandbox:manage checks that follow are both denied.
      mockCheckUserPermission
        .mockResolvedValueOnce({ allowed: true })
        .mockResolvedValue({ allowed: false, reason: `nope` })
      const app = buildMockApp({
        sandbox: {
          getShellSession: vi.fn().mockReturnValue({
            sandboxId: SANDBOX_ID,
            userId: `other-user`,
            visibility: ESandboxSessionVisibility.public,
          }),
        },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid&sessionId=sess-other`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(4003, `Not authorized to join this session`)
    })

    it(`allows a cross-user join with manage permission and notifies other attachments`, async () => {
      const ws = buildMockWs()
      const otherClient = { readyState: 1, send: vi.fn() }
      const drain = vi.fn().mockReturnValue(Buffer.from(``))
      // First checkUserPermission call is the top-level "connect" check (allowed),
      // subsequent calls are the join-time "manage" checks.
      mockCheckUserPermission
        .mockResolvedValueOnce({ allowed: true })
        .mockResolvedValueOnce({ allowed: true })
      const app = buildMockApp({
        sandbox: {
          getShellSession: vi.fn().mockReturnValue({
            sandboxId: SANDBOX_ID,
            userId: `other-user`,
            visibility: ESandboxSessionVisibility.public,
          }),
          attachToShellSession: vi.fn().mockReturnValue({
            userId: `other-user`,
            buffer: { drain },
            attachments: new Set([ws, otherClient]),
          }),
        },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid&sessionId=sess-other`),
        app
      )
      const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0])
      expect(sent.type).toBe(`joined`)
      expect(otherClient.send).toHaveBeenCalledWith(
        expect.stringContaining(`user-joined`)
      )
    })
  })

  describe(`instance resolution`, () => {
    beforeEach(() => {
      mockVerifyShellToken.mockReturnValue({
        orgId: ORG_ID,
        userId: USER_ID,
        sandboxId: SANDBOX_ID,
      })
    })

    it(`closes with 4004 when the requested instance is not running`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        sandbox: { findRunningInstance: vi.fn().mockResolvedValue(undefined) },
      })
      await onShellConnect(
        ws,
        buildMockReq(
          `/_/sandboxes/${SANDBOX_ID}/shell?token=valid&instanceId=req-instance`
        ),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(
        4004,
        `Requested instance req-instance is not running`
      )
    })

    it(`closes with 4004 when no running instance exists`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        sandbox: { findRunningInstances: vi.fn().mockResolvedValue([]) },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(
        4004,
        `No running instance for sandbox ${SANDBOX_ID}`
      )
    })
  })

  describe(`ownership validation`, () => {
    beforeEach(() => {
      mockVerifyShellToken.mockReturnValue({
        orgId: ORG_ID,
        userId: USER_ID,
        sandboxId: SANDBOX_ID,
      })
    })

    it(`closes with 4003 when instance ownership validation fails`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        sandbox: {
          validateInstanceOwnership: vi.fn().mockRejectedValue(new Error(`not yours`)),
        },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(4003, `Not authorized`)
    })
  })

  describe(`pod fetch`, () => {
    beforeEach(() => {
      mockVerifyShellToken.mockReturnValue({
        orgId: ORG_ID,
        userId: USER_ID,
        sandboxId: SANDBOX_ID,
      })
    })

    it(`closes with 4004 when the pod is not reachable`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        kube: { getPod: vi.fn().mockRejectedValue(new Error(`not found`)) },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(4004, `Pod not reachable`)
    })
  })

  describe(`plan limits`, () => {
    beforeEach(() => {
      mockVerifyShellToken.mockReturnValue({
        orgId: ORG_ID,
        userId: USER_ID,
        sandboxId: SANDBOX_ID,
      })
    })

    it(`closes with 4029 when the org lookup fails`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        org: { get: vi.fn().mockResolvedValue({ error: new Error(`db down`) }) },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(
        4029,
        `Unable to verify session limits. Please try again.`
      )
    })

    it(`closes with 4004 when the org no longer exists`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        org: { get: vi.fn().mockResolvedValue({ data: null }) },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(4004, `Organization not found`)
    })

    it(`closes with 4029 when the subscription lookup fails`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        subscription: {
          findByUser: vi.fn().mockResolvedValue({ error: new Error(`db down`) }),
        },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(
        4029,
        `Unable to verify session limits. Please try again.`
      )
    })

    it(`closes with 4029 when the session limit for the plan is reached`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        subscription: {
          findByUser: vi.fn().mockResolvedValue({ data: { tier: `free` } }),
        },
        sandbox: { getOrgShellSessionCount: vi.fn().mockReturnValue(1) },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(4029, `Session limit reached for your plan`)
    })

    it(`bypasses the session cap entirely for an unlimited (-1) plan`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        subscription: {
          findByUser: vi.fn().mockResolvedValue({ data: { tier: `team` } }),
        },
        sandbox: { getOrgShellSessionCount: vi.fn().mockReturnValue(999) },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).not.toHaveBeenCalledWith(4029, expect.any(String))
    })

    it(`allows the org owner to skip the limit check when the org has no ownerId`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        org: { get: vi.fn().mockResolvedValue({ data: { id: ORG_ID, ownerId: null } }) },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).not.toHaveBeenCalledWith(4029, expect.any(String))
    })
  })

  describe(`happy path connect`, () => {
    beforeEach(() => {
      mockVerifyShellToken.mockReturnValue({
        orgId: ORG_ID,
        userId: USER_ID,
        sandboxId: SANDBOX_ID,
      })
    })

    it(`establishes the exec stream, creates a session record, and sends "connected"`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp()
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )

      expect(app.locals.kube!.execStream).toHaveBeenCalledWith(
        INSTANCE_ID,
        [`su`, `-l`, `sandbox`],
        expect.objectContaining({ tty: true })
      )
      expect(app.locals.db.services.sandboxSession.create).toHaveBeenCalled()
      expect(app.locals.sandbox!.addShellSession).toHaveBeenCalled()
      expect(app.locals.sandbox!.addSession).toHaveBeenCalledWith(
        INSTANCE_ID,
        expect.objectContaining({ orgId: ORG_ID, userId: USER_ID })
      )

      const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0])
      expect(sent.type).toBe(`connected`)
      expect(sent.sandboxId).toBe(SANDBOX_ID)
    })

    it(`closes with 4005 when the exec stream fails to establish`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        kube: { execStream: vi.fn().mockRejectedValue(new Error(`exec failed`)) },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(4005, `Shell connection failed`)
    })

    it(`closes with 4005 when the sandbox session record fails to persist`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp({
        sandboxSession: {
          create: vi.fn().mockResolvedValue({ error: new Error(`db down`) }),
        },
      })
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      expect(ws.close).toHaveBeenCalledWith(4005, `Failed to create session record`)
    })
  })

  describe(`wireWebSocket message handling`, () => {
    beforeEach(() => {
      mockVerifyShellToken.mockReturnValue({
        orgId: ORG_ID,
        userId: USER_ID,
        sandboxId: SANDBOX_ID,
      })
    })

    it(`forwards binary frames to exec stdin and bumps activity`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp()
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )

      const writeSpy = vi.fn()
      const session = (app.locals.sandbox!.addShellSession as ReturnType<typeof vi.fn>)
        .mock.calls[0][0]
      session.stdin.write = writeSpy
      Object.defineProperty(session.stdin, `writable`, {
        value: true,
        configurable: true,
      })

      ;(ws as any)._handlers.message(Buffer.from(`ls -la`), true)

      expect(writeSpy).toHaveBeenCalledWith(Buffer.from(`ls -la`))
      expect(app.locals.sandbox!.updateActivity).toHaveBeenCalledWith(INSTANCE_ID)
    })

    it(`applies a resize control message to the session`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp()
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )

      ;(ws as any)._handlers.message(
        JSON.stringify({ type: `resize`, cols: 100, rows: 40 }),
        false
      )

      const session = (app.locals.sandbox!.addShellSession as ReturnType<typeof vi.fn>)
        .mock.calls[0][0]
      expect(session.resize).toHaveBeenCalledWith(100, 40)
    })

    it(`ignores a visibility change from a non-owner attachment`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp()
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )
      ;(
        app.locals.sandbox!.updateSessionVisibility as ReturnType<typeof vi.fn>
      ).mockClear()

      // Simulate a joined (non-owner) attachment on the same ws.
      const joinedWs = buildMockWs()
      const joinedApp = buildMockApp()
      const drain = vi.fn().mockReturnValue(Buffer.from(``))
      joinedApp.locals.sandbox!.getShellSession = vi.fn().mockReturnValue({
        sandboxId: SANDBOX_ID,
        userId: `owner-user`,
        visibility: ESandboxSessionVisibility.public,
      })
      joinedApp.locals.sandbox!.attachToShellSession = vi.fn().mockReturnValue({
        userId: `owner-user`,
        buffer: { drain },
        attachments: new Set([joinedWs]),
      })
      await onShellConnect(
        joinedWs,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid&sessionId=sess-owned`),
        joinedApp
      )

      ;(joinedWs as any)._handlers.message(
        JSON.stringify({
          type: `visibility`,
          visibility: ESandboxSessionVisibility.public,
        }),
        false
      )

      expect(joinedApp.locals.sandbox!.updateSessionVisibility).not.toHaveBeenCalled()
    })

    it(`ignores malformed control messages without throwing`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp()
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )

      expect(() => (ws as any)._handlers.message(`not json`, false)).not.toThrow()
    })
  })

  describe(`cleanup`, () => {
    beforeEach(() => {
      mockVerifyShellToken.mockReturnValue({
        orgId: ORG_ID,
        userId: USER_ID,
        sandboxId: SANDBOX_ID,
      })
    })

    it(`detaches the shell session and sends a disconnected message on ws close`, async () => {
      const ws = buildMockWs()
      const app = buildMockApp()
      await onShellConnect(
        ws,
        buildMockReq(`/_/sandboxes/${SANDBOX_ID}/shell?token=valid`),
        app
      )

      ;(ws as any)._handlers.close()

      expect(app.locals.sandbox!.detachFromShellSession).toHaveBeenCalled()
      const disconnectMsg = (ws.send as ReturnType<typeof vi.fn>).mock.calls.find((c) =>
        c[0].includes(`disconnected`)
      )
      expect(disconnectMsg).toBeDefined()
    })
  })
})
