import type { Response } from 'express'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @TBE/types — provide EPMethod used by endpoint.ts source
vi.mock(`@TBE/types`, () => ({
  EPMethod: {
    Use: `use`,
    All: `all`,
    Put: `put`,
    Get: `get`,
    Post: `post`,
    Patch: `patch`,
    Proxy: `proxy`,
    Delete: `delete`,
  },
}))

// Mock logger
vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// Mock authenticateRequest
vi.mock(`@TBE/utils/auth/authenticateRequest`, () => ({
  authenticateRequest: vi.fn(),
}))

// Mock parseJsonBody
vi.mock(`@TBE/utils/parseJsonBody`, () => ({
  parseJsonBody: vi.fn().mockResolvedValue({ parsed: true }),
}))

// Mock @tdsk/domain — inline the enum values and Exception class
vi.mock(`@tdsk/domain`, () => ({
  EEndpointType: { proxy: `proxy`, faas: `faas`, agent: `agent` },
  Exception: class Exception extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

// Mock getEPService — returns a controllable mock service
const mockService = {
  validateProject: vi.fn(),
  checkPermission: vi.fn().mockResolvedValue(undefined),
  validateMethod: vi.fn(),
  execute: vi.fn().mockResolvedValue(undefined),
}
vi.mock(`@TBE/services/endpoints`, () => ({
  getEPService: vi.fn(() => mockService),
}))

import { endpoint } from './endpoint'
import { authenticateRequest } from '@TBE/utils/auth/authenticateRequest'
import { parseJsonBody } from '@TBE/utils/parseJsonBody'
import { EEndpointType } from '@tdsk/domain'
import { getEPService } from '@TBE/services/endpoints'
import { logger } from '@TBE/utils/logger'

type TExceptionLike = Error & { status: number }
type TRequest = Record<string, any>

describe(`proxy endpoint action`, () => {
  let mockRes: Partial<Response> & { locals: Record<string, any> }

  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      params: { projectId: `proj-1`, endpointId: `ep-1` },
      app: {
        locals: {
          db: {
            services: {
              endpoint: {
                get: vi.fn().mockResolvedValue({
                  data: {
                    id: `ep-1`,
                    type: EEndpointType.proxy,
                    projectId: `proj-1`,
                    public: false,
                  },
                  error: null,
                }),
              },
            },
          },
        },
      },
      path: `/proxy/proj-1/ep-1`,
      method: `GET`,
      ...overrides,
    } as unknown as TRequest
  }

  beforeEach(() => {
    vi.resetAllMocks()
    mockRes = { locals: {} } as Partial<Response> & { locals: Record<string, any> }

    // Reset default mock behaviors after resetAllMocks clears implementations
    mockService.validateProject.mockReturnValue(undefined)
    mockService.checkPermission.mockResolvedValue(undefined)
    mockService.validateMethod.mockReturnValue(undefined)
    mockService.execute.mockResolvedValue(undefined)

    // authenticateRequest should succeed (no-op) by default
    const mockAuth = authenticateRequest as ReturnType<typeof vi.fn>
    mockAuth.mockResolvedValue(undefined)

    // parseJsonBody default
    const mockParse = parseJsonBody as ReturnType<typeof vi.fn>
    mockParse.mockResolvedValue({ parsed: true })

    // getEPService default
    const mockGetService = getEPService as ReturnType<typeof vi.fn>
    mockGetService.mockReturnValue(mockService)
  })

  it(`should throw 400 when projectId is missing`, async () => {
    const req = buildMockReq({ params: { endpointId: `ep-1` } })

    await expect(endpoint.action!(req as any, mockRes as Response)).rejects.toThrow(
      `Project ID and Endpoint ID are required`
    )
  })

  it(`should throw 400 when endpointId is missing`, async () => {
    const req = buildMockReq({ params: { projectId: `proj-1` } })

    await expect(endpoint.action!(req as any, mockRes as Response)).rejects.toThrow(
      `Project ID and Endpoint ID are required`
    )
  })

  it(`should throw 404 when endpoint not found in DB`, async () => {
    const req = buildMockReq()
    const mockGet = req.app.locals.db.services.endpoint.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ data: null, error: null })

    await expect(endpoint.action!(req as any, mockRes as Response)).rejects.toThrow(
      `Endpoint not found`
    )
  })

  it(`should throw 404 when endpoint lookup returns error`, async () => {
    const req = buildMockReq()
    const mockGet = req.app.locals.db.services.endpoint.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ data: null, error: new Error(`DB error`) })

    await expect(endpoint.action!(req as any, mockRes as Response)).rejects.toThrow(
      `Endpoint not found`
    )
  })

  it(`should call getEPService with the endpoint type`, async () => {
    const req = buildMockReq()
    await endpoint.action!(req as any, mockRes as Response)

    expect(getEPService).toHaveBeenCalledWith(EEndpointType.proxy)
  })

  it(`should validate project ownership`, async () => {
    const req = buildMockReq()
    await endpoint.action!(req as any, mockRes as Response)

    expect(mockService.validateProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: `ep-1`, projectId: `proj-1` }),
      `proj-1`
    )
  })

  // --- Public vs Non-public auth ---

  it(`should NOT call authenticateRequest for public endpoints`, async () => {
    const req = buildMockReq()
    const mockGet = req.app.locals.db.services.endpoint.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({
      data: {
        id: `ep-1`,
        type: EEndpointType.proxy,
        projectId: `proj-1`,
        public: true,
      },
      error: null,
    })

    await endpoint.action!(req as any, mockRes as Response)

    expect(authenticateRequest).not.toHaveBeenCalled()
  })

  it(`should call authenticateRequest for non-public endpoints`, async () => {
    const req = buildMockReq()

    await endpoint.action!(req as any, mockRes as Response)

    expect(authenticateRequest).toHaveBeenCalledWith(req, mockRes)
  })

  it(`should call authenticateRequest when ep.public is undefined`, async () => {
    const req = buildMockReq()
    const mockGet = req.app.locals.db.services.endpoint.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({
      data: {
        id: `ep-1`,
        type: EEndpointType.faas,
        projectId: `proj-1`,
      },
      error: null,
    })

    await endpoint.action!(req as any, mockRes as Response)

    expect(authenticateRequest).toHaveBeenCalledWith(req, mockRes)
  })

  it(`should propagate authenticateRequest errors (401)`, async () => {
    const mockAuth = authenticateRequest as ReturnType<typeof vi.fn>
    const authError = new Error(
      `A valid and authorized user is required`
    ) as TExceptionLike
    authError.status = 401
    mockAuth.mockRejectedValue(authError)

    const req = buildMockReq()

    await expect(endpoint.action!(req as any, mockRes as Response)).rejects.toThrow(
      `A valid and authorized user is required`
    )
  })

  // --- Project-scoped API key guard ---

  it(`should throw 403 when project-scoped key targets different project`, async () => {
    const mockAuth = authenticateRequest as ReturnType<typeof vi.fn>
    mockAuth.mockImplementation(async (_req: any, res: any) => {
      res.locals.auth = { projectId: `proj-OTHER` }
    })

    const req = buildMockReq()

    try {
      await endpoint.action!(req as any, mockRes as Response)
      expect.unreachable(`Should have thrown`)
    } catch (err) {
      expect((err as TExceptionLike).status).toBe(403)
      expect((err as Error).message).toContain(
        `API key does not have access to this project`
      )
    }
  })

  it(`should log warning when project-scoped key is blocked`, async () => {
    const mockAuth = authenticateRequest as ReturnType<typeof vi.fn>
    mockAuth.mockImplementation(async (_req: any, res: any) => {
      res.locals.auth = { projectId: `proj-OTHER` }
    })

    const req = buildMockReq()

    try {
      await endpoint.action!(req as any, mockRes as Response)
    } catch {
      // expected
    }

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Project-scoped key blocked from different project endpoint`,
        keyProjectId: `proj-OTHER`,
        targetProjectId: `proj-1`,
      })
    )
  })

  it(`should allow when project-scoped key matches target project`, async () => {
    const mockAuth = authenticateRequest as ReturnType<typeof vi.fn>
    mockAuth.mockImplementation(async (_req: any, res: any) => {
      res.locals.auth = { projectId: `proj-1` }
    })

    const req = buildMockReq()

    await expect(
      endpoint.action!(req as any, mockRes as Response)
    ).resolves.toBeUndefined()
  })

  it(`should allow when auth has no projectId (org-scoped key)`, async () => {
    const mockAuth = authenticateRequest as ReturnType<typeof vi.fn>
    mockAuth.mockImplementation(async (_req: any, res: any) => {
      res.locals.auth = { userId: `user-1` }
    })

    const req = buildMockReq()

    await expect(
      endpoint.action!(req as any, mockRes as Response)
    ).resolves.toBeUndefined()
  })

  it(`should skip project access guard for public endpoints`, async () => {
    const req = buildMockReq()
    const mockGet = req.app.locals.db.services.endpoint.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({
      data: {
        id: `ep-1`,
        type: EEndpointType.proxy,
        projectId: `proj-1`,
        public: true,
      },
      error: null,
    })

    // Should NOT throw even though auth is never set — public endpoints skip auth entirely
    await expect(
      endpoint.action!(req as any, mockRes as Response)
    ).resolves.toBeUndefined()
    expect(authenticateRequest).not.toHaveBeenCalled()
  })

  // --- Permission check ---

  it(`should call checkPermission on the service`, async () => {
    const req = buildMockReq()
    await endpoint.action!(req as any, mockRes as Response)

    expect(mockService.checkPermission).toHaveBeenCalledWith(
      req,
      expect.objectContaining({ id: `ep-1` })
    )
  })

  // --- Body parsing ---

  it(`should NOT parse JSON body for proxy endpoint type`, async () => {
    const req = buildMockReq()

    await endpoint.action!(req as any, mockRes as Response)

    expect(parseJsonBody).not.toHaveBeenCalled()
  })

  it(`should parse JSON body for FaaS endpoint type`, async () => {
    const req = buildMockReq()
    const mockGet = req.app.locals.db.services.endpoint.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({
      data: {
        id: `ep-1`,
        type: EEndpointType.faas,
        projectId: `proj-1`,
        public: false,
      },
      error: null,
    })

    await endpoint.action!(req as any, mockRes as Response)

    expect(parseJsonBody).toHaveBeenCalledWith(req)
  })

  it(`should parse JSON body for Agent endpoint type`, async () => {
    const req = buildMockReq()
    const mockGet = req.app.locals.db.services.endpoint.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({
      data: {
        id: `ep-1`,
        type: EEndpointType.agent,
        projectId: `proj-1`,
        public: false,
      },
      error: null,
    })

    await endpoint.action!(req as any, mockRes as Response)

    expect(parseJsonBody).toHaveBeenCalledWith(req)
  })

  it(`should assign parsed body to req.body for non-proxy types`, async () => {
    const mockParse = parseJsonBody as ReturnType<typeof vi.fn>
    mockParse.mockResolvedValue({ input: `hello` })

    const req = buildMockReq()
    const mockGet = req.app.locals.db.services.endpoint.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({
      data: {
        id: `ep-1`,
        type: EEndpointType.faas,
        projectId: `proj-1`,
        public: false,
      },
      error: null,
    })

    await endpoint.action!(req as any, mockRes as Response)

    expect(req.body).toEqual({ input: `hello` })
  })

  // --- Method validation ---

  it(`should validate HTTP method`, async () => {
    const req = buildMockReq()
    await endpoint.action!(req as any, mockRes as Response)

    expect(mockService.validateMethod).toHaveBeenCalledWith(
      req,
      expect.objectContaining({ id: `ep-1` })
    )
  })

  // --- Execute ---

  it(`should call service.execute with req, res, ep, and db`, async () => {
    const req = buildMockReq()
    await endpoint.action!(req as any, mockRes as Response)

    expect(mockService.execute).toHaveBeenCalledWith(
      req,
      mockRes,
      expect.objectContaining({ id: `ep-1` }),
      req.app.locals.db
    )
  })

  // --- Full happy path ---

  it(`should execute full flow for non-public non-proxy endpoint`, async () => {
    const mockAuth = authenticateRequest as ReturnType<typeof vi.fn>
    mockAuth.mockImplementation(async (_req: any, res: any) => {
      res.locals.auth = { userId: `user-1` }
    })

    const mockParse = parseJsonBody as ReturnType<typeof vi.fn>
    mockParse.mockResolvedValue({ message: `hello` })

    const req = buildMockReq()
    const mockGet = req.app.locals.db.services.endpoint.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({
      data: {
        id: `ep-1`,
        type: EEndpointType.faas,
        projectId: `proj-1`,
        public: false,
        method: `post`,
      },
      error: null,
    })

    await endpoint.action!(req as any, mockRes as Response)

    // Verify full flow order
    expect(getEPService).toHaveBeenCalledWith(EEndpointType.faas)
    expect(mockService.validateProject).toHaveBeenCalled()
    expect(authenticateRequest).toHaveBeenCalledWith(req, mockRes)
    expect(mockService.checkPermission).toHaveBeenCalled()
    expect(parseJsonBody).toHaveBeenCalledWith(req)
    expect(mockService.validateMethod).toHaveBeenCalled()
    expect(mockService.execute).toHaveBeenCalled()
  })

  it(`should execute full flow for public proxy endpoint`, async () => {
    const req = buildMockReq()
    const mockGet = req.app.locals.db.services.endpoint.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({
      data: {
        id: `ep-1`,
        type: EEndpointType.proxy,
        projectId: `proj-1`,
        public: true,
      },
      error: null,
    })

    await endpoint.action!(req as any, mockRes as Response)

    // Auth skipped for public
    expect(authenticateRequest).not.toHaveBeenCalled()
    // Body parsing skipped for proxy type
    expect(parseJsonBody).not.toHaveBeenCalled()
    // But permission check and execute still called
    expect(mockService.checkPermission).toHaveBeenCalled()
    expect(mockService.execute).toHaveBeenCalled()
  })
})
