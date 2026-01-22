import type { Response } from 'express'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TApp, TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'

import { orgs } from './orgs'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { ERoleType } from '@tdsk/domain'

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

describe(`Orgs endpoints`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const mockApp = {
    locals: {
      config,
      payments: new PaymentsService(config.payments),
      db: {
        services: {
          org: {
            list: vi.fn(),
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
          },
          role: {
            getOrgRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
            getProjectRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
            getUserRoles: vi.fn().mockResolvedValue({ data: [] }),
            getUserOrgs: vi.fn().mockResolvedValue({ data: [] }),
            isOrgMember: vi.fn().mockResolvedValue({ data: true }),
          },
        },
      },
    },
  } as unknown as TApp

  const getEndpointCfg = (endpoint: TEndpoint): TEndpointConfig =>
    isFunc(endpoint) ? endpoint(mockApp) : endpoint

  beforeEach(() => {
    vi.clearAllMocks()
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response)

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: mockApp,
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
      } as any,
      params: {},
      body: {},
      query: {},
    }
  })

  describe(`Parent endpoint configuration`, () => {
    it(`should have correct configuration`, () => {
      expect(orgs.path).toBe(`/orgs`)
      expect(orgs.method).toBe(`use`)
      expect(orgs.endpoints).toBeDefined()
      expect(orgs.endpoints?.listOrgs).toBeDefined()
      expect(orgs.endpoints?.getOrg).toBeDefined()
    })
  })

  describe(`GET /_/orgs - List orgs`, () => {
    const ep = getEndpointCfg(orgs.endpoints?.listOrgs)

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/`)
      expect(ep.method).toBe(`get`)
      expect(typeof ep.action).toBe(`function`)
    })

    it(`should return 401 when user is not authenticated`, async () => {
      mockReq.user = undefined

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({ error: `Authentication required` })
    })

    it(`should return 200 with empty array when user has no orgs`, async () => {
      const mockGetUserRoles = mockReq.app?.locals.db.services.role
        .getUserRoles as ReturnType<typeof vi.fn>
      const mockGetUserOrgs = mockReq.app?.locals.db.services.role
        .getUserOrgs as ReturnType<typeof vi.fn>
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockList = mockReq.app?.locals.db.services.org.list as ReturnType<
        typeof vi.fn
      >

      mockGetOrgRole.mockResolvedValue({ data: null })
      mockGetUserRoles.mockResolvedValue({ data: [] })
      mockGetUserOrgs.mockResolvedValue({ data: [] })
      mockList.mockResolvedValue({ data: [] })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: [] })
    })

    it(`should return 200 with orgs the user is a member of`, async () => {
      const mockOrgs = [
        { id: `org-1`, name: `Organization One`, slug: `org-one` },
        { id: `org-2`, name: `Organization Two`, slug: `org-two` },
      ]
      const mockRoles = [
        { userId: `test-user-id`, orgId: `org-1`, type: ERoleType.admin },
        { userId: `test-user-id`, orgId: `org-2`, type: ERoleType.member },
      ]

      const mockGetUserRoles = mockReq.app?.locals.db.services.role
        .getUserRoles as ReturnType<typeof vi.fn>
      const mockGetUserOrgs = mockReq.app?.locals.db.services.role
        .getUserOrgs as ReturnType<typeof vi.fn>
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockList = mockReq.app?.locals.db.services.org.list as ReturnType<
        typeof vi.fn
      >

      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })
      mockGetUserRoles.mockResolvedValue({ data: mockRoles })
      mockGetUserOrgs.mockResolvedValue({ data: [`org-1`, `org-2`] })
      mockList.mockResolvedValue({ data: mockOrgs })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(2)
      expect(responseData[0]).toHaveProperty(`userRole`)
      expect(responseData[1]).toHaveProperty(`userRole`)
    })

    it(`should return all orgs for super admin users`, async () => {
      const mockOrgs = [
        { id: `org-1`, name: `Organization One`, slug: `org-one` },
        { id: `org-2`, name: `Organization Two`, slug: `org-two` },
        { id: `org-3`, name: `Organization Three`, slug: `org-three` },
      ]

      // Set user as super admin via Neon role
      mockReq.user = {
        id: `super-user-id`,
        email: `super@example.com`,
        role: ERoleType.admin,
      } as any

      const mockGetUserRoles = mockReq.app?.locals.db.services.role
        .getUserRoles as ReturnType<typeof vi.fn>
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockList = mockReq.app?.locals.db.services.org.list as ReturnType<
        typeof vi.fn
      >

      mockGetOrgRole.mockResolvedValue({ data: null })
      mockGetUserRoles.mockResolvedValue({ data: [] })
      mockList.mockResolvedValue({ data: mockOrgs })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(3)
      responseData.forEach((org: any) => {
        expect(org).toHaveProperty(`userRole`)
      })
    })

    it(`should return 500 when getUserRoles fails`, async () => {
      const mockError = new Error(`Database connection failed`)

      const mockGetUserRoles = mockReq.app?.locals.db.services.role
        .getUserRoles as ReturnType<typeof vi.fn>
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>

      mockGetOrgRole.mockResolvedValue({ data: null })
      mockGetUserRoles.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database connection failed` })
    })

    it(`should return 500 when getUserOrgs fails`, async () => {
      const mockError = new Error(`Failed to get user orgs`)

      const mockGetUserRoles = mockReq.app?.locals.db.services.role
        .getUserRoles as ReturnType<typeof vi.fn>
      const mockGetUserOrgs = mockReq.app?.locals.db.services.role
        .getUserOrgs as ReturnType<typeof vi.fn>
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>

      mockGetOrgRole.mockResolvedValue({ data: null })
      mockGetUserRoles.mockResolvedValue({ data: [] })
      mockGetUserOrgs.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Failed to get user orgs` })
    })

    it(`should return 500 when org list fails for super admin`, async () => {
      const mockError = new Error(`Database query failed`)

      // Set user as super admin
      mockReq.user = {
        id: `super-user-id`,
        email: `super@example.com`,
        role: ERoleType.admin,
      } as any

      const mockGetUserRoles = mockReq.app?.locals.db.services.role
        .getUserRoles as ReturnType<typeof vi.fn>
      const mockList = mockReq.app?.locals.db.services.org.list as ReturnType<
        typeof vi.fn
      >

      mockGetUserRoles.mockResolvedValue({ data: [] })
      mockList.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should return 500 when org list fails for regular user`, async () => {
      const mockError = new Error(`List orgs failed`)

      const mockGetUserRoles = mockReq.app?.locals.db.services.role
        .getUserRoles as ReturnType<typeof vi.fn>
      const mockGetUserOrgs = mockReq.app?.locals.db.services.role
        .getUserOrgs as ReturnType<typeof vi.fn>
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockList = mockReq.app?.locals.db.services.org.list as ReturnType<
        typeof vi.fn
      >

      mockGetOrgRole.mockResolvedValue({ data: null })
      mockGetUserRoles.mockResolvedValue({ data: [] })
      mockGetUserOrgs.mockResolvedValue({ data: [`org-1`] })
      mockList.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `List orgs failed` })
    })

    it(`should include correct user role for each org`, async () => {
      const mockOrgs = [
        { id: `org-1`, name: `Organization One` },
        { id: `org-2`, name: `Organization Two` },
      ]
      const mockRoles = [
        { userId: `test-user-id`, orgId: `org-1`, type: ERoleType.owner },
        { userId: `test-user-id`, orgId: `org-2`, type: ERoleType.viewer },
      ]

      const mockGetUserRoles = mockReq.app?.locals.db.services.role
        .getUserRoles as ReturnType<typeof vi.fn>
      const mockGetUserOrgs = mockReq.app?.locals.db.services.role
        .getUserOrgs as ReturnType<typeof vi.fn>
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockList = mockReq.app?.locals.db.services.org.list as ReturnType<
        typeof vi.fn
      >

      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.owner } })
      mockGetUserRoles.mockResolvedValue({ data: mockRoles })
      mockGetUserOrgs.mockResolvedValue({ data: [`org-1`, `org-2`] })
      mockList.mockResolvedValue({ data: mockOrgs })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData[0].userRole).toBe(ERoleType.owner)
      expect(responseData[1].userRole).toBe(ERoleType.viewer)
    })
  })

  describe(`GET /_/orgs/:id - Get org by ID`, () => {
    const ep = getEndpointCfg(orgs.endpoints?.getOrg)

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/:id`)
      expect(ep.method).toBe(`get`)
      expect(typeof ep.action).toBe(`function`)
    })

    it(`should return 401 when user is not authenticated`, async () => {
      mockReq.user = undefined
      mockReq.params = { id: `org-123` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({ error: `Authentication required` })
    })

    it(`should return 200 with org data when user is a member`, async () => {
      const mockOrg = {
        id: `org-123`,
        name: `Test Organization`,
        slug: `test-org`,
        createdAt: new Date(),
      }
      mockReq.params = { id: `org-123` }

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGet.mockResolvedValue({ data: mockOrg })
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`org-123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData.id).toBe(`org-123`)
      expect(responseData.name).toBe(`Test Organization`)
      expect(responseData).toHaveProperty(`userRole`)
    })

    it(`should return 404 when org not found`, async () => {
      mockReq.params = { id: `nonexistent-org` }

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`nonexistent-org`)
      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Org not found` })
    })

    it(`should return 500 when database query fails`, async () => {
      const mockError = new Error(`Database connection failed`)
      mockReq.params = { id: `org-123` }

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGet.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`org-123`)
      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database connection failed` })
    })

    it(`should throw 403 when user is not a member of the org`, async () => {
      mockReq.params = { id: `org-123` }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: false })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `You are not a member of this organization`
      )
    })

    it(`should include user role in response`, async () => {
      const mockOrg = {
        id: `org-123`,
        name: `Test Organization`,
        slug: `test-org`,
      }
      mockReq.params = { id: `org-123` }

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGet.mockResolvedValue({ data: mockOrg })
      mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.owner } })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData.userRole).toBe(ERoleType.owner)
    })

    it(`should allow super admin to access any org`, async () => {
      const mockOrg = {
        id: `org-123`,
        name: `Private Organization`,
        slug: `private-org`,
      }
      mockReq.params = { id: `org-123` }
      // Set user as Neon admin (super admin)
      mockReq.user = {
        id: `admin-user-id`,
        email: `admin@example.com`,
        role: ERoleType.admin,
      } as any

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>

      // Super admin bypasses membership check
      mockIsOrgMember.mockResolvedValue({ data: false })
      mockGet.mockResolvedValue({ data: mockOrg })
      mockGetOrgRole.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData.id).toBe(`org-123`)
      // Super admin gets super role
      expect(responseData.userRole).toBe(ERoleType.super)
    })
  })
})
