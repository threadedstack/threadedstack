import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TRequest, TResponse } from '@TBE/types'
import type { NextFunction } from 'express'
import { ERoleType, EPermAction, EPermResource } from '@tdsk/domain'

import { authorize, requireOrg, requireProject, requireRole } from './authorize'

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
                isOrgMember: vi.fn().mockResolvedValue({ data: true }),
                isProjectMember: vi.fn().mockResolvedValue({ data: true }),
              },
            },
          },
        },
      },
      params: {},
      query: {},
      body: {},
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

    it(`should NOT use body.orgId even when params and query are empty`, async () => {
      const req = buildMockReq({
        params: {},
        body: { orgId: `evil-org-id` },
        query: {},
      })

      const middleware = authorize(EPermAction.read, EPermResource.org)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      // orgId should be undefined/falsy, not 'evil-org-id'
      if (mockGetOrgRole.mock.calls.length > 0) {
        expect(mockGetOrgRole.mock.calls[0][1]).not.toBe(`evil-org-id`)
      }
    })

    it(`should pass error to next on permission failure`, async () => {
      const req = buildMockReq({
        params: { orgId: `org-1` },
      })
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.viewer } })

      const middleware = authorize(EPermAction.delete, EPermResource.org)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  describe(`requireOrg()`, () => {
    it(`should use params.orgId and ignore body.orgId`, async () => {
      const req = buildMockReq({
        params: { orgId: `org-from-params` },
        body: { orgId: `evil-org-id` },
      })

      const middleware = requireOrg()
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      const mockIsOrgMember = req.app.locals.db.services.role.isOrgMember as ReturnType<
        typeof vi.fn
      >
      expect(mockIsOrgMember).toHaveBeenCalledWith(`test-user-id`, `org-from-params`)
      expect(mockNext).toHaveBeenCalledWith()
    })

    it(`should NOT use body.orgId when params are empty`, async () => {
      const req = buildMockReq({
        params: {},
        body: { orgId: `evil-org-id` },
        query: {},
      })

      const middleware = requireOrg()
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      // Should error because no orgId found (body is ignored)
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    })

    it(`should use params.id as fallback`, async () => {
      const req = buildMockReq({
        params: { id: `org-from-id` },
        body: { orgId: `evil-org-id` },
      })

      const middleware = requireOrg()
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      const mockIsOrgMember = req.app.locals.db.services.role.isOrgMember as ReturnType<
        typeof vi.fn
      >
      expect(mockIsOrgMember).toHaveBeenCalledWith(`test-user-id`, `org-from-id`)
    })
  })

  describe(`requireProject()`, () => {
    it(`should use params.projectId and ignore body.projectId`, async () => {
      const req = buildMockReq({
        params: { projectId: `proj-from-params` },
        body: { projectId: `evil-project-id` },
      })

      const middleware = requireProject()
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      const mockIsProjectMember = req.app.locals.db.services.role
        .isProjectMember as ReturnType<typeof vi.fn>
      expect(mockIsProjectMember).toHaveBeenCalledWith(`test-user-id`, `proj-from-params`)
      expect(mockNext).toHaveBeenCalledWith()
    })

    it(`should NOT use body.projectId when params are empty`, async () => {
      const req = buildMockReq({
        params: {},
        body: { projectId: `evil-project-id` },
        query: {},
      })

      const middleware = requireProject()
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      // Should error because no projectId found (body is ignored)
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    })

    it(`should use params.id as fallback`, async () => {
      const req = buildMockReq({
        params: { id: `proj-from-id` },
        body: { projectId: `evil-project-id` },
      })

      const middleware = requireProject()
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      const mockIsProjectMember = req.app.locals.db.services.role
        .isProjectMember as ReturnType<typeof vi.fn>
      expect(mockIsProjectMember).toHaveBeenCalledWith(`test-user-id`, `proj-from-id`)
    })
  })

  describe(`requireRole()`, () => {
    it(`should use params and ignore body for context`, async () => {
      const req = buildMockReq({
        params: { orgId: `org-from-params` },
        body: { orgId: `evil-org-id` },
      })

      const middleware = requireRole(ERoleType.admin)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      expect(mockGetOrgRole).toHaveBeenCalledWith(`test-user-id`, `org-from-params`)
      expect(mockNext).toHaveBeenCalledWith()
    })

    it(`should pass error to next when role is insufficient`, async () => {
      const req = buildMockReq({
        params: { orgId: `org-1` },
      })
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.viewer } })

      const middleware = requireRole(ERoleType.admin)
      await middleware(req, mockRes as TResponse, mockNext as NextFunction)

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    })
  })
})
