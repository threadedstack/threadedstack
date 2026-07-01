import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TRequest, TResponse } from '@TBE/types'
import { Exception } from '@tdsk/domain'

vi.mock(`@TBE/utils/auth/requireProjectAccess`, () => ({
  requireProjectAccess: vi.fn(),
}))

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { requireProjectAccess } from '@TBE/utils/auth/requireProjectAccess'
import { logger } from '@TBE/utils/logger'
import { projectMemberGuard } from './projectMemberGuard'

const mockRequireProjectAccess = requireProjectAccess as ReturnType<typeof vi.fn>
const mockLoggerWarn = logger.warn as ReturnType<typeof vi.fn>
const mockLoggerError = logger.error as ReturnType<typeof vi.fn>

describe(`projectMemberGuard`, () => {
  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      user: { id: `test-user-id`, email: `test@example.com` },
      app: {
        locals: {
          db: {
            services: {},
          },
        },
      },
      params: {},
      query: {},
      body: {},
      path: `/test/path`,
      method: `GET`,
      ...overrides,
    } as unknown as TRequest
  }

  const buildMockRes = () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as TResponse
    return res
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should return 400 when projectId is missing`, async () => {
    const req = buildMockReq({ params: { orgId: `org-1` } })
    const res = buildMockRes()
    const next = vi.fn()

    const middleware = projectMemberGuard()
    await middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(mockRequireProjectAccess).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: `projectMemberGuard requires :orgId and :projectId in URL`,
    })
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `projectMemberGuard requires :orgId and :projectId in URL`,
      })
    )
  })

  it(`should return 400 when orgId is missing`, async () => {
    const req = buildMockReq({ params: { projectId: `project-1` } })
    const res = buildMockRes()
    const next = vi.fn()

    const middleware = projectMemberGuard()
    await middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(mockRequireProjectAccess).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `projectMemberGuard requires :orgId and :projectId in URL`,
      })
    )
  })

  it(`should return 400 when both projectId and orgId are missing`, async () => {
    const req = buildMockReq({ params: {} })
    const res = buildMockRes()
    const next = vi.fn()

    const middleware = projectMemberGuard()
    await middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(mockRequireProjectAccess).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `projectMemberGuard requires :orgId and :projectId in URL`,
      })
    )
  })

  it(`should call requireProjectAccess and next when access is allowed`, async () => {
    const req = buildMockReq({
      params: { projectId: `project-1`, orgId: `org-1` },
    })
    const res = buildMockRes()
    const next = vi.fn()

    mockRequireProjectAccess.mockResolvedValue(undefined)

    const middleware = projectMemberGuard()
    await middleware(req, res, next)

    expect(mockRequireProjectAccess).toHaveBeenCalledWith(req, `project-1`, `org-1`)
    expect(next).toHaveBeenCalled()
  })

  it(`should return 403 JSON when requireProjectAccess throws 403`, async () => {
    const req = buildMockReq({
      params: { projectId: `project-1`, orgId: `org-1` },
    })
    const res = buildMockRes()
    const next = vi.fn()

    mockRequireProjectAccess.mockRejectedValue(
      new Exception(
        403,
        `Access denied: you are not a member of this project`,
        `FORBIDDEN`
      )
    )

    const middleware = projectMemberGuard()
    await middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      error: `Access denied: you are not a member of this project`,
    })
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `projectMemberGuard denied`,
        status: 403,
      })
    )
  })

  it(`should return 401 JSON when requireProjectAccess throws 401`, async () => {
    const req = buildMockReq({
      params: { projectId: `project-1`, orgId: `org-1` },
    })
    const res = buildMockRes()
    const next = vi.fn()

    mockRequireProjectAccess.mockRejectedValue(
      new Exception(401, `Authentication required`, `UNAUTHORIZED`)
    )

    const middleware = projectMemberGuard()
    await middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      error: `Authentication required`,
    })
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `projectMemberGuard denied`,
        status: 401,
      })
    )
  })

  it(`should return 500 JSON and log error when requireProjectAccess throws 500`, async () => {
    const req = buildMockReq({
      params: { projectId: `project-1`, orgId: `org-1` },
      path: `/orgs/org-1/projects/project-1`,
      method: `GET`,
    })
    const res = buildMockRes()
    const next = vi.fn()

    mockRequireProjectAccess.mockRejectedValue(
      new Exception(500, `Failed to check project membership`)
    )

    const middleware = projectMemberGuard()
    await middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: `Failed to check project membership`,
    })
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `projectMemberGuard denied`,
        error: `Failed to check project membership`,
        status: 500,
      })
    )
  })

  it(`should default to 500 when error is not an Exception and has no status`, async () => {
    const req = buildMockReq({
      params: { projectId: `project-1`, orgId: `org-1` },
    })
    const res = buildMockRes()
    const next = vi.fn()

    mockRequireProjectAccess.mockRejectedValue(new Error(`Something went wrong`))

    const middleware = projectMemberGuard()
    await middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: `Something went wrong`,
    })
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `projectMemberGuard error`,
        status: 500,
      })
    )
  })

  it(`should pass correct projectId and orgId to requireProjectAccess`, async () => {
    const req = buildMockReq({
      params: { projectId: `my-project-xyz`, orgId: `my-org-abc` },
    })
    const res = buildMockRes()
    const next = vi.fn()

    mockRequireProjectAccess.mockResolvedValue(undefined)

    const middleware = projectMemberGuard()
    await middleware(req, res, next)

    expect(mockRequireProjectAccess).toHaveBeenCalledWith(
      req,
      `my-project-xyz`,
      `my-org-abc`
    )
    expect(next).toHaveBeenCalled()
  })
})
