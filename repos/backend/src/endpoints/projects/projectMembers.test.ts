import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ERoleType, ESubscriptionTier } from '@tdsk/domain'
import { config } from '@TBE/configs/backend.config'
import { addProjectMember } from './addProjectMember'
import { PaymentsService } from '@TBE/services/payments'
import { listProjectMembers } from './listProjectMembers'
import { removeProjectMember } from './removeProjectMember'
import { updateProjectMemberRole } from './updateProjectMemberRole'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock(`@TDB/configs/db.config`, () => ({
  config: {
    logger: { label: `db`, level: `error` },
  },
}))

describe(`Project Members endpoints`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const buildApp = () => {
    return {
      locals: {
        config,
        payments: new PaymentsService(config.payments),
        email: {
          invitation: vi.fn().mockResolvedValue(true),
          sendMemberNotification: vi.fn().mockResolvedValue(true),
        },
        db: {
          services: {
            project: {
              get: vi.fn(),
            },
            role: {
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.admin } }),
              getProjectRole: vi
                .fn()
                .mockResolvedValue({ data: { type: ERoleType.admin } }),
              getProjectMembers: vi.fn(),
              getOrgMembers: vi.fn().mockResolvedValue({ data: [] }),
              isOrgMember: vi.fn().mockResolvedValue({ data: true }),
              isProjectMember: vi.fn().mockResolvedValue({ data: false }),
              create: vi.fn(),
              removeFromProject: vi.fn(),
              updateProjectRole: vi.fn(),
            },
            permissionOverride: {
              deleteForUser: vi.fn().mockResolvedValue({ data: 0 }),
              getForUser: vi.fn().mockResolvedValue({ data: [] }),
            },
            user: {
              byEmail: vi.fn().mockResolvedValue({ data: null }),
            },
            org: {
              get: vi.fn(),
            },
            subscription: {
              findByUser: vi.fn().mockResolvedValue({ data: null }),
            },
            invitation: {
              getByEmailAndOrg: vi.fn().mockResolvedValue({ data: null }),
              create: vi.fn(),
            },
          },
        },
      },
    } as unknown as TApp
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response)

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: buildApp(),
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
      } as any,
      params: { orgId: `org-1`, projectId: `project-1` },
      body: {},
      query: {},
    }
  })

  // ========== listProjectMembers ==========
  describe(`GET /:projectId/members - List project members`, () => {
    it(`should have correct endpoint configuration`, () => {
      expect(listProjectMembers.path).toBe(`/`)
      expect(listProjectMembers.method).toBe(`get`)
      expect(typeof listProjectMembers.action).toBe(`function`)
    })

    it(`should return 200 with members list`, async () => {
      const mockMembers = [
        {
          id: `role-1`,
          userId: `user-1`,
          projectId: `project-1`,
          type: ERoleType.admin,
          user: { id: `user-1`, email: `admin@test.com`, name: `Admin User` },
        },
        {
          id: `role-2`,
          userId: `user-2`,
          projectId: `project-1`,
          type: ERoleType.member,
          user: { id: `user-2`, email: `member@test.com`, name: `Member User` },
        },
      ]

      const mockGetProjectMembers = mockReq.app?.locals.db.services.role
        .getProjectMembers as ReturnType<typeof vi.fn>
      mockGetProjectMembers.mockResolvedValue({ data: mockMembers })

      await listProjectMembers.action(mockReq as TRequest, mockRes as Response)

      expect(mockGetProjectMembers).toHaveBeenCalledWith(`project-1`, {
        limit: 50,
        offset: 0,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockMembers, limit: 50, offset: 0 })
    })

    it(`should return 200 with empty array when no members`, async () => {
      const mockGetProjectMembers = mockReq.app?.locals.db.services.role
        .getProjectMembers as ReturnType<typeof vi.fn>
      mockGetProjectMembers.mockResolvedValue({ data: [] })

      await listProjectMembers.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: [], limit: 50, offset: 0 })
    })

    it(`should pass pagination params to DB and include in response`, async () => {
      const mockGetProjectMembers = mockReq.app?.locals.db.services.role
        .getProjectMembers as ReturnType<typeof vi.fn>
      mockGetProjectMembers.mockResolvedValue({ data: [] })
      mockReq.query = { limit: `10`, offset: `20` }

      await listProjectMembers.action(mockReq as TRequest, mockRes as Response)

      expect(mockGetProjectMembers).toHaveBeenCalledWith(`project-1`, {
        limit: 10,
        offset: 20,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      const response = mockJson.mock.calls[0][0]
      expect(response.limit).toBe(10)
      expect(response.offset).toBe(20)
    })

    it(`should throw 500 when database query fails`, async () => {
      const mockGetProjectMembers = mockReq.app?.locals.db.services.role
        .getProjectMembers as ReturnType<typeof vi.fn>
      mockGetProjectMembers.mockResolvedValue({ error: new Error(`Database error`) })

      await expect(
        listProjectMembers.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Database error`)
    })
  })

  // ========== addProjectMember ==========
  describe(`POST /:projectId/members - Add project member`, () => {
    it(`should have correct endpoint configuration`, () => {
      expect(addProjectMember.path).toBe(`/`)
      expect(addProjectMember.method).toBe(`post`)
      expect(typeof addProjectMember.action).toBe(`function`)
    })

    it(`should return 201 with created role`, async () => {
      const mockRole = {
        id: `role-new`,
        userId: `user-2`,
        projectId: `project-1`,
        type: ERoleType.member,
      }

      mockReq.body = { userId: `user-2`, roleType: ERoleType.member }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockIsProjectMember = mockReq.app?.locals.db.services.role
        .isProjectMember as ReturnType<typeof vi.fn>
      const mockGetProject = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      const mockCreate = mockReq.app?.locals.db.services.role.create as ReturnType<
        typeof vi.fn
      >

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockIsProjectMember.mockResolvedValue({ data: false })
      mockGetProject.mockResolvedValue({
        data: { id: `project-1`, name: `Test Project` },
      })
      mockCreate.mockResolvedValue({ data: mockRole })

      await addProjectMember.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledWith({
        projectId: `project-1`,
        userId: `user-2`,
        type: ERoleType.member,
      })
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: mockRole })
    })

    it(`should default to member role when type not provided`, async () => {
      const mockRole = {
        id: `role-new`,
        userId: `user-2`,
        projectId: `project-1`,
        type: ERoleType.member,
      }

      mockReq.body = { userId: `user-2` }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockIsProjectMember = mockReq.app?.locals.db.services.role
        .isProjectMember as ReturnType<typeof vi.fn>
      const mockGetProject = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      const mockCreate = mockReq.app?.locals.db.services.role.create as ReturnType<
        typeof vi.fn
      >

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockIsProjectMember.mockResolvedValue({ data: false })
      mockGetProject.mockResolvedValue({
        data: { id: `project-1`, name: `Test Project` },
      })
      mockCreate.mockResolvedValue({ data: mockRole })

      await addProjectMember.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledWith({
        projectId: `project-1`,
        userId: `user-2`,
        type: ERoleType.member,
      })
    })

    it(`should throw 401 when user is not authenticated`, async () => {
      mockReq.user = undefined
      mockReq.body = { userId: `user-2` }

      await expect(
        addProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Authentication required`)
    })

    it(`should throw 400 when userId and email are both missing`, async () => {
      mockReq.body = {}

      await expect(
        addProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Either userId or email is required`)
    })

    it(`should throw 400 when target user is not an org member`, async () => {
      mockReq.body = { userId: `user-non-org` }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      // isOrgMember is called first by checkPermission's requireOrgMember? No.
      // addProjectMember calls checkPermission then isOrgMember for the target user.
      // checkPermission uses getUserRole which calls getOrgRole+getProjectRole.
      // After that, getUserRole is called again for canManageRole check.
      // Then isOrgMember is called for the target userId.
      mockIsOrgMember.mockResolvedValue({ data: false })

      await expect(
        addProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(
        `User must be an organization member before being added to a project`
      )
    })

    it(`should throw 404 when project does not exist`, async () => {
      mockReq.body = { userId: `user-2` }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockGetProject = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGetProject.mockResolvedValue({ data: undefined })

      await expect(
        addProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Project not found`)
    })

    it(`should throw 403 when trying to add member with role above own`, async () => {
      mockReq.body = { userId: `user-2`, roleType: ERoleType.owner }

      // Current user is admin, trying to assign owner
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>

      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })
      mockGetProjectRole.mockResolvedValue({ data: { type: ERoleType.admin } })

      await expect(
        addProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(
        `You cannot add a member with owner role. You can only add members with roles below your own.`
      )
    })

    it(`should throw 403 when non-admin tries to manage members`, async () => {
      mockReq.body = { userId: `user-2` }

      // Current user is a member -- cannot manage
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>

      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })
      mockGetProjectRole.mockResolvedValue({ data: { type: ERoleType.member } })

      await expect(
        addProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`You cannot add a member with member role`)
    })

    it(`should throw 500 when role creation fails`, async () => {
      mockReq.body = { userId: `user-2` }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockIsProjectMember = mockReq.app?.locals.db.services.role
        .isProjectMember as ReturnType<typeof vi.fn>
      const mockGetProject = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      const mockCreate = mockReq.app?.locals.db.services.role.create as ReturnType<
        typeof vi.fn
      >

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockIsProjectMember.mockResolvedValue({ data: false })
      mockGetProject.mockResolvedValue({
        data: { id: `project-1`, name: `Test Project` },
      })
      mockCreate.mockResolvedValue({ error: new Error(`Unique constraint violation`) })

      await expect(
        addProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Unique constraint violation`)
    })

    it(`should throw 409 when user is already a project member (userId path)`, async () => {
      mockReq.body = { userId: `user-2`, roleType: ERoleType.member }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockIsProjectMember = mockReq.app?.locals.db.services.role
        .isProjectMember as ReturnType<typeof vi.fn>
      const mockGetProject = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockIsProjectMember.mockResolvedValue({ data: true })
      mockGetProject.mockResolvedValue({
        data: { id: `project-1`, name: `Test Project` },
      })

      await expect(
        addProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`User is already a project member`)
    })

    // ---- email invite path: seat capacity enforcement (billing-critical) ----

    it(`should throw 403 when plan does not allow additional seats`, async () => {
      mockReq.body = { email: `new@example.com`, roleType: ERoleType.member }

      const mockGetProject = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>

      mockGetProject.mockResolvedValue({ data: { id: `project-1` } })
      mockGetOrg.mockResolvedValue({
        data: { id: `org-1`, ownerId: `owner-1`, name: `Test Org` },
      })
      // No subscription on record — resolves to the free tier default,
      // which does not allow additional seats.
      mockFindByUser.mockResolvedValue({ data: null })

      await expect(
        addProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(
        `Your plan does not allow inviting additional members. Upgrade to a Pro or Team plan.`
      )
    })

    it(`should throw 403 when the org's seat limit is already reached`, async () => {
      mockReq.body = { email: `new@example.com`, roleType: ERoleType.member }

      const mockGetProject = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      const mockGetOrgMembers = mockReq.app?.locals.db.services.role
        .getOrgMembers as ReturnType<typeof vi.fn>

      mockGetProject.mockResolvedValue({ data: { id: `project-1` } })
      mockGetOrg.mockResolvedValue({
        data: { id: `org-1`, ownerId: `owner-1`, name: `Test Org` },
      })
      mockFindByUser.mockResolvedValue({ data: { tier: ESubscriptionTier.pro } })
      mockGetOrgMembers.mockResolvedValue({
        data: [{ id: `r1` }, { id: `r2` }, { id: `r3` }],
      })

      await expect(
        addProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(
        `Seat limit reached (3/3). Upgrade your plan to add more members.`
      )
    })

    it(`should throw 500 when subscription lookup fails during seat check`, async () => {
      mockReq.body = { email: `new@example.com`, roleType: ERoleType.member }

      const mockGetProject = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>

      mockGetProject.mockResolvedValue({ data: { id: `project-1` } })
      mockGetOrg.mockResolvedValue({
        data: { id: `org-1`, ownerId: `owner-1`, name: `Test Org` },
      })
      mockFindByUser.mockResolvedValue({ error: new Error(`Connection lost`) })

      await expect(
        addProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Failed to verify subscription status: Connection lost`)
    })

    // ---- email invite path: reactivation / invite branches ----

    it(`should reactivate an existing org member added by email`, async () => {
      mockReq.body = { email: `member@example.com`, roleType: ERoleType.member }

      const mockRole = {
        id: `role-new`,
        userId: `user-existing`,
        projectId: `project-1`,
        type: ERoleType.member,
      }

      const svc = mockReq.app?.locals.db.services as any
      svc.project.get.mockResolvedValue({ data: { id: `project-1` } })
      svc.user.byEmail.mockResolvedValue({
        data: { id: `user-existing`, email: `member@example.com` },
      })
      svc.org.get.mockResolvedValue({
        data: { id: `org-1`, ownerId: `owner-1`, name: `Test Org` },
      })
      svc.subscription.findByUser.mockResolvedValue({
        data: { tier: ESubscriptionTier.pro },
      })
      svc.role.getOrgMembers.mockResolvedValue({ data: [{ id: `r1` }] })
      svc.role.isOrgMember.mockResolvedValue({ data: true })
      svc.role.isProjectMember.mockResolvedValue({ data: false })
      svc.role.create.mockResolvedValue({ data: mockRole })

      await addProjectMember.action(mockReq as TRequest, mockRes as Response)

      expect(svc.role.create).toHaveBeenCalledWith({
        projectId: `project-1`,
        userId: `user-existing`,
        type: ERoleType.member,
      })
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: mockRole })
    })

    it(`should invite an existing user who is not yet an org member`, async () => {
      mockReq.body = { email: `outsider@example.com`, roleType: ERoleType.member }

      const newOrgRole = {
        id: `role-org`,
        userId: `user-outsider`,
        type: ERoleType.member,
      }

      const svc = mockReq.app?.locals.db.services as any
      svc.project.get.mockResolvedValue({ data: { id: `project-1` } })
      svc.user.byEmail.mockResolvedValue({
        data: { id: `user-outsider`, email: `outsider@example.com` },
      })
      svc.org.get.mockResolvedValue({
        data: { id: `org-1`, ownerId: `owner-1`, name: `Test Org` },
      })
      svc.subscription.findByUser.mockResolvedValue({
        data: { tier: ESubscriptionTier.pro },
      })
      svc.role.getOrgMembers.mockResolvedValue({ data: [{ id: `r1` }] })
      svc.role.isOrgMember.mockResolvedValue({ data: false })
      // getOrgRole is used both for the current user's permission checks and
      // for InviteService.isMember's target-user lookup — key off userId so
      // both callers get the right answer regardless of call order.
      svc.role.getOrgRole.mockImplementation((userId: string) =>
        Promise.resolve(
          userId === `test-user-id` ? { data: { type: ERoleType.admin } } : { data: null }
        )
      )
      svc.invitation.getByEmailAndOrg.mockResolvedValue({ data: null })
      svc.role.create.mockResolvedValue({ data: newOrgRole })

      await addProjectMember.action(mockReq as TRequest, mockRes as Response)

      expect(svc.role.create).toHaveBeenCalledWith({
        orgId: `org-1`,
        type: ERoleType.member,
        userId: `user-outsider`,
      })
      expect(svc.role.create).toHaveBeenCalledWith({
        projectId: `project-1`,
        userId: `user-outsider`,
        type: ERoleType.member,
      })
      expect(mockStatus).toHaveBeenCalledWith(201)
      const response = mockJson.mock.calls[0][0]
      expect(response.data).toEqual(newOrgRole)
      expect(response.message).toBe(`User added to organization and project`)
    })

    it(`should create a new-user invitation when no account exists for the email`, async () => {
      mockReq.body = { email: `brandnew@example.com`, roleType: ERoleType.member }

      const mockInvite = { id: `inv-1`, email: `brandnew@example.com` }

      const svc = mockReq.app?.locals.db.services as any
      svc.project.get.mockResolvedValue({ data: { id: `project-1` } })
      svc.user.byEmail.mockResolvedValue({ data: null })
      svc.org.get.mockResolvedValue({
        data: { id: `org-1`, ownerId: `owner-1`, name: `Test Org` },
      })
      svc.subscription.findByUser.mockResolvedValue({
        data: { tier: ESubscriptionTier.pro },
      })
      svc.role.getOrgMembers.mockResolvedValue({ data: [{ id: `r1` }] })
      svc.invitation.getByEmailAndOrg.mockResolvedValue({ data: null })
      svc.invitation.create.mockResolvedValue({ data: mockInvite })

      await addProjectMember.action(mockReq as TRequest, mockRes as Response)

      expect(svc.invitation.create).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)
      const response = mockJson.mock.calls[0][0]
      expect(response.data).toEqual(mockInvite)
      expect(response.message).toBe(`Invitation sent to brandnew@example.com`)
    })
  })

  // ========== updateProjectMemberRole ==========
  describe(`PUT /:projectId/members/:userId - Update project member role`, () => {
    it(`should have correct endpoint configuration`, () => {
      expect(updateProjectMemberRole.path).toBe(`/:userId`)
      expect(updateProjectMemberRole.method).toBe(`put`)
      expect(typeof updateProjectMemberRole.action).toBe(`function`)
    })

    it(`should return 200 with updated role`, async () => {
      const updatedRole = {
        id: `role-1`,
        userId: `user-2`,
        projectId: `project-1`,
        type: ERoleType.member,
      }

      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }
      mockReq.body = { roleType: ERoleType.member }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>
      const mockUpdateProjectRole = mockReq.app?.locals.db.services.role
        .updateProjectRole as ReturnType<typeof vi.fn>

      // Call flow (no checkPermission — middleware handles auth):
      // 1. getUserRole -> getOrgRole(currentUser), getProjectRole(currentUser)
      // 2. getProjectRole(targetUser, projectId) -- target user lookup
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })
      mockGetProjectRole
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // getUserRole
        .mockResolvedValueOnce({ data: { type: ERoleType.member } }) // target user lookup

      mockUpdateProjectRole.mockResolvedValue({ data: updatedRole })

      await updateProjectMemberRole.action(mockReq as TRequest, mockRes as Response)

      expect(mockUpdateProjectRole).toHaveBeenCalledWith(
        `user-2`,
        `project-1`,
        ERoleType.member
      )
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: updatedRole })
    })

    it(`should throw 401 when user is not authenticated`, async () => {
      mockReq.user = undefined
      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }
      mockReq.body = { roleType: ERoleType.member }

      await expect(
        updateProjectMemberRole.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Authentication required`)
    })

    it(`should throw 400 when role type is missing`, async () => {
      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }
      mockReq.body = {}

      await expect(
        updateProjectMemberRole.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Role type is required`)
    })

    it(`should throw 403 when trying to assign role above own`, async () => {
      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }
      mockReq.body = { roleType: ERoleType.owner }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>

      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })
      mockGetProjectRole.mockResolvedValue({ data: { type: ERoleType.admin } })

      await expect(
        updateProjectMemberRole.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(
        `You cannot assign owner role. You can only assign roles below your own.`
      )
    })

    it(`should throw 404 when target user is not a project member`, async () => {
      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }
      mockReq.body = { roleType: ERoleType.member }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>

      // Call flow (no checkPermission — middleware handles auth):
      // 1. getUserRole -> getOrgRole, getProjectRole
      // 2. getProjectRole(targetUser) -> null
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })
      mockGetProjectRole
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // getUserRole
        .mockResolvedValueOnce({ data: null }) // target user not found

      await expect(
        updateProjectMemberRole.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Project member not found`)
    })

    it(`should throw 403 when trying to modify member with equal or higher role`, async () => {
      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }
      mockReq.body = { roleType: ERoleType.member }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>

      // Call flow (no checkPermission — middleware handles auth):
      // 1. getUserRole -> getOrgRole, getProjectRole (admin)
      // 2. getProjectRole(target) -> admin (equal role)
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })
      mockGetProjectRole
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // getUserRole
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // target has equal admin role

      await expect(
        updateProjectMemberRole.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(
        `You cannot modify roles of members with equal or higher roles than your own.`
      )
    })

    it(`should throw 403 when non-admin tries to manage roles`, async () => {
      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }
      mockReq.body = { roleType: ERoleType.member }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>

      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })
      mockGetProjectRole.mockResolvedValue({ data: { type: ERoleType.member } })

      await expect(
        updateProjectMemberRole.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`You cannot assign member role`)
    })

    it(`should throw 500 when update fails`, async () => {
      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }
      mockReq.body = { roleType: ERoleType.member }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>
      const mockUpdateProjectRole = mockReq.app?.locals.db.services.role
        .updateProjectRole as ReturnType<typeof vi.fn>

      // Call flow (no checkPermission — middleware handles auth):
      // 1. getUserRole -> getOrgRole, getProjectRole (admin)
      // 2. getProjectRole(target) -> member (can manage)
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })
      mockGetProjectRole
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // getUserRole
        .mockResolvedValueOnce({ data: { type: ERoleType.member } }) // target user lookup

      mockUpdateProjectRole.mockResolvedValue({ error: new Error(`Update failed`) })

      await expect(
        updateProjectMemberRole.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Update failed`)
    })
  })

  // ========== removeProjectMember ==========
  describe(`DELETE /:projectId/members/:userId - Remove project member`, () => {
    it(`should have correct endpoint configuration`, () => {
      expect(removeProjectMember.path).toBe(`/:userId`)
      expect(removeProjectMember.method).toBe(`delete`)
      expect(typeof removeProjectMember.action).toBe(`function`)
    })

    it(`should return 200 with deleted role`, async () => {
      const mockRole = {
        id: `role-1`,
        userId: `user-2`,
        projectId: `project-1`,
        type: ERoleType.member,
      }

      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>
      const mockRemoveFromProject = mockReq.app?.locals.db.services.role
        .removeFromProject as ReturnType<typeof vi.fn>

      // Call flow (no checkPermission — middleware handles auth):
      // 1. getProjectRole(target) -> member role (target user lookup)
      // 2. getUserRole -> getOrgRole, getProjectRole (admin) (for canManageRole check)
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })
      mockGetProjectRole
        .mockResolvedValueOnce({ data: mockRole }) // target user lookup
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // getUserRole for canManageRole

      mockRemoveFromProject.mockResolvedValue({ data: true })

      await removeProjectMember.action(mockReq as TRequest, mockRes as Response)

      expect(mockRemoveFromProject).toHaveBeenCalledWith(`user-2`, `project-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockRole })
    })

    it(`should throw 401 when user is not authenticated`, async () => {
      mockReq.user = undefined
      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }

      await expect(
        removeProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Authentication required`)
    })

    it(`should throw 404 when target user is not a project member`, async () => {
      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>

      // Call flow (no checkPermission — middleware handles auth):
      // 1. getProjectRole(target) -> null (not found)
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })
      mockGetProjectRole.mockResolvedValueOnce({ data: null }) // target user not found

      await expect(
        removeProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Project member not found`)
    })

    it(`should throw 403 when trying to remove an owner`, async () => {
      const mockRole = {
        id: `role-1`,
        userId: `user-2`,
        projectId: `project-1`,
        type: ERoleType.owner,
      }

      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>

      // Call flow (no checkPermission — middleware handles auth):
      // 1. getProjectRole(target) -> owner
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })
      mockGetProjectRole.mockResolvedValueOnce({ data: mockRole }) // target is owner

      await expect(
        removeProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Cannot remove owner from project. Transfer ownership first.`)
    })

    it(`should throw 403 when trying to remove member with equal or higher role`, async () => {
      const mockRole = {
        id: `role-1`,
        userId: `user-2`,
        projectId: `project-1`,
        type: ERoleType.admin,
      }

      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>

      // Call flow (no checkPermission — middleware handles auth):
      // 1. getProjectRole(target) -> admin (equal role)
      // 2. getUserRole -> getOrgRole(admin), getProjectRole(admin)
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })
      mockGetProjectRole
        .mockResolvedValueOnce({ data: mockRole }) // target has admin role
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // getUserRole for canManageRole

      await expect(
        removeProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(
        `You cannot remove members with equal or higher roles than your own.`
      )
    })

    it(`should throw 403 when non-admin tries to remove members`, async () => {
      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>

      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })
      mockGetProjectRole.mockResolvedValue({ data: { type: ERoleType.member } })

      await expect(
        removeProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(
        `You cannot remove members with equal or higher roles than your own`
      )
    })

    it(`should throw 500 when delete fails`, async () => {
      const mockRole = {
        id: `role-1`,
        userId: `user-2`,
        projectId: `project-1`,
        type: ERoleType.member,
      }

      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>
      const mockRemoveFromProject = mockReq.app?.locals.db.services.role
        .removeFromProject as ReturnType<typeof vi.fn>

      // Call flow (no checkPermission — middleware handles auth):
      // 1. getProjectRole(target) -> member
      // 2. getUserRole -> getOrgRole(admin), getProjectRole(admin)
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })
      mockGetProjectRole
        .mockResolvedValueOnce({ data: mockRole }) // target user lookup
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // getUserRole for canManageRole

      mockRemoveFromProject.mockResolvedValue({ error: new Error(`Delete failed`) })

      await expect(
        removeProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Delete failed`)
    })

    it(`should throw 500 when getProjectRole fails for target user`, async () => {
      mockReq.params = { orgId: `org-1`, projectId: `project-1`, userId: `user-2` }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockGetProjectRole = mockReq.app?.locals.db.services.role
        .getProjectRole as ReturnType<typeof vi.fn>

      // Call flow (no checkPermission — middleware handles auth):
      // 1. getProjectRole(target) -> error
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })
      mockGetProjectRole.mockResolvedValueOnce({ error: new Error(`Connection lost`) }) // target lookup fails

      await expect(
        removeProjectMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Connection lost`)
    })
  })
})
