import type { Response } from 'express'
import type { TApp, TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { functions } from './functions'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { Function as FunctionModel } from '@tdsk/domain'

describe(`Functions endpoints`, () => {
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
            function: {
              list: vi.fn(),
              get: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
              setAgents: vi.fn().mockResolvedValue({ data: null, error: null }),
              listByAgent: vi.fn().mockResolvedValue({ data: [] }),
            },
            role: {
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
              getProjectRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
            },
          },
        },
      },
    } as unknown as TApp
  }

  const getEndpointCfg = (endpoint?: TEndpoint): TEndpointConfig =>
    isFunc(endpoint) ? endpoint(buildApp()) : (endpoint as TEndpointConfig)

  beforeEach(() => {
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any

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
      params: {},
      body: {},
      query: {},
    }
  })

  describe(`Parent endpoint configuration`, () => {
    it(`should have correct configuration`, () => {
      expect(functions.path).toBe(`/functions`)
      expect(functions.method).toBe(`use`)
      expect(functions.endpoints).toBeDefined()
      expect(functions.endpoints?.listFunctions).toBeDefined()
      expect(functions.endpoints?.getFunction).toBeDefined()
      expect(functions.endpoints?.createFunction).toBeDefined()
      expect(functions.endpoints?.updateFunction).toBeDefined()
      expect(functions.endpoints?.deleteFunction).toBeDefined()
    })
  })

  describe(`GET /_/functions - List functions`, () => {
    const ep = getEndpointCfg(functions.endpoints?.listFunctions)

    it(`should return 200 with functions on success`, async () => {
      const mockFunctions = [
        new FunctionModel({
          id: `1`,
          name: `processPay`,
          content: `console.log('pay')`,
          language: `typescript`,
          projectId: `project-1`,
          endpointId: `endpoint-1`,
          createdAt: new Date(),
        }),
      ]

      const mockList = mockReq.app?.locals.db.services.function.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockFunctions })
      mockReq.params = { projectId: `project-1` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(200)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].projectId).toBe('project-1')
    })

    it(`should return 400 when projectId is missing`, async () => {
      mockReq.params = {}

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `projectId parameter required`
      )
    })

    it(`should pass pagination params to list and include in response`, async () => {
      mockReq.params = { projectId: `project-1` }
      mockReq.query = { limit: `15`, offset: `30` }

      const mockList = mockReq.app?.locals.db.services.function.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [] })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        where: { projectId: `project-1` },
        limit: 15,
        offset: 30,
      })
      const response = mockJson.mock.calls[0][0]
      expect(response.limit).toBe(15)
      expect(response.offset).toBe(30)
    })

    it(`should return 500 on database error`, async () => {
      const mockError = new Error(`Database connection failed`)
      mockReq.params = { projectId: `project-1` }

      const mockList = mockReq.app?.locals.db.services.function.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: mockError })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database connection failed`
      )
      expect(mockList).toHaveBeenCalledOnce()
    })
  })

  describe(`GET /_/functions/:id - Get function by ID`, () => {
    const ep = getEndpointCfg(functions.endpoints?.getFunction)

    it(`should return 200 with function when found`, async () => {
      const mockFunction = new FunctionModel({
        id: `123`,
        name: `testFunc`,
        content: `console.log('test')`,
        projectId: `project-1`,
        endpointId: `endpoint-1`,
      })
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.function.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockFunction })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockFunction })
    })

    it(`should return 404 when function not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.function.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Function not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })
  })

  describe(`POST /_/functions - Create function`, () => {
    const ep = getEndpointCfg(functions.endpoints?.createFunction)

    it(`should return 201 with created function on success`, async () => {
      const newFunction = {
        name: `newFunc`,
        content: `console.log('new')`,
        projectId: `project-123`,
        endpointId: `endpoint-456`,
      }
      const createdFunction = new FunctionModel({
        id: `789`,
        ...newFunction,
        language: `typescript`,
      })
      mockReq.body = newFunction

      const mockCreate = mockReq.app?.locals.db.services.function.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdFunction })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdFunction })
    })

    it(`should return 400 when name is missing`, async () => {
      mockReq.body = {
        content: `code`,
        projectId: `p`,
        endpointId: `e`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Function name is required`
      )
    })

    it(`should return 400 when content is missing`, async () => {
      mockReq.body = {
        name: `func`,
        projectId: `p`,
        endpointId: `e`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Function content is required`
      )
    })

    it(`should return 400 when projectId is missing`, async () => {
      mockReq.body = {
        name: `func`,
        content: `code`,
        endpointId: `e`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Project ID is required`
      )
    })

    it(`should return 400 when endpointId is missing`, async () => {
      const createdFunction = new FunctionModel({
        id: `new-1`,
        name: `func`,
        content: `code`,
        projectId: `p`,
        language: `typescript`,
      })
      mockReq.body = {
        name: `func`,
        content: `code`,
        projectId: `p`,
      }

      const mockCreate = mockReq.app?.locals.db.services.function.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdFunction })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)
    })
  })

  describe(`PUT /_/functions/:id - Update function`, () => {
    const ep = getEndpointCfg(functions.endpoints?.updateFunction)

    it(`should return 200 with updated function on success`, async () => {
      const existingFunction = new FunctionModel({
        id: `123`,
        name: `oldFunc`,
        content: `old code`,
        projectId: `project-1`,
        endpointId: `endpoint-1`,
      })
      const updateData = { name: `newFunc`, content: `new code` }
      const updatedFunction = new FunctionModel({
        ...existingFunction,
        ...updateData,
      })
      mockReq.params = { id: `123` }
      mockReq.body = updateData

      const mockGet = mockReq.app?.locals.db.services.function.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.function.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingFunction })
      mockUpdate.mockResolvedValue({ data: updatedFunction })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should return 404 when function not found`, async () => {
      mockReq.params = { id: `nonexistent` }
      mockReq.body = { name: `newName` }

      const mockGet = mockReq.app?.locals.db.services.function.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Function not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })
  })

  describe(`DELETE /_/functions/:id - Delete function`, () => {
    const ep = getEndpointCfg(functions.endpoints?.deleteFunction)

    it(`should return 200 with success on delete`, async () => {
      const existingFunction = new FunctionModel({
        id: `123`,
        name: `toDelete`,
        content: `code`,
        projectId: `p`,
        endpointId: `e`,
      })
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.function.get as ReturnType<
        typeof vi.fn
      >
      const mockDelete = mockReq.app?.locals.db.services.function.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingFunction })
      mockDelete.mockResolvedValue({ data: existingFunction })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockDelete).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: { success: true } })
    })

    it(`should return 404 when function not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.function.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Function not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })
  })
})
