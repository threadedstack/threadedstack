import type { Response } from 'express'
import type { TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { orgs } from './orgs'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { config } from '@TBE/configs/backend.config'

describe(`Orgs endpoints`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const getEndpointCfg = (endpoint: TEndpoint): TEndpointConfig =>
    isFunc(endpoint) ? endpoint(config) : endpoint

  beforeEach(() => {
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response)

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: {
        locals: {
          db: {
            services: {
              org: {
                list: vi.fn(),
                get: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                delete: vi.fn(),
              },
              user: {
                get: vi.fn(),
              },
              role: {
                list: vi.fn(),
                create: vi.fn(),
                delete: vi.fn(),
              },
            },
          },
        },
      } as any,
      params: {},
      body: {},
    }
  })

  describe(`Parent endpoint configuration`, () => {
    it(`should have correct configuration`, () => {
      expect(orgs.path).toBe(`/orgs`)
      expect(orgs.method).toBe(`use`)
      expect(orgs.endpoints).toBeDefined()
      expect(orgs.endpoints?.listOrgs).toBeDefined()
      expect(orgs.endpoints?.getOrg).toBeDefined()
      expect(orgs.endpoints?.createOrg).toBeDefined()
      expect(orgs.endpoints?.updateOrg).toBeDefined()
      expect(orgs.endpoints?.deleteOrg).toBeDefined()
      expect(orgs.endpoints?.addOrgMember).toBeDefined()
      expect(orgs.endpoints?.removeOrgMember).toBeDefined()
    })
  })

  describe(`GET /_/orgs - List orgs`, () => {
    const ep = getEndpointCfg(orgs.endpoints?.listOrgs)

    it(`should return 200 with org data on success`, async () => {
      const mockOrgs = [
        { id: `1`, name: `Org Alpha`, description: `First org` },
        { id: `2`, name: `Org Beta`, description: `Second org` },
      ]

      const mockList = mockReq.app?.locals.db.services.org.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockOrgs })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockOrgs })
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database connection failed`)

      const mockList = mockReq.app?.locals.db.services.org.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: mockError })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database connection failed` })
    })

    it(`should return empty array when no orgs exist`, async () => {
      const mockList = mockReq.app?.locals.db.services.org.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [] })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: [] })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/`)
      expect(ep.method).toBe(`get`)
    })
  })

  describe(`GET /_/orgs/:id - Get org by ID`, () => {
    const ep = getEndpointCfg(orgs.endpoints?.getOrg)

    it(`should return 200 with org data when org exists`, async () => {
      const mockOrg = { id: `123`, name: `Test Org`, description: `Test` }
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: mockOrg })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockOrg })
    })

    it(`should return 404 when org not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Org not found` })
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/:id`)
      expect(ep.method).toBe(`get`)
    })
  })

  describe(`POST /_/orgs - Create org`, () => {
    const ep = getEndpointCfg(orgs.endpoints?.createOrg)

    it(`should return 201 with created org data on success`, async () => {
      const newOrg = { name: `New Org`, description: `A new org` }
      const createdOrg = { id: `456`, ...newOrg }
      mockReq.body = newOrg

      const mockCreate = mockReq.app?.locals.db.services.org.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdOrg })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledWith(newOrg)
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdOrg })
    })

    it(`should return 400 when name is missing`, async () => {
      mockReq.body = { description: `No name org` }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Org name is required` })
    })

    it(`should return 400 when body is empty`, async () => {
      mockReq.body = {}
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Org name is required` })
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database insert failed`)
      mockReq.body = { name: `Test Org` }

      const mockCreate = mockReq.app?.locals.db.services.org.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ error: mockError })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database insert failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/`)
      expect(ep.method).toBe(`post`)
    })
  })

  describe(`PUT /_/orgs/:id - Update org`, () => {
    const ep = getEndpointCfg(orgs.endpoints?.updateOrg)

    it(`should return 200 with updated org data on success`, async () => {
      const existingOrg = { id: `123`, name: `Old Name`, description: `Old desc` }
      const updateData = { name: `New Name` }
      const updatedOrg = { ...existingOrg, ...updateData }
      mockReq.params = { id: `123` }
      mockReq.body = updateData

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      const mockUpdate = mockReq.app?.locals.db.services.org.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingOrg })
      mockUpdate.mockResolvedValue({ data: updatedOrg })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockUpdate).toHaveBeenCalledWith({ ...updateData, id: `123` })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: updatedOrg })
    })

    it(`should return 404 when org not found`, async () => {
      mockReq.params = { id: `nonexistent` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Org not found` })
    })

    it(`should return 500 when get fails`, async () => {
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `123` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should return 500 when update fails`, async () => {
      const existingOrg = { id: `123`, name: `Test Org` }
      const mockError = new Error(`Database update failed`)
      mockReq.params = { id: `123` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      const mockUpdate = mockReq.app?.locals.db.services.org.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingOrg })
      mockUpdate.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database update failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/:id`)
      expect(ep.method).toBe(`put`)
    })
  })

  describe(`DELETE /_/orgs/:id - Delete org`, () => {
    const ep = getEndpointCfg(orgs.endpoints?.deleteOrg)

    it(`should return 200 with deleted org data on success`, async () => {
      const existingOrg = { id: `123`, name: `To Delete`, description: `Delete me` }
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      const mockDelete = mockReq.app?.locals.db.services.org.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingOrg })
      mockDelete.mockResolvedValue({ data: existingOrg })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockDelete).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: existingOrg })
    })

    it(`should return 404 when org not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Org not found` })
    })

    it(`should return 500 when get fails`, async () => {
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should return 500 when delete fails`, async () => {
      const existingOrg = { id: `123`, name: `Test Org` }
      const mockError = new Error(`Database delete failed`)
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
      const mockDelete = mockReq.app?.locals.db.services.org.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingOrg })
      mockDelete.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database delete failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/:id`)
      expect(ep.method).toBe(`delete`)
    })
  })

  describe(`POST /_/orgs/:id/members - Add org member`, () => {
    const ep = getEndpointCfg(orgs.endpoints?.addOrgMember)

    it(`should return 201 with role data on success`, async () => {
      const existingOrg = { id: `org-123`, name: `Test Org` }
      const existingUser = { id: `user-456`, email: `user@example.com` }
      const createdRole = {
        id: `role-789`,
        orgId: `org-123`,
        userId: `user-456`,
        type: `basic`,
      }
      mockReq.params = { id: `org-123` }
      mockReq.body = { userId: `user-456` }

      const mockOrgGet = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockUserGet = mockReq.app?.locals.db.services.user.get as ReturnType<
        typeof vi.fn
      >
      const mockRoleCreate = mockReq.app?.locals.db.services.role.create as ReturnType<
        typeof vi.fn
      >
      mockOrgGet.mockResolvedValue({ data: existingOrg })
      mockUserGet.mockResolvedValue({ data: existingUser })
      mockRoleCreate.mockResolvedValue({ data: createdRole })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockOrgGet).toHaveBeenCalledWith(`org-123`)
      expect(mockUserGet).toHaveBeenCalledWith(`user-456`)
      expect(mockRoleCreate).toHaveBeenCalledWith({
        orgId: `org-123`,
        userId: `user-456`,
        type: `basic`,
      })
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdRole })
    })

    it(`should use custom role type when provided`, async () => {
      const existingOrg = { id: `org-123`, name: `Test Org` }
      const existingUser = { id: `user-456`, email: `user@example.com` }
      const createdRole = {
        id: `role-789`,
        orgId: `org-123`,
        userId: `user-456`,
        type: `admin`,
      }
      mockReq.params = { id: `org-123` }
      mockReq.body = { userId: `user-456`, type: `admin` }

      const mockOrgGet = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockUserGet = mockReq.app?.locals.db.services.user.get as ReturnType<
        typeof vi.fn
      >
      const mockRoleCreate = mockReq.app?.locals.db.services.role.create as ReturnType<
        typeof vi.fn
      >
      mockOrgGet.mockResolvedValue({ data: existingOrg })
      mockUserGet.mockResolvedValue({ data: existingUser })
      mockRoleCreate.mockResolvedValue({ data: createdRole })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockRoleCreate).toHaveBeenCalledWith({
        orgId: `org-123`,
        userId: `user-456`,
        type: `admin`,
      })
    })

    it(`should return 400 when userId is missing`, async () => {
      mockReq.params = { id: `org-123` }
      mockReq.body = {}

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `userId is required` })
    })

    it(`should return 404 when org not found`, async () => {
      mockReq.params = { id: `nonexistent` }
      mockReq.body = { userId: `user-456` }

      const mockOrgGet = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      mockOrgGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Org not found` })
    })

    it(`should return 404 when user not found`, async () => {
      const existingOrg = { id: `org-123`, name: `Test Org` }
      mockReq.params = { id: `org-123` }
      mockReq.body = { userId: `nonexistent` }

      const mockOrgGet = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockUserGet = mockReq.app?.locals.db.services.user.get as ReturnType<
        typeof vi.fn
      >
      mockOrgGet.mockResolvedValue({ data: existingOrg })
      mockUserGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `User not found` })
    })

    it(`should return 500 when org get fails`, async () => {
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `org-123` }
      mockReq.body = { userId: `user-456` }

      const mockOrgGet = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      mockOrgGet.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should return 500 when role create fails`, async () => {
      const existingOrg = { id: `org-123`, name: `Test Org` }
      const existingUser = { id: `user-456`, email: `user@example.com` }
      const mockError = new Error(`Database insert failed`)
      mockReq.params = { id: `org-123` }
      mockReq.body = { userId: `user-456` }

      const mockOrgGet = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockUserGet = mockReq.app?.locals.db.services.user.get as ReturnType<
        typeof vi.fn
      >
      const mockRoleCreate = mockReq.app?.locals.db.services.role.create as ReturnType<
        typeof vi.fn
      >
      mockOrgGet.mockResolvedValue({ data: existingOrg })
      mockUserGet.mockResolvedValue({ data: existingUser })
      mockRoleCreate.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database insert failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/:id/members`)
      expect(ep.method).toBe(`post`)
    })
  })

  describe(`DELETE /_/orgs/:id/members/:userId - Remove org member`, () => {
    const ep = getEndpointCfg(orgs.endpoints?.removeOrgMember)

    it(`should return 200 with deleted role data on success`, async () => {
      const existingOrg = { id: `org-123`, name: `Test Org` }
      const existingRole = {
        id: `role-789`,
        orgId: `org-123`,
        userId: `user-456`,
        type: `basic`,
      }
      mockReq.params = { id: `org-123`, userId: `user-456` }

      const mockOrgGet = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockRoleList = mockReq.app?.locals.db.services.role.list as ReturnType<
        typeof vi.fn
      >
      const mockRoleDelete = mockReq.app?.locals.db.services.role.delete as ReturnType<
        typeof vi.fn
      >
      mockOrgGet.mockResolvedValue({ data: existingOrg })
      mockRoleList.mockResolvedValue({ data: [existingRole] })
      mockRoleDelete.mockResolvedValue({ data: existingRole })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockOrgGet).toHaveBeenCalledWith(`org-123`)
      expect(mockRoleList).toHaveBeenCalled()
      expect(mockRoleDelete).toHaveBeenCalledWith(`role-789`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: existingRole })
    })

    it(`should return 404 when org not found`, async () => {
      mockReq.params = { id: `nonexistent`, userId: `user-456` }

      const mockOrgGet = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      mockOrgGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Org not found` })
    })

    it(`should return 404 when member not found in org`, async () => {
      const existingOrg = { id: `org-123`, name: `Test Org` }
      const otherRole = {
        id: `role-999`,
        orgId: `other-org`,
        userId: `other-user`,
        type: `basic`,
      }
      mockReq.params = { id: `org-123`, userId: `user-456` }

      const mockOrgGet = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockRoleList = mockReq.app?.locals.db.services.role.list as ReturnType<
        typeof vi.fn
      >
      mockOrgGet.mockResolvedValue({ data: existingOrg })
      mockRoleList.mockResolvedValue({ data: [otherRole] })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Org member not found` })
    })

    it(`should return 500 when org get fails`, async () => {
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `org-123`, userId: `user-456` }

      const mockOrgGet = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      mockOrgGet.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should return 500 when role list fails`, async () => {
      const existingOrg = { id: `org-123`, name: `Test Org` }
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `org-123`, userId: `user-456` }

      const mockOrgGet = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockRoleList = mockReq.app?.locals.db.services.role.list as ReturnType<
        typeof vi.fn
      >
      mockOrgGet.mockResolvedValue({ data: existingOrg })
      mockRoleList.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should return 500 when role delete fails`, async () => {
      const existingOrg = { id: `org-123`, name: `Test Org` }
      const existingRole = {
        id: `role-789`,
        orgId: `org-123`,
        userId: `user-456`,
        type: `basic`,
      }
      const mockError = new Error(`Database delete failed`)
      mockReq.params = { id: `org-123`, userId: `user-456` }

      const mockOrgGet = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockRoleList = mockReq.app?.locals.db.services.role.list as ReturnType<
        typeof vi.fn
      >
      const mockRoleDelete = mockReq.app?.locals.db.services.role.delete as ReturnType<
        typeof vi.fn
      >
      mockOrgGet.mockResolvedValue({ data: existingOrg })
      mockRoleList.mockResolvedValue({ data: [existingRole] })
      mockRoleDelete.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database delete failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/:id/members/:userId`)
      expect(ep.method).toBe(`delete`)
    })
  })
})
