import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'

import { endpoints } from './endpoints'
import { config } from '@TBE/configs/backend.config'
import { getEPService } from '@TBE/services/endpoints'
import { PaymentsService } from '@TBE/services/payments'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'

// Mock the endpoint services module
vi.mock(`@TBE/services/endpoints`, () => ({
  getEPService: vi.fn().mockReturnValue({
    validateOptions: vi.fn(),
  }),
}))

describe(`Endpoints endpoints`, () => {
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
            endpoint: {
              list: vi.fn(),
              get: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
            role: {
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
              getProjectRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
              isProjectMember: vi.fn().mockResolvedValue({ data: true }),
            },
          },
        },
      },
    } as unknown as TApp
  }

  const getEndpointCfg = (ep?: TEndpoint) => getEpCfg(buildApp(), ep)

  beforeEach(() => {
    // Reset the getEPService mock to default (no-op validateOptions)
    ;(getEPService as ReturnType<typeof vi.fn>).mockReturnValue({
      validateOptions: vi.fn(),
    })

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
      params: { projectId: `project-1` },
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
          method: `GET`,
          projectId: `project-1`,
          options: {
            url: `https://api.example.com/users`,
          },
        },
        {
          id: `2`,
          name: `Create User`,
          method: `POST`,
          projectId: `project-1`,
          options: {
            url: `https://api.example.com/users`,
          },
        },
      ]

      const mockList = mockReq.app?.locals.db.services.endpoint.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockEndpoints })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockEndpoints, limit: 50, offset: 0 })
    })

    it(`should filter by projectId when provided`, async () => {
      const mockEndpoints = [
        { id: `1`, name: `EP1`, method: `GET`, projectId: `project-1` },
      ]
      mockReq.params = { projectId: `project-1` }

      const mockList = mockReq.app?.locals.db.services.endpoint.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockEndpoints })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        where: { projectId: `project-1` },
        limit: 50,
        offset: 0,
      })
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].projectId).toBe(`project-1`)
    })

    it(`should pass pagination params to list and include in response`, async () => {
      mockReq.params = { projectId: `project-1` }
      mockReq.query = { limit: `10`, offset: `5` }

      const mockList = mockReq.app?.locals.db.services.endpoint.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [] })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        where: { projectId: `project-1` },
        limit: 10,
        offset: 5,
      })
      const response = mockJson.mock.calls[0][0]
      expect(response.limit).toBe(10)
      expect(response.offset).toBe(5)
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database connection failed`)

      const mockList = mockReq.app?.locals.db.services.endpoint.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: mockError })
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database connection failed`
      )
    })
  })

  describe(`GET /_/endpoints/:id - Get endpoint by ID`, () => {
    const ep = getEndpointCfg(endpoints.endpoints?.getEndpoint)

    it(`should return 200 with endpoint data when endpoint exists`, async () => {
      const mockEndpoint = {
        id: `123`,
        name: `Get Users`,
        method: `GET`,
        projectId: `project-1`,
        options: {
          url: `https://api.example.com/users`,
        },
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

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Endpoint not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })
  })

  describe(`POST /_/endpoints - Create endpoint`, () => {
    const ep = getEndpointCfg(endpoints.endpoints?.createEndpoint)

    it(`should return 201 with created endpoint on success`, async () => {
      const newEndpoint = {
        name: `New Endpoint`,
        type: `rest`,
        method: `GET`,
        projectId: `project-123`,
        options: {
          url: `https://api.example.com/new`,
        },
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
        type: `rest`,
        method: `GET`,
        projectId: `project-1`,
        options: {
          url: `https://api.example.com`,
        },
      }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Endpoint name is required`
      )
    })

    it(`should return 400 when url is missing`, async () => {
      mockReq.body = { name: `Test`, method: `GET`, projectId: `project-1` }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Endpoint type is required`
      )
    })

    it(`should return 400 when method is missing`, async () => {
      mockReq.body = {
        name: `Test`,
        type: `rest`,
        projectId: `project-1`,
        options: {
          url: `https://api.example.com`,
        },
      }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Endpoint method is required`
      )
    })

    it(`should return 400 when projectId is missing`, async () => {
      mockReq.params = {}
      mockReq.body = { name: `Test`, type: `rest`, method: `GET` }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Endpoint projectId is required`
      )
    })

    it(`should return 400 when method is invalid`, async () => {
      mockReq.body = {
        name: `Test`,
        type: `rest`,
        method: `INVALID`,
        projectId: `project-1`,
        options: {
          url: `https://api.example.com`,
        },
      }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Invalid HTTP method`
      )
    })

    it(`should accept headers and options`, async () => {
      const newEndpoint = {
        name: `New Endpoint`,
        type: `rest`,
        method: `POST`,
        projectId: `project-123`,
        headers: { [`Content-Type`]: `application/json` },
        options: {
          timeout: 5000,
          url: `https://api.example.com/new`,
        },
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
          headers: { [`Content-Type`]: `application/json` },
          options: { timeout: 5000, url: `https://api.example.com/new` },
        })
      )
    })

    it(`should accept valid object headers and options (BUG-001 fix)`, async () => {
      const newEndpoint = {
        name: `New Endpoint`,
        type: `rest`,
        method: `POST`,
        projectId: `project-123`,
        headers: { [`Content-Type`]: `application/json`, [`X-Custom`]: `value` },
        options: {
          timeout: 5000,
          url: `https://api.example.com/new`,
        },
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
    })

    it(`should reject non-object headers - string (BUG-001 fix)`, async () => {
      mockReq.body = {
        name: `Test`,
        type: `rest`,
        method: `POST`,
        projectId: `project-1`,
        headers: `not-an-object`,
        options: {
          url: `https://api.example.com`,
        },
      }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Headers must be an object`
      )
    })

    it(`should reject non-object headers - number (BUG-001 fix)`, async () => {
      mockReq.body = {
        name: `Test`,
        type: `rest`,
        method: `POST`,
        projectId: `project-1`,
        headers: 42,
        options: {
          url: `https://api.example.com`,
        },
      }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Headers must be an object`
      )
    })

    it(`should reject non-object headers - array (BUG-001 fix)`, async () => {
      mockReq.body = {
        name: `Test`,
        type: `rest`,
        method: `POST`,
        projectId: `project-1`,
        headers: [`a`, `b`],
        options: {
          url: `https://api.example.com`,
        },
      }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Headers must be an object`
      )
    })

    it(`should reject proxy endpoint without url in options`, async () => {
      const { getEPService } = await import(`@TBE/services/endpoints`)
      const mockGetService = getEPService as ReturnType<typeof vi.fn>
      mockGetService.mockReturnValue({
        validateOptions: vi.fn().mockImplementation((opts: any) => {
          if (!opts?.url) throw new Error(`Proxy endpoint requires a url in options`)
        }),
      })

      mockReq.body = {
        name: `Test Proxy`,
        type: `proxy`,
        method: `GET`,
        projectId: `project-1`,
        options: {},
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Proxy endpoint requires a url in options`
      )
    })

    it(`should reject faas endpoint without functionId in options`, async () => {
      const { getEPService } = await import(`@TBE/services/endpoints`)
      const mockGetService = getEPService as ReturnType<typeof vi.fn>
      mockGetService.mockReturnValue({
        validateOptions: vi.fn().mockImplementation((opts: any) => {
          if (!opts?.functionId)
            throw new Error(`FaaS endpoint requires a functionId in options`)
        }),
      })

      mockReq.body = {
        name: `Test FaaS`,
        type: `faas`,
        method: `POST`,
        projectId: `project-1`,
        options: {},
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `FaaS endpoint requires a functionId in options`
      )
    })
  })

  describe(`PUT /_/endpoints/:id - Update endpoint`, () => {
    const ep = getEndpointCfg(endpoints.endpoints?.updateEndpoint)

    it(`should return 200 with updated endpoint on success`, async () => {
      const existingEndpoint = {
        id: `123`,
        name: `Old Name`,
        method: `GET`,
        projectId: `project-1`,
        options: {
          url: `https://old.api.com`,
        },
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

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Endpoint not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })

    it(`should return 400 when method is invalid`, async () => {
      const existingEndpoint = {
        id: `123`,
        name: `Test`,
        method: `GET`,
        projectId: `project-1`,
        options: {
          url: `https://api.com`,
        },
      }
      mockReq.params = { id: `123` }
      mockReq.body = { method: `INVALID` }

      const mockGet = mockReq.app?.locals.db.services.endpoint.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingEndpoint })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Invalid HTTP method`
      )
    })

    it(`should store method in lowercase (method case fix)`, async () => {
      const existingEndpoint = {
        id: `123`,
        name: `Test`,
        type: `proxy`,
        method: `get`,
        projectId: `project-1`,
        options: { url: `https://api.com` },
      }
      mockReq.params = { id: `123` }
      mockReq.body = { method: `POST` }

      const mockGet = mockReq.app?.locals.db.services.endpoint.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.endpoint.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingEndpoint })
      mockUpdate.mockResolvedValue({ data: { ...existingEndpoint, method: `post` } })

      await ep.action(mockReq as TRequest, mockRes as Response)

      const updateCall = mockUpdate.mock.calls[0][0]
      expect(updateCall.method).toBe(`post`)
    })
  })

  describe(`DELETE /_/endpoints/:id - Delete endpoint`, () => {
    const ep = getEndpointCfg(endpoints.endpoints?.deleteEndpoint)

    it(`should return 200 with success on delete`, async () => {
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.endpoint.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: { id: `123` } })

      const mockDelete = mockReq.app?.locals.db.services.endpoint.delete as ReturnType<
        typeof vi.fn
      >
      mockDelete.mockResolvedValue({ data: true })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockDelete).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: { success: true, id: `123` } })
    })
  })
})
