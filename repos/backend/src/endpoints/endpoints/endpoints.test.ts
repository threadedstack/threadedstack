import type { Response } from 'express'
import type { TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { endpoints } from './endpoints'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { config } from '@TBE/configs/backend.config'

describe(`Endpoints endpoints`, () => {
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
              endpoint: {
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
      query: {},
    }
  })

  describe(`Parent endpoint configuration`, () => {
    it(`should have correct configuration`, () => {
      expect(endpoints.path).toBe(`/endpoints`)
      expect(endpoints.method).toBe(`use`)
      expect(endpoints.endpoints).toBeDefined()
      expect(endpoints.endpoints?.listEndpoints).toBeDefined()
      expect(endpoints.endpoints?.getEndpoint).toBeDefined()
      expect(endpoints.endpoints?.createEndpoint).toBeDefined()
      expect(endpoints.endpoints?.updateEndpoint).toBeDefined()
      expect(endpoints.endpoints?.deleteEndpoint).toBeDefined()
    })
  })

  describe(`GET /_/endpoints - List endpoints`, () => {
    const ep = getEndpointCfg(endpoints.endpoints?.listEndpoints)

    it(`should return 200 with endpoint data on success`, async () => {
      const mockEndpoints = [
        {
          id: `1`,
          name: `Get Users`,
          url: `https://api.example.com/users`,
          method: `GET`,
          projectId: `project-1`,
        },
        {
          id: `2`,
          name: `Create User`,
          url: `https://api.example.com/users`,
          method: `POST`,
          projectId: `project-1`,
        },
      ]

      const mockList = mockReq.app?.locals.db.services.endpoint.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockEndpoints })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockEndpoints })
    })

    it(`should filter by projectId when provided`, async () => {
      const mockEndpoints = [
        { id: `1`, name: `EP1`, url: `u1`, method: `GET`, projectId: `project-1` },
        { id: `2`, name: `EP2`, url: `u2`, method: `GET`, projectId: `project-2` },
      ]
      mockReq.query = { projectId: `project-1` }

      const mockList = mockReq.app?.locals.db.services.endpoint.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockEndpoints })
      await ep.action(mockReq as TRequest, mockRes as Response)

      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].projectId).toBe('project-1')
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database connection failed`)

      const mockList = mockReq.app?.locals.db.services.endpoint.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: mockError })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database connection failed` })
    })
  })

  describe(`GET /_/endpoints/:id - Get endpoint by ID`, () => {
    const ep = getEndpointCfg(endpoints.endpoints?.getEndpoint)

    it(`should return 200 with endpoint data when endpoint exists`, async () => {
      const mockEndpoint = {
        id: `123`,
        name: `Get Users`,
        url: `https://api.example.com/users`,
        method: `GET`,
        projectId: `project-1`,
      }
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.endpoint.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockEndpoint })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockEndpoint })
    })

    it(`should return 404 when endpoint not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.endpoint.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Endpoint not found` })
    })
  })

  describe(`POST /_/endpoints - Create endpoint`, () => {
    const ep = getEndpointCfg(endpoints.endpoints?.createEndpoint)

    it(`should return 201 with created endpoint on success`, async () => {
      const newEndpoint = {
        name: `New Endpoint`,
        url: `https://api.example.com/new`,
        method: `GET`,
        projectId: `project-123`,
      }
      const createdEndpoint = { id: `456`, ...newEndpoint }
      mockReq.body = newEndpoint

      const mockCreate = mockReq.app?.locals.db.services.endpoint.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdEndpoint })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdEndpoint })
    })

    it(`should return 400 when name is missing`, async () => {
      mockReq.body = {
        url: `https://api.example.com`,
        method: `GET`,
        projectId: `project-1`,
      }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Endpoint name is required` })
    })

    it(`should return 400 when url is missing`, async () => {
      mockReq.body = { name: `Test`, method: `GET`, projectId: `project-1` }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Endpoint URL is required` })
    })

    it(`should return 400 when method is missing`, async () => {
      mockReq.body = {
        name: `Test`,
        url: `https://api.example.com`,
        projectId: `project-1`,
      }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Endpoint method is required` })
    })

    it(`should return 400 when projectId is missing`, async () => {
      mockReq.body = { name: `Test`, url: `https://api.example.com`, method: `GET` }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Endpoint projectId is required` })
    })

    it(`should return 400 when method is invalid`, async () => {
      mockReq.body = {
        name: `Test`,
        url: `https://api.example.com`,
        method: `INVALID`,
        projectId: `project-1`,
      }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson.mock.calls[0][0].error).toContain(`Invalid HTTP method`)
    })

    it(`should accept headers and options`, async () => {
      const newEndpoint = {
        name: `New Endpoint`,
        url: `https://api.example.com/new`,
        method: `POST`,
        projectId: `project-123`,
        headers: { 'Content-Type': 'application/json' },
        options: { timeout: 5000 },
      }
      const createdEndpoint = { id: `456`, ...newEndpoint }
      mockReq.body = newEndpoint

      const mockCreate = mockReq.app?.locals.db.services.endpoint.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdEndpoint })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
          options: { timeout: 5000 },
        })
      )
    })
  })

  describe(`PUT /_/endpoints/:id - Update endpoint`, () => {
    const ep = getEndpointCfg(endpoints.endpoints?.updateEndpoint)

    it(`should return 200 with updated endpoint on success`, async () => {
      const existingEndpoint = {
        id: `123`,
        name: `Old Name`,
        url: `https://old.api.com`,
        method: `GET`,
        projectId: `project-1`,
      }
      const updateData = { name: `New Name` }
      const updatedEndpoint = { ...existingEndpoint, ...updateData }
      mockReq.params = { id: `123` }
      mockReq.body = updateData

      const mockGet = mockReq.app?.locals.db.services.endpoint.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.endpoint.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingEndpoint })
      mockUpdate.mockResolvedValue({ data: updatedEndpoint })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: updatedEndpoint })
    })

    it(`should return 404 when endpoint not found`, async () => {
      mockReq.params = { id: `nonexistent` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.endpoint.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Endpoint not found` })
    })

    it(`should return 400 when method is invalid`, async () => {
      const existingEndpoint = {
        id: `123`,
        name: `Test`,
        url: `https://api.com`,
        method: `GET`,
        projectId: `project-1`,
      }
      mockReq.params = { id: `123` }
      mockReq.body = { method: `INVALID` }

      const mockGet = mockReq.app?.locals.db.services.endpoint.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingEndpoint })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson.mock.calls[0][0].error).toContain(`Invalid HTTP method`)
    })
  })

  describe(`DELETE /_/endpoints/:id - Delete endpoint`, () => {
    const ep = getEndpointCfg(endpoints.endpoints?.deleteEndpoint)

    it(`should return 200 with success on delete`, async () => {
      const existingEndpoint = {
        id: `123`,
        name: `To Delete`,
        url: `https://api.com`,
        method: `GET`,
        projectId: `project-1`,
      }
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.endpoint.get as ReturnType<
        typeof vi.fn
      >
      const mockDelete = mockReq.app?.locals.db.services.endpoint.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingEndpoint })
      mockDelete.mockResolvedValue({ data: existingEndpoint })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockDelete).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: { success: true, id: `123` } })
    })

    it(`should return 404 when endpoint not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.endpoint.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Endpoint not found` })
    })
  })
})
