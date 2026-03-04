import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TRequest, TResponse } from '@TBE/types'
import type { NextFunction } from 'express'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

import { projectAccessGuard } from './projectAccessGuard'

describe(`projectAccessGuard middleware`, () => {
  let mockNext: ReturnType<typeof vi.fn>
  let mockRes: Partial<TResponse>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const buildHeaders = (headers: Record<string, string> = {}) => {
    return (name: string) => headers[name] || undefined
  }

  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      header: buildHeaders(overrides.headers || {}),
      params: {},
      query: {},
      body: {},
      ...overrides,
    } as unknown as TRequest
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockJson = vi.fn()
    mockStatus = vi.fn(() => ({ json: mockJson }) as any)
    mockRes = { status: mockStatus } as Partial<TResponse>
    mockNext = vi.fn()
  })

  it(`should pass through when API key has no projectId (org-scoped)`, () => {
    const req = buildMockReq({
      headers: { 'X-User-Id': `user-1`, 'X-User-Org-Id': `org-1` },
      params: { projectId: `proj-1` },
    })

    const middleware = projectAccessGuard()
    middleware(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith()
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it(`should pass through when no auth headers at all (JWT auth)`, () => {
    const req = buildMockReq({ headers: {} })

    const middleware = projectAccessGuard()
    middleware(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith()
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it(`should pass through when target projectId matches API key projectId`, () => {
    const req = buildMockReq({
      headers: { 'X-User-Id': `user-1`, 'X-User-Project-Id': `proj-1` },
      params: { projectId: `proj-1` },
    })

    const middleware = projectAccessGuard()
    middleware(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith()
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it(`should match projectId from query when not in params`, () => {
    const req = buildMockReq({
      headers: { 'X-User-Id': `user-1`, 'X-User-Project-Id': `proj-1` },
      params: {},
      query: { projectId: `proj-1` },
    })

    const middleware = projectAccessGuard()
    middleware(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith()
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it(`should match projectId from body when not in params or query`, () => {
    const req = buildMockReq({
      headers: { 'X-User-Id': `user-1`, 'X-User-Project-Id': `proj-1` },
      params: {},
      query: {},
      body: { projectId: `proj-1` },
    })

    const middleware = projectAccessGuard()
    middleware(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith()
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it(`should reject when target projectId differs from API key projectId`, () => {
    const req = buildMockReq({
      headers: { 'X-User-Id': `user-1`, 'X-User-Project-Id': `proj-1` },
      params: { projectId: `proj-999` },
    })

    const middleware = projectAccessGuard()
    middleware(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockStatus).toHaveBeenCalledWith(403)
    expect(mockJson).toHaveBeenCalledWith({
      error: `API key does not have access to this project`,
    })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should call next(error) when header parsing throws`, () => {
    const req = buildMockReq({
      header: () => {
        throw new Error(`Malformed header`)
      },
    })

    const middleware = projectAccessGuard()
    middleware(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it(`should log warning when project-scoped key accesses org-level resources`, async () => {
    const { logger } = await import(`@TBE/utils/logger`)
    const req = buildMockReq({
      headers: { 'X-User-Id': `user-1`, 'X-User-Project-Id': `proj-1` },
      params: {},
      query: {},
      body: {},
      path: `/orgs/org-1`,
      method: `GET`,
    })

    const middleware = projectAccessGuard()
    middleware(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockStatus).toHaveBeenCalledWith(403)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Project-scoped key blocked from org-level resource`,
      })
    )
  })

  it(`should log warning when project-scoped key accesses different project`, async () => {
    const { logger } = await import(`@TBE/utils/logger`)
    const req = buildMockReq({
      headers: { 'X-User-Id': `user-1`, 'X-User-Project-Id': `proj-1` },
      params: { projectId: `proj-999` },
      path: `/projects/proj-999`,
      method: `GET`,
    })

    const middleware = projectAccessGuard()
    middleware(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockStatus).toHaveBeenCalledWith(403)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Project-scoped key blocked from different project`,
      })
    )
  })

  it(`should reject project-scoped key accessing org-level resources`, () => {
    const req = buildMockReq({
      headers: { 'X-User-Id': `user-1`, 'X-User-Project-Id': `proj-1` },
      params: {},
      query: {},
      body: {},
    })

    const middleware = projectAccessGuard()
    middleware(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockStatus).toHaveBeenCalledWith(403)
    expect(mockJson).toHaveBeenCalledWith({
      error: `Project-scoped API key cannot access org-level resources`,
    })
    expect(mockNext).not.toHaveBeenCalled()
  })
})
