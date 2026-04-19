import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TRequest } from '@TBE/types'
import { ERoleType, EPermAction, EPermResource } from '@tdsk/domain'

import { getUserRole, checkPermission } from './checkPermission'

describe(`checkPermission`, () => {
  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      user: { id: `test-user-id`, email: `test@example.com` },
      app: {
        locals: {
          db: {
            services: {
              role: {
                getOrgRole: vi.fn().mockResolvedValue({ data: null }),
                getProjectRole: vi.fn().mockResolvedValue({ data: null }),
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
    vi.clearAllMocks()
  })

  describe(`getUserRole`, () => {
    it(`should return null when no userId`, async () => {
      const req = buildMockReq({ user: {} })
      const role = await getUserRole(req, {})
      expect(role).toBeNull()
    })

    it(`should return null when user is undefined`, async () => {
      const req = buildMockReq({ user: undefined })
      const role = await getUserRole(req, {})
      expect(role).toBeNull()
    })

    it(`should return role from DB org role lookup`, async () => {
      const req = buildMockReq()
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })

      const role = await getUserRole(req, { orgId: `org-1` })
      expect(role).toBe(ERoleType.admin)
      expect(mockGetOrgRole).toHaveBeenCalledWith(`test-user-id`, `org-1`)
    })

    it(`should return role from DB project role lookup`, async () => {
      const req = buildMockReq()
      const mockGetProjectRole = req.app.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>
      mockGetProjectRole.mockResolvedValue({ data: { type: ERoleType.member } })

      const role = await getUserRole(req, { projectId: `project-1` })
      expect(role).toBe(ERoleType.member)
      expect(mockGetProjectRole).toHaveBeenCalledWith(`test-user-id`, `project-1`)
    })

    it(`should return highest role when both org and project roles exist`, async () => {
      const req = buildMockReq()
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      const mockGetProjectRole = req.app.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })
      mockGetProjectRole.mockResolvedValue({ data: { type: ERoleType.admin } })

      const role = await getUserRole(req, { orgId: `org-1`, projectId: `project-1` })
      expect(role).toBe(ERoleType.admin)
    })

    it(`should NOT grant super role from JWT user.role === admin (backdoor removed)`, async () => {
      const req = buildMockReq({
        user: { id: `admin-user`, email: `admin@example.com`, role: ERoleType.admin },
      })

      const role = await getUserRole(req, { orgId: `org-1` })
      expect(role).toBeNull()
    })

    it(`should return null when no roles found in DB`, async () => {
      const req = buildMockReq()
      const role = await getUserRole(req, { orgId: `org-1` })
      expect(role).toBeNull()
    })
  })

  describe(`checkPermission`, () => {
    it(`should allow super admin from DB role`, async () => {
      const req = buildMockReq()
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.super } })

      await expect(
        checkPermission(req, EPermAction.delete, EPermResource.org, { orgId: `org-1` })
      ).resolves.toBeUndefined()
    })

    it(`should throw 403 for insufficient role`, async () => {
      const req = buildMockReq()
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.viewer } })

      await expect(
        checkPermission(req, EPermAction.delete, EPermResource.org, { orgId: `org-1` })
      ).rejects.toThrow()

      try {
        await checkPermission(req, EPermAction.delete, EPermResource.org, {
          orgId: `org-1`,
        })
      } catch (err: any) {
        expect(err.status).toBe(403)
      }
    })

    it(`should allow member to read orgs`, async () => {
      const req = buildMockReq()
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })

      await expect(
        checkPermission(req, EPermAction.read, EPermResource.org, { orgId: `org-1` })
      ).resolves.toBeUndefined()
    })

    it(`should throw 403 for null role (non-member)`, async () => {
      const req = buildMockReq({ user: {} })

      try {
        await checkPermission(req, EPermAction.read, EPermResource.org, {
          orgId: `org-1`,
        })
        expect.unreachable(`Should have thrown`)
      } catch (err: any) {
        expect(err.status).toBe(403)
      }
    })

    it(`should allow member to exec sandbox`, async () => {
      const req = buildMockReq()
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })

      await expect(
        checkPermission(req, EPermAction.exec, EPermResource.sandbox, { orgId: `org-1` })
      ).resolves.toBeUndefined()
    })

    it(`should throw 403 when viewer tries to exec sandbox`, async () => {
      const req = buildMockReq()
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.viewer } })

      try {
        await checkPermission(req, EPermAction.exec, EPermResource.sandbox, {
          orgId: `org-1`,
        })
        expect.unreachable(`Should have thrown`)
      } catch (err: any) {
        expect(err.status).toBe(403)
      }
    })

    it(`should allow admin to manage org`, async () => {
      const req = buildMockReq()
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })

      await expect(
        checkPermission(req, EPermAction.manage, EPermResource.org, { orgId: `org-1` })
      ).resolves.toBeUndefined()
    })

    it(`should throw 403 when member tries to manage org`, async () => {
      const req = buildMockReq()
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })

      try {
        await checkPermission(req, EPermAction.manage, EPermResource.org, {
          orgId: `org-1`,
        })
        expect.unreachable(`Should have thrown`)
      } catch (err: any) {
        expect(err.status).toBe(403)
      }
    })
  })

  describe(`getUserRole with undefined req.user`, () => {
    it(`should return null when req.user is undefined entirely`, async () => {
      const req = buildMockReq({ user: undefined })
      const role = await getUserRole(req, { orgId: `org-1` })
      expect(role).toBeNull()
    })
  })
})
