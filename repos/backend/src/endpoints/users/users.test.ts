import type { Request, Response } from 'express'
import type { TEndpointConfig, TEndpoint } from '@TBE/types'

import { users } from './users'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { config } from '@TBE/configs/backend.config'
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe(`Users endpoints`, () => {
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
              user: {
                list: vi.fn(),
                get: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
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
      expect(users.path).toBe(`/users`)
      expect(users.method).toBe(`use`)
      expect(users.endpoints).toBeDefined()
      expect(users.endpoints?.listUsers).toBeDefined()
      expect(users.endpoints?.getUser).toBeDefined()
      expect(users.endpoints?.createUser).toBeDefined()
      expect(users.endpoints?.updateUser).toBeDefined()
      expect(users.endpoints?.deleteUser).toBeDefined()
    })
  })

  describe(`GET /_/users - List users`, () => {
    const ep = getEndpointCfg(users.endpoints?.listUsers)

    it(`should return 200 with user data on success`, async () => {
      const mockUsers = [
        { id: `1`, email: `user1@example.com`, name: `User One` },
        { id: `2`, email: `user2@example.com`, name: `User Two` },
      ]

      const mockList = mockReq.app?.locals.db.services.user.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockUsers })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockList).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockUsers })
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database connection failed`)

      const mockList = mockReq.app?.locals.db.services.user.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockList).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database connection failed` })
    })

    it(`should return empty array when no users exist`, async () => {
      const mockList = mockReq.app?.locals.db.services.user.list as ReturnType<
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
      expect(typeof ep.action).toBe(`function`)
    })
  })

  describe(`GET /_/users/:id - Get user by ID`, () => {
    const ep = getEndpointCfg(users.endpoints?.getUser)

    it(`should return 200 with user data when user exists`, async () => {
      const mockUser = { id: `123`, email: `user@example.com`, name: `Test User` }
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.user.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: mockUser })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockUser })
    })

    it(`should return 404 when user not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.user.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `User not found` })
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.user.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/:id`)
      expect(ep.method).toBe(`get`)
      expect(typeof ep.action).toBe(`function`)
    })
  })

  describe(`POST /_/users - Create user`, () => {
    const ep = getEndpointCfg(users.endpoints?.createUser)

    it(`should return 201 with created user data on success`, async () => {
      const newUser = { email: `new@example.com`, name: `New User` }
      const createdUser = { id: `456`, ...newUser }
      mockReq.body = newUser

      const mockCreate = mockReq.app?.locals.db.services.user.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdUser })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledWith(newUser)
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdUser })
    })

    it(`should return 400 when email is missing`, async () => {
      mockReq.body = { name: `No Email User` }

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Email is required` })
    })

    it(`should return 400 when body is empty`, async () => {
      mockReq.body = {}

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Email is required` })
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database insert failed`)
      mockReq.body = { email: `test@example.com` }

      const mockCreate = mockReq.app?.locals.db.services.user.create as ReturnType<
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
      expect(typeof ep.action).toBe(`function`)
    })
  })

  describe(`PUT /_/users/:id - Update user`, () => {
    const ep = getEndpointCfg(users.endpoints?.updateUser)

    it(`should return 200 with updated user data on success`, async () => {
      const existingUser = { id: `123`, email: `old@example.com`, name: `Old Name` }
      const updateData = { name: `New Name` }
      const updatedUser = { ...existingUser, ...updateData }
      mockReq.params = { id: `123` }
      mockReq.body = updateData

      const mockGet = mockReq.app?.locals.db.services.user.get as ReturnType<typeof vi.fn>
      const mockUpdate = mockReq.app?.locals.db.services.user.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingUser })
      mockUpdate.mockResolvedValue({ data: updatedUser })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockUpdate).toHaveBeenCalledWith({ ...updateData, id: `123` })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: updatedUser })
    })

    it(`should return 404 when user not found`, async () => {
      mockReq.params = { id: `nonexistent` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.user.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `User not found` })
    })

    it(`should return 500 when get fails`, async () => {
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `123` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.user.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should return 500 when update fails`, async () => {
      const existingUser = { id: `123`, email: `test@example.com` }
      const mockError = new Error(`Database update failed`)
      mockReq.params = { id: `123` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.user.get as ReturnType<typeof vi.fn>
      const mockUpdate = mockReq.app?.locals.db.services.user.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingUser })
      mockUpdate.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database update failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/:id`)
      expect(ep.method).toBe(`put`)
      expect(typeof ep.action).toBe(`function`)
    })
  })

  describe(`DELETE /_/users/:id - Delete user`, () => {
    const ep = getEndpointCfg(users.endpoints?.deleteUser)

    it(`should return 200 with deleted user data on success`, async () => {
      const existingUser = { id: `123`, email: `delete@example.com`, name: `To Delete` }
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.user.get as ReturnType<typeof vi.fn>
      const mockDelete = mockReq.app?.locals.db.services.user.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingUser })
      mockDelete.mockResolvedValue({ data: existingUser })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockDelete).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: existingUser })
    })

    it(`should return 404 when user not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.user.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `User not found` })
    })

    it(`should return 500 when get fails`, async () => {
      const mockError = new Error(`Database query failed`)
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.user.get as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database query failed` })
    })

    it(`should return 500 when delete fails`, async () => {
      const existingUser = { id: `123`, email: `test@example.com` }
      const mockError = new Error(`Database delete failed`)
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.user.get as ReturnType<typeof vi.fn>
      const mockDelete = mockReq.app?.locals.db.services.user.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingUser })
      mockDelete.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database delete failed` })
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/:id`)
      expect(ep.method).toBe(`delete`)
      expect(typeof ep.action).toBe(`function`)
    })
  })
})
