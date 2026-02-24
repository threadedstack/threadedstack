import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ERoleType } from '@tdsk/domain'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { listOrgMembers } from './listOrgMembers'

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
            role: {
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.admin } }),
              getProjectRole: vi
                .fn()
                .mockResolvedValue({ data: { type: ERoleType.admin } }),
              getOrgMembers: vi.fn(),
              isOrgMember: vi.fn().mockResolvedValue({ data: true }),
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
})
