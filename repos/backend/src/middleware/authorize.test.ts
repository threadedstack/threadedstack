import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TRequest, TResponse } from '@TBE/types'
import type { NextFunction } from 'express'
import { ERoleType, EPermAction, EPermResource } from '@tdsk/domain'

import { authorize } from './authorize'

describe(`authorize middleware`, () => {
  let mockNext: ReturnType<typeof vi.fn>
  let mockRes: Partial<TResponse>

  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      user: { id: `test-user-id`, email: `test@example.com` },
      app: {
        locals: {
          db: {
            services: {
              role: {
                getOrgRole: vi
                  .fn()
                  .mockResolvedValue({ data: { type: ERoleType.admin } }),
                getProjectRole: vi
                  .fn()
                  .mockResolvedValue({ data: { type: ERoleType.admin } }),
              },
              permissionOverride: {
                getForUser: vi.fn().mockResolvedValue({ data: [] }),
              },
            },
          },
        },
      },
      params: {},
      query: {},
      body: {},
      header: vi.fn().mockReturnValue(undefined),
      ...overrides,
    } as unknown as TRequest
  }

  beforeEach(() => {
    mockNext = vi.fn()
    mockRes = {} as Partial<TResponse>
    vi.clearAllMocks()
  })

  describe(`authorize()`, () => {
    it(`should use params.orgId and ignore body.orgId`, async () => {
      const req = buildMockReq({
        params: { orgId: `org-from-params` },
        body: { orgId: `evil-org-id` },
        query: {},
      })

      const middleware = authorize(EPermAction.read, EPermResource.org)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      expect(mockGetOrgRole).toHaveBeenCalledWith(`test-user-id`, `org-from-params`)
      expect(mockNext).toHaveBeenCalledWith()
    })

    it(`should use query.orgId when no params.orgId`, async () => {
      const req = buildMockReq({
        params: {},
        body: { orgId: `evil-org-id` },
        query: { orgId: `org-from-query` },
      })

      const middleware = authorize(EPermAction.read, EPermResource.org)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      expect(mockGetOrgRole).toHaveBeenCalledWith(`test-user-id`, `org-from-query`)
      expect(mockNext).toHaveBeenCalledWith()
    })

    it(`should NOT use body.orgId (body is untrusted)`, async () => {
      const req = buildMockReq({
        params: {},
        body: { orgId: `evil-org-id` },
        query: {},
      })

      const middleware = authorize(EPermAction.read, EPermResource.org)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      // Body is not used for orgId -- permission check fails without valid orgId
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    })

    it(`should pass error to next on permission failure`, async () => {
      const req = buildMockReq({
        params: { orgId: `org-1` },
      })
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })

      const middleware = authorize(EPermAction.delete, EPermResource.org)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    })

    it(`should extract projectId from params, query, or body`, async () => {
      const req = buildMockReq({
        params: { projectId: `proj-from-params` },
        body: {},
        query: {},
      })

      const middleware = authorize(EPermAction.read, EPermResource.project)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      const mockGetProjectRole = req.app.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>
      expect(mockGetProjectRole).toHaveBeenCalledWith(`test-user-id`, `proj-from-params`)
      expect(mockNext).toHaveBeenCalledWith()
    })

    it(`should call next with 403 error when getUserRole returns null (non-member)`, async () => {
      const req = buildMockReq({
        params: { orgId: `org-1` },
      })
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      mockGetOrgRole.mockResolvedValue({ data: null })

      const middleware = authorize(EPermAction.read, EPermResource.org)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
      const error = mockNext.mock.calls[0][0]
      expect(error.status).toBe(403)
    })

    it(`should call next with 401 error when req.user is undefined`, async () => {
      const req = buildMockReq({
        user: undefined,
        params: { orgId: `org-1` },
      })

      const middleware = authorize(EPermAction.read, EPermResource.org)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
      const error = mockNext.mock.calls[0][0]
      // resolveEffectivePermissions throws 401 for no userId (authentication failure)
      expect(error.status).toBe(401)
    })

    it(`should call next with 401 error when req.user.id is missing`, async () => {
      const req = buildMockReq({
        user: { email: `test@example.com` },
        params: { orgId: `org-1` },
      })

      const middleware = authorize(EPermAction.read, EPermResource.org)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
      const error = mockNext.mock.calls[0][0]
      // resolveEffectivePermissions throws 401 for no userId (authentication failure)
      expect(error.status).toBe(401)
    })

    it(`should use orgId from auth headers when present`, async () => {
      const req = buildMockReq({
        params: {},
        query: {},
        body: {},
        header: vi.fn().mockImplementation((key: string) => {
          if (key === `X-User-Org-Id`) return `org-from-auth-header`
          return undefined
        }),
      })

      const middleware = authorize(EPermAction.read, EPermResource.org)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      expect(mockGetOrgRole).toHaveBeenCalledWith(`test-user-id`, `org-from-auth-header`)
      expect(mockNext).toHaveBeenCalledWith()
    })

    it(`should NOT use orgId from body even when no params, query, or auth header`, async () => {
      const req = buildMockReq({
        params: {},
        query: {},
        body: { orgId: `evil-org-id` },
        header: vi.fn().mockReturnValue(undefined),
      })

      const middleware = authorize(EPermAction.read, EPermResource.org)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      // Body is untrusted -- no valid orgId available, permission check fails
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    })

    it(`should NOT use projectId from body (body is untrusted)`, async () => {
      const req = buildMockReq({
        params: { orgId: `org-1` },
        query: {},
        body: { projectId: `evil-proj-id` },
      })

      const middleware = authorize(EPermAction.read, EPermResource.project)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      // Body is untrusted -- projectId from body is ignored, org-level check passes
      expect(mockNext).toHaveBeenCalledWith()
      const mockGetProjectRole = req.app.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>
      // getProjectRole should NOT have been called with the body value
      expect(mockGetProjectRole).not.toHaveBeenCalledWith(`test-user-id`, `evil-proj-id`)
    })

    it(`should use params.orgId over auth header orgId (URL is canonical)`, async () => {
      const req = buildMockReq({
        params: { orgId: `org-from-url` },
        query: {},
        body: {},
        header: vi.fn().mockImplementation((key: string) => {
          if (key === `X-User-Org-Id`) return `org-from-auth-header`
          return undefined
        }),
      })

      const middleware = authorize(EPermAction.read, EPermResource.org)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      // The role lookup must run against the URL's orgId, not the header's.
      // Pre-v2 the header was preferred, which let an orgA-bound key probe
      // orgB resources by URL while permissions resolved in orgA.
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      expect(mockGetOrgRole).toHaveBeenCalledWith(`test-user-id`, `org-from-url`)
      expect(mockNext).toHaveBeenCalledWith()
    })

    it(`should use query.orgId over auth header orgId when no params.orgId`, async () => {
      const req = buildMockReq({
        params: {},
        query: { orgId: `org-from-query` },
        body: {},
        header: vi.fn().mockImplementation((key: string) => {
          if (key === `X-User-Org-Id`) return `org-from-auth-header`
          return undefined
        }),
      })

      const middleware = authorize(EPermAction.read, EPermResource.org)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      expect(mockGetOrgRole).toHaveBeenCalledWith(`test-user-id`, `org-from-query`)
      expect(mockNext).toHaveBeenCalledWith()
    })

    it(`should use params.projectId over auth header projectId`, async () => {
      const req = buildMockReq({
        params: { orgId: `org-1`, projectId: `proj-from-url` },
        query: {},
        body: {},
        header: vi.fn().mockImplementation((key: string) => {
          if (key === `X-User-Project-Id`) return `proj-from-auth-header`
          return undefined
        }),
      })

      const middleware = authorize(EPermAction.read, EPermResource.agent)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      const mockGetProjectRole = req.app.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>
      expect(mockGetProjectRole).toHaveBeenCalledWith(`test-user-id`, `proj-from-url`)
      expect(mockNext).toHaveBeenCalledWith()
    })
  })
})
