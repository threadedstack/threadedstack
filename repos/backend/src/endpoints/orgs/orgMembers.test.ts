import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ERoleType } from '@tdsk/domain'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { listOrgMembers } from './listOrgMembers'
import { removeOrgMember } from './removeOrgMember'

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

describe(`Org Members endpoints`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const buildApp = () => {
    return {
      locals: {
        config,
        payments: new PaymentsService(config.payments),
        db: {
          services: {
            org: {
              get: vi.fn().mockResolvedValue({ data: { id: `org-1`, name: `Test Org` } }),
            },
            role: {
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.admin } }),
              getProjectRole: vi
                .fn()
                .mockResolvedValue({ data: { type: ERoleType.admin } }),
              getOrgMembers: vi.fn(),
              isOrgMember: vi.fn().mockResolvedValue({ data: true }),
              removeFromOrg: vi.fn(),
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
      params: { orgId: `org-1` },
      body: {},
      query: {},
    }
  })

  describe(`GET /:orgId/members - List org members`, () => {
    it(`should have correct endpoint configuration`, () => {
      expect(listOrgMembers.path).toBe(`/:orgId/members`)
      expect(listOrgMembers.method).toBe(`get`)
      expect(typeof listOrgMembers.action).toBe(`function`)
    })

    it(`should return 200 with members list and pass pagination to DB`, async () => {
      const mockMembers = [
        { id: `role-1`, userId: `user-1`, orgId: `org-1`, type: ERoleType.owner },
        { id: `role-2`, userId: `user-2`, orgId: `org-1`, type: ERoleType.member },
      ]

      const mockGetOrgMembers = mockReq.app?.locals.db.services.role
        .getOrgMembers as ReturnType<typeof vi.fn>
      mockGetOrgMembers.mockResolvedValue({ data: mockMembers })

      await listOrgMembers.action(mockReq as TRequest, mockRes as Response)

      expect(mockGetOrgMembers).toHaveBeenCalledWith(`org-1`, { limit: 50, offset: 0 })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockMembers, limit: 50, offset: 0 })
    })

    it(`should pass custom pagination params to DB`, async () => {
      const mockGetOrgMembers = mockReq.app?.locals.db.services.role
        .getOrgMembers as ReturnType<typeof vi.fn>
      mockGetOrgMembers.mockResolvedValue({ data: [] })
      mockReq.query = { limit: `5`, offset: `10` }

      await listOrgMembers.action(mockReq as TRequest, mockRes as Response)

      expect(mockGetOrgMembers).toHaveBeenCalledWith(`org-1`, { limit: 5, offset: 10 })
      expect(mockStatus).toHaveBeenCalledWith(200)
      const response = mockJson.mock.calls[0][0]
      expect(response.limit).toBe(5)
      expect(response.offset).toBe(10)
    })

    it(`should throw 401 when user is not authenticated`, async () => {
      mockReq.user = undefined

      await expect(
        listOrgMembers.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Authentication required`)
    })

    it(`should throw 403 when user is not an org member`, async () => {
      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      mockIsOrgMember.mockResolvedValue({ data: false })

      await expect(
        listOrgMembers.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`You are not a member of this organization`)
    })

    it(`should throw 500 when database query fails`, async () => {
      const mockGetOrgMembers = mockReq.app?.locals.db.services.role
        .getOrgMembers as ReturnType<typeof vi.fn>
      mockGetOrgMembers.mockResolvedValue({ error: new Error(`Database error`) })

      await expect(
        listOrgMembers.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Database error`)
    })
  })

  // ========== removeOrgMember ==========
  describe(`DELETE /:orgId/members/:userId - Remove org member`, () => {
    it(`should have correct endpoint configuration`, () => {
      expect(removeOrgMember.path).toBe(`/:orgId/members/:userId`)
      expect(removeOrgMember.method).toBe(`delete`)
      expect(typeof removeOrgMember.action).toBe(`function`)
    })

    it(`should return 200 with removed role`, async () => {
      const mockRole = {
        id: `role-1`,
        userId: `user-2`,
        orgId: `org-1`,
        type: ERoleType.member,
      }

      mockReq.params = { orgId: `org-1`, userId: `user-2` }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockRemoveFromOrg = mockReq.app?.locals.db.services.role
        .removeFromOrg as ReturnType<typeof vi.fn>

      // Call flow:
      // 1. checkPermission -> getUserRole -> getOrgRole(admin), getProjectRole(admin)
      // 2. org.get -> exists
      // 3. getOrgRole(target) -> member
      // 4. getUserRole -> getOrgRole(admin), getProjectRole(admin) (for canManageRole)
      mockGetOrgRole
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // checkPermission -> getUserRole
        .mockResolvedValueOnce({ data: mockRole }) // target user lookup
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // explicit getUserRole

      mockRemoveFromOrg.mockResolvedValue({ data: true })

      await removeOrgMember.action(mockReq as TRequest, mockRes as Response)

      expect(mockRemoveFromOrg).toHaveBeenCalledWith(`user-2`, `org-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockRole })
    })

    it(`should throw 401 when user is not authenticated`, async () => {
      mockReq.user = undefined
      mockReq.params = { orgId: `org-1`, userId: `user-2` }

      await expect(
        removeOrgMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Authentication required`)
    })

    it(`should throw 404 when org not found`, async () => {
      mockReq.params = { orgId: `org-1`, userId: `user-2` }

      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      mockGetOrg.mockResolvedValue({ data: undefined })

      await expect(
        removeOrgMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Org not found`)
    })

    it(`should throw 404 when target member not found`, async () => {
      mockReq.params = { orgId: `org-1`, userId: `user-2` }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>

      // 1. checkPermission -> getUserRole -> getOrgRole(admin)
      // 2. getOrgRole(target) -> null
      mockGetOrgRole
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // checkPermission
        .mockResolvedValueOnce({ data: null }) // target not found

      await expect(
        removeOrgMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Org member not found`)
    })

    it(`should throw 403 when trying to remove owner`, async () => {
      mockReq.params = { orgId: `org-1`, userId: `user-2` }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>

      // 1. checkPermission -> getUserRole -> getOrgRole(admin)
      // 2. getOrgRole(target) -> owner
      mockGetOrgRole
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // checkPermission
        .mockResolvedValueOnce({ data: { type: ERoleType.owner } }) // target is owner

      await expect(
        removeOrgMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(
        `Cannot remove owner from organization. Transfer ownership first.`
      )
    })

    it(`should throw 403 when trying to remove member with equal or higher role`, async () => {
      mockReq.params = { orgId: `org-1`, userId: `user-2` }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>

      // 1. checkPermission -> getUserRole -> getOrgRole(admin)
      // 2. getOrgRole(target) -> admin (equal)
      // 3. getUserRole -> getOrgRole(admin) (for canManageRole)
      mockGetOrgRole
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // checkPermission
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // target has equal role
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // canManageRole check

      await expect(
        removeOrgMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(
        `You cannot remove members with equal or higher roles than your own.`
      )
    })

    it(`should throw 500 when removeFromOrg fails`, async () => {
      const mockRole = {
        id: `role-1`,
        userId: `user-2`,
        orgId: `org-1`,
        type: ERoleType.member,
      }

      mockReq.params = { orgId: `org-1`, userId: `user-2` }

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockRemoveFromOrg = mockReq.app?.locals.db.services.role
        .removeFromOrg as ReturnType<typeof vi.fn>

      mockGetOrgRole
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // checkPermission
        .mockResolvedValueOnce({ data: mockRole }) // target user lookup
        .mockResolvedValueOnce({ data: { type: ERoleType.admin } }) // canManageRole

      mockRemoveFromOrg.mockResolvedValue({ error: new Error(`Delete failed`) })

      await expect(
        removeOrgMember.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Delete failed`)
    })
  })
})
