import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TRequest } from '@TBE/types'
import { ERoleType, EPermAction, EPermResource } from '@tdsk/domain'

import {
  getUserRole,
  checkPermission,
  requireOrgMember,
  requireProjectMember,
  requireMinRole,
} from './checkPermission'

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
                isOrgMember: vi.fn().mockResolvedValue({ data: false }),
                isProjectMember: vi.fn().mockResolvedValue({ data: false }),
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
    it(`should return viewer when no userId`, async () => {
      const req = buildMockReq({ user: {} })
      const role = await getUserRole(req, {})
      expect(role).toBe(ERoleType.viewer)
    })

    it(`should return viewer when user is undefined`, async () => {
      const req = buildMockReq({ user: undefined })
      const role = await getUserRole(req, {})
      expect(role).toBe(ERoleType.viewer)
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
      // Without isNeonAdmin, the role comes from DB, which returns null/viewer
      expect(role).toBe(ERoleType.viewer)
    })

    it(`should return viewer when no roles found in DB`, async () => {
      const req = buildMockReq()
      const role = await getUserRole(req, { orgId: `org-1` })
      expect(role).toBe(ERoleType.viewer)
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
  })

  describe(`requireOrgMember`, () => {
    it(`should throw 401 when no userId`, async () => {
      const req = buildMockReq({ user: {} })

      try {
        await requireOrgMember(req, `org-1`)
        expect.unreachable(`Should have thrown`)
      } catch (err: any) {
        expect(err.status).toBe(401)
      }
    })

    it(`should throw 403 when not a member`, async () => {
      const req = buildMockReq()
      const mockIsOrgMember = req.app.locals.db.services.role.isOrgMember as ReturnType<
        typeof vi.fn
      >
      mockIsOrgMember.mockResolvedValue({ data: false })

      try {
        await requireOrgMember(req, `org-1`)
        expect.unreachable(`Should have thrown`)
      } catch (err: any) {
        expect(err.status).toBe(403)
      }
    })

    it(`should pass when user is a member`, async () => {
      const req = buildMockReq()
      const mockIsOrgMember = req.app.locals.db.services.role.isOrgMember as ReturnType<
        typeof vi.fn
      >
      mockIsOrgMember.mockResolvedValue({ data: true })

      await expect(requireOrgMember(req, `org-1`)).resolves.toBeUndefined()
    })

    it(`should NOT auto-pass for JWT admin users (backdoor removed)`, async () => {
      const req = buildMockReq({
        user: { id: `admin-user`, email: `admin@example.com`, role: ERoleType.admin },
      })
      const mockIsOrgMember = req.app.locals.db.services.role.isOrgMember as ReturnType<
        typeof vi.fn
      >
      mockIsOrgMember.mockResolvedValue({ data: false })

      try {
        await requireOrgMember(req, `org-1`)
        expect.unreachable(`Should have thrown - admin backdoor should be removed`)
      } catch (err: any) {
        expect(err.status).toBe(403)
      }
    })
  })

  describe(`requireProjectMember`, () => {
    it(`should throw 401 when no userId`, async () => {
      const req = buildMockReq({ user: {} })

      try {
        await requireProjectMember(req, `project-1`)
        expect.unreachable(`Should have thrown`)
      } catch (err: any) {
        expect(err.status).toBe(401)
      }
    })

    it(`should throw 403 when not a member`, async () => {
      const req = buildMockReq()
      const mockIsProjectMember = req.app.locals.db.services.role
        .isProjectMember as ReturnType<typeof vi.fn>
      mockIsProjectMember.mockResolvedValue({ data: false })

      try {
        await requireProjectMember(req, `project-1`)
        expect.unreachable(`Should have thrown`)
      } catch (err: any) {
        expect(err.status).toBe(403)
      }
    })

    it(`should pass when user is a member`, async () => {
      const req = buildMockReq()
      const mockIsProjectMember = req.app.locals.db.services.role
        .isProjectMember as ReturnType<typeof vi.fn>
      mockIsProjectMember.mockResolvedValue({ data: true })

      await expect(requireProjectMember(req, `project-1`)).resolves.toBeUndefined()
    })

    it(`should NOT auto-pass for JWT admin users (backdoor removed)`, async () => {
      const req = buildMockReq({
        user: { id: `admin-user`, email: `admin@example.com`, role: ERoleType.admin },
      })
      const mockIsProjectMember = req.app.locals.db.services.role
        .isProjectMember as ReturnType<typeof vi.fn>
      mockIsProjectMember.mockResolvedValue({ data: false })

      try {
        await requireProjectMember(req, `project-1`)
        expect.unreachable(`Should have thrown - admin backdoor should be removed`)
      } catch (err: any) {
        expect(err.status).toBe(403)
      }
    })
  })

  describe(`requireMinRole`, () => {
    it(`should pass when user has sufficient role`, async () => {
      const req = buildMockReq()
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })

      await expect(
        requireMinRole(req, ERoleType.member, { orgId: `org-1` })
      ).resolves.toBeUndefined()
    })

    it(`should throw 403 when user has insufficient role`, async () => {
      const req = buildMockReq()
      const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
        typeof vi.fn
      >
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.viewer } })

      try {
        await requireMinRole(req, ERoleType.admin, { orgId: `org-1` })
        expect.unreachable(`Should have thrown`)
      } catch (err: any) {
        expect(err.status).toBe(403)
      }
    })
  })
})
