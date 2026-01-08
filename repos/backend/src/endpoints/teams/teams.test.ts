import type { Request, Response } from 'express'
import type { TEndpointConfig, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { teams } from './teams'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { config } from '@TBE/configs/backend.config'

describe(`Teams endpoints`, () => {
  let mockReq: Partial<Request>
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
              team: {
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
      expect(teams.path).toBe(`/teams`)
      expect(teams.method).toBe(`use`)
      expect(teams.endpoints).toBeDefined()
      expect(teams.endpoints?.listTeams).toBeDefined()
      expect(teams.endpoints?.getTeam).toBeDefined()
      expect(teams.endpoints?.createTeam).toBeDefined()
      expect(teams.endpoints?.updateTeam).toBeDefined()
      expect(teams.endpoints?.deleteTeam).toBeDefined()
      expect(teams.endpoints?.addTeamMember).toBeDefined()
      expect(teams.endpoints?.removeTeamMember).toBeDefined()
    })
  })

  describe(`GET /_/teams - List teams`, () => {
    const ep = getEndpointCfg(teams.endpoints?.listTeams)

    it(`should return 200 with team data on success`, async () => {
      const mockTeams = [
        { id: `1`, name: `Team Alpha`, description: `First team` },
        { id: `2`, name: `Team Beta`, description: `Second team` },
      ]

      const mockList = mockReq.app?.locals.db.services.team.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockTeams })
      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockList).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockTeams })
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database connection failed`)

      const mockList = mockReq.app?.locals.db.services.team.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: mockError })
      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database connection failed` })
    })

    it(`should return empty array when no teams exist`, async () => {
      const mockList = mockReq.app?.locals.db.services.team.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [] })
      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: [] })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/`)
      expect(ep.method).toBe(`get`)
    })
  })

  describe(`GET /_/teams/:id - Get team by ID`, () => {
    const ep = getEndpointCfg(teams.endpoints?.getTeam)

    it(`should return 200 with team data when team exists`, async () => {
      const mockTeam = { id: `123`, name: `Test Team`, description: `Test` }
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.team.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: mockTeam })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockTeam })
    })

    it(`should return 404 when team not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.team.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Team not found` })
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.team.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/:id`)
      expect(ep.method).toBe(`get`)
    })
  })

  describe(`POST /_/teams - Create team`, () => {
    const ep = getEndpointCfg(teams.endpoints?.createTeam)

    it(`should return 201 with created team data on success`, async () => {
      const newTeam = { name: `New Team`, description: `A new team` }
      const createdTeam = { id: `456`, ...newTeam }
      mockReq.body = newTeam

      const mockCreate = mockReq.app?.locals.db.services.team.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdTeam })
      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledWith(newTeam)
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdTeam })
    })

    it(`should return 400 when name is missing`, async () => {
      mockReq.body = { description: `No name team` }
      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Team name is required` })
    })

    it(`should return 400 when body is empty`, async () => {
      mockReq.body = {}
      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Team name is required` })
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database insert failed`)
      mockReq.body = { name: `Test Team` }

      const mockCreate = mockReq.app?.locals.db.services.team.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ error: mockError })
      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database insert failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/`)
      expect(ep.method).toBe(`post`)
    })
  })

  describe(`PUT /_/teams/:id - Update team`, () => {
    const ep = getEndpointCfg(teams.endpoints?.updateTeam)

    it(`should return 200 with updated team data on success`, async () => {
      const existingTeam = { id: `123`, name: `Old Name`, description: `Old desc` }
      const updateData = { name: `New Name` }
      const updatedTeam = { ...existingTeam, ...updateData }
      mockReq.params = { id: `123` }
      mockReq.body = updateData

      const mockGet = mockReq.app?.locals.db.services.team.get as ReturnType<typeof vi.fn>
      const mockUpdate = mockReq.app?.locals.db.services.team.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingTeam })
      mockUpdate.mockResolvedValue({ data: updatedTeam })
      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockUpdate).toHaveBeenCalledWith({ ...updateData, id: `123` })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: updatedTeam })
    })

    it(`should return 404 when team not found`, async () => {
      mockReq.params = { id: `nonexistent` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.team.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Team not found` })
    })

    it(`should return 500 when get fails`, async () => {
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `123` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.team.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should return 500 when update fails`, async () => {
      const existingTeam = { id: `123`, name: `Test Team` }
      const mockError = new Error(`Database update failed`)
      mockReq.params = { id: `123` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.team.get as ReturnType<typeof vi.fn>
      const mockUpdate = mockReq.app?.locals.db.services.team.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingTeam })
      mockUpdate.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database update failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/:id`)
      expect(ep.method).toBe(`put`)
    })
  })

  describe(`DELETE /_/teams/:id - Delete team`, () => {
    const ep = getEndpointCfg(teams.endpoints?.deleteTeam)

    it(`should return 200 with deleted team data on success`, async () => {
      const existingTeam = { id: `123`, name: `To Delete`, description: `Delete me` }
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.team.get as ReturnType<typeof vi.fn>
      const mockDelete = mockReq.app?.locals.db.services.team.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingTeam })
      mockDelete.mockResolvedValue({ data: existingTeam })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockDelete).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: existingTeam })
    })

    it(`should return 404 when team not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.team.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Team not found` })
    })

    it(`should return 500 when get fails`, async () => {
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.team.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should return 500 when delete fails`, async () => {
      const existingTeam = { id: `123`, name: `Test Team` }
      const mockError = new Error(`Database delete failed`)
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.team.get as ReturnType<typeof vi.fn>
      const mockDelete = mockReq.app?.locals.db.services.team.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingTeam })
      mockDelete.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database delete failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/:id`)
      expect(ep.method).toBe(`delete`)
    })
  })

  describe(`POST /_/teams/:id/members - Add team member`, () => {
    const ep = getEndpointCfg(teams.endpoints?.addTeamMember)

    it(`should return 201 with role data on success`, async () => {
      const existingTeam = { id: `team-123`, name: `Test Team` }
      const existingUser = { id: `user-456`, email: `user@example.com` }
      const createdRole = {
        id: `role-789`,
        teamId: `team-123`,
        userId: `user-456`,
        type: `basic`,
      }
      mockReq.params = { id: `team-123` }
      mockReq.body = { userId: `user-456` }

      const mockTeamGet = mockReq.app?.locals.db.services.team.get as ReturnType<
        typeof vi.fn
      >
      const mockUserGet = mockReq.app?.locals.db.services.user.get as ReturnType<
        typeof vi.fn
      >
      const mockRoleCreate = mockReq.app?.locals.db.services.role.create as ReturnType<
        typeof vi.fn
      >
      mockTeamGet.mockResolvedValue({ data: existingTeam })
      mockUserGet.mockResolvedValue({ data: existingUser })
      mockRoleCreate.mockResolvedValue({ data: createdRole })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockTeamGet).toHaveBeenCalledWith(`team-123`)
      expect(mockUserGet).toHaveBeenCalledWith(`user-456`)
      expect(mockRoleCreate).toHaveBeenCalledWith({
        teamId: `team-123`,
        userId: `user-456`,
        type: `basic`,
      })
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdRole })
    })

    it(`should use custom role type when provided`, async () => {
      const existingTeam = { id: `team-123`, name: `Test Team` }
      const existingUser = { id: `user-456`, email: `user@example.com` }
      const createdRole = {
        id: `role-789`,
        teamId: `team-123`,
        userId: `user-456`,
        type: `admin`,
      }
      mockReq.params = { id: `team-123` }
      mockReq.body = { userId: `user-456`, type: `admin` }

      const mockTeamGet = mockReq.app?.locals.db.services.team.get as ReturnType<
        typeof vi.fn
      >
      const mockUserGet = mockReq.app?.locals.db.services.user.get as ReturnType<
        typeof vi.fn
      >
      const mockRoleCreate = mockReq.app?.locals.db.services.role.create as ReturnType<
        typeof vi.fn
      >
      mockTeamGet.mockResolvedValue({ data: existingTeam })
      mockUserGet.mockResolvedValue({ data: existingUser })
      mockRoleCreate.mockResolvedValue({ data: createdRole })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockRoleCreate).toHaveBeenCalledWith({
        teamId: `team-123`,
        userId: `user-456`,
        type: `admin`,
      })
    })

    it(`should return 400 when userId is missing`, async () => {
      mockReq.params = { id: `team-123` }
      mockReq.body = {}

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `userId is required` })
    })

    it(`should return 404 when team not found`, async () => {
      mockReq.params = { id: `nonexistent` }
      mockReq.body = { userId: `user-456` }

      const mockTeamGet = mockReq.app?.locals.db.services.team.get as ReturnType<
        typeof vi.fn
      >
      mockTeamGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Team not found` })
    })

    it(`should return 404 when user not found`, async () => {
      const existingTeam = { id: `team-123`, name: `Test Team` }
      mockReq.params = { id: `team-123` }
      mockReq.body = { userId: `nonexistent` }

      const mockTeamGet = mockReq.app?.locals.db.services.team.get as ReturnType<
        typeof vi.fn
      >
      const mockUserGet = mockReq.app?.locals.db.services.user.get as ReturnType<
        typeof vi.fn
      >
      mockTeamGet.mockResolvedValue({ data: existingTeam })
      mockUserGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `User not found` })
    })

    it(`should return 500 when team get fails`, async () => {
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `team-123` }
      mockReq.body = { userId: `user-456` }

      const mockTeamGet = mockReq.app?.locals.db.services.team.get as ReturnType<
        typeof vi.fn
      >
      mockTeamGet.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should return 500 when role create fails`, async () => {
      const existingTeam = { id: `team-123`, name: `Test Team` }
      const existingUser = { id: `user-456`, email: `user@example.com` }
      const mockError = new Error(`Database insert failed`)
      mockReq.params = { id: `team-123` }
      mockReq.body = { userId: `user-456` }

      const mockTeamGet = mockReq.app?.locals.db.services.team.get as ReturnType<
        typeof vi.fn
      >
      const mockUserGet = mockReq.app?.locals.db.services.user.get as ReturnType<
        typeof vi.fn
      >
      const mockRoleCreate = mockReq.app?.locals.db.services.role.create as ReturnType<
        typeof vi.fn
      >
      mockTeamGet.mockResolvedValue({ data: existingTeam })
      mockUserGet.mockResolvedValue({ data: existingUser })
      mockRoleCreate.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database insert failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/:id/members`)
      expect(ep.method).toBe(`post`)
    })
  })

  describe(`DELETE /_/teams/:id/members/:userId - Remove team member`, () => {
    const ep = getEndpointCfg(teams.endpoints?.removeTeamMember)

    it(`should return 200 with deleted role data on success`, async () => {
      const existingTeam = { id: `team-123`, name: `Test Team` }
      const existingRole = {
        id: `role-789`,
        teamId: `team-123`,
        userId: `user-456`,
        type: `basic`,
      }
      mockReq.params = { id: `team-123`, userId: `user-456` }

      const mockTeamGet = mockReq.app?.locals.db.services.team.get as ReturnType<
        typeof vi.fn
      >
      const mockRoleList = mockReq.app?.locals.db.services.role.list as ReturnType<
        typeof vi.fn
      >
      const mockRoleDelete = mockReq.app?.locals.db.services.role.delete as ReturnType<
        typeof vi.fn
      >
      mockTeamGet.mockResolvedValue({ data: existingTeam })
      mockRoleList.mockResolvedValue({ data: [existingRole] })
      mockRoleDelete.mockResolvedValue({ data: existingRole })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockTeamGet).toHaveBeenCalledWith(`team-123`)
      expect(mockRoleList).toHaveBeenCalled()
      expect(mockRoleDelete).toHaveBeenCalledWith(`role-789`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: existingRole })
    })

    it(`should return 404 when team not found`, async () => {
      mockReq.params = { id: `nonexistent`, userId: `user-456` }

      const mockTeamGet = mockReq.app?.locals.db.services.team.get as ReturnType<
        typeof vi.fn
      >
      mockTeamGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Team not found` })
    })

    it(`should return 404 when member not found in team`, async () => {
      const existingTeam = { id: `team-123`, name: `Test Team` }
      const otherRole = {
        id: `role-999`,
        teamId: `other-team`,
        userId: `other-user`,
        type: `basic`,
      }
      mockReq.params = { id: `team-123`, userId: `user-456` }

      const mockTeamGet = mockReq.app?.locals.db.services.team.get as ReturnType<
        typeof vi.fn
      >
      const mockRoleList = mockReq.app?.locals.db.services.role.list as ReturnType<
        typeof vi.fn
      >
      mockTeamGet.mockResolvedValue({ data: existingTeam })
      mockRoleList.mockResolvedValue({ data: [otherRole] })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Team member not found` })
    })

    it(`should return 500 when team get fails`, async () => {
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `team-123`, userId: `user-456` }

      const mockTeamGet = mockReq.app?.locals.db.services.team.get as ReturnType<
        typeof vi.fn
      >
      mockTeamGet.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should return 500 when role list fails`, async () => {
      const existingTeam = { id: `team-123`, name: `Test Team` }
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `team-123`, userId: `user-456` }

      const mockTeamGet = mockReq.app?.locals.db.services.team.get as ReturnType<
        typeof vi.fn
      >
      const mockRoleList = mockReq.app?.locals.db.services.role.list as ReturnType<
        typeof vi.fn
      >
      mockTeamGet.mockResolvedValue({ data: existingTeam })
      mockRoleList.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should return 500 when role delete fails`, async () => {
      const existingTeam = { id: `team-123`, name: `Test Team` }
      const existingRole = {
        id: `role-789`,
        teamId: `team-123`,
        userId: `user-456`,
        type: `basic`,
      }
      const mockError = new Error(`Database delete failed`)
      mockReq.params = { id: `team-123`, userId: `user-456` }

      const mockTeamGet = mockReq.app?.locals.db.services.team.get as ReturnType<
        typeof vi.fn
      >
      const mockRoleList = mockReq.app?.locals.db.services.role.list as ReturnType<
        typeof vi.fn
      >
      const mockRoleDelete = mockReq.app?.locals.db.services.role.delete as ReturnType<
        typeof vi.fn
      >
      mockTeamGet.mockResolvedValue({ data: existingTeam })
      mockRoleList.mockResolvedValue({ data: [existingRole] })
      mockRoleDelete.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database delete failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/:id/members/:userId`)
      expect(ep.method).toBe(`delete`)
    })
  })
})
