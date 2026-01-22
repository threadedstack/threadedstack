import type { Response } from 'express'
import type { TApp, TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { providers } from './providers'
import { Provider } from '@tdsk/domain'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn().mockResolvedValue(undefined),
}))

describe(`Providers endpoints`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockSetHeader: ReturnType<typeof vi.fn>

  const buildApp = () => {
    return {
      locals: {
        config,
        payments: new PaymentsService(config.payments),
        db: {
          services: {
            provider: {
              list: vi.fn(),
              get: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
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

  const getEndpointCfg = (endpoint: TEndpoint): TEndpointConfig =>
    isFunc(endpoint) ? endpoint(buildApp()) : endpoint

  beforeEach(() => {
    mockJson = vi.fn()
    mockSetHeader = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response)

    mockRes = {
      status: mockStatus,
      json: mockJson,
      setHeader: mockSetHeader,
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

    vi.clearAllMocks()
  })

  describe(`Parent endpoint configuration`, () => {
    it(`should have correct configuration`, () => {
      expect(providers.path).toBe(`/providers`)
      expect(providers.method).toBe(`use`)
      expect(providers.endpoints).toBeDefined()
      expect(providers.endpoints?.getProvider).toBeDefined()
      expect(providers.endpoints?.listProviders).toBeDefined()
      expect(providers.endpoints?.createProvider).toBeDefined()
      expect(providers.endpoints?.updateProvider).toBeDefined()
      expect(providers.endpoints?.deleteProvider).toBeDefined()
    })
  })

  describe(`GET /_/providers - List Providers`, () => {
    const ep = getEndpointCfg(providers.endpoints?.listProviders)

    it(`should return 200 with providers for orgId`, async () => {
      const mockProviders = [
        new Provider({
          id: `prov-1`,
          name: `OpenAI`,
          type: `ai`,
          orgId: `org-1`,
        }),
        new Provider({
          id: `prov-2`,
          name: `Anthropic`,
          type: `ai`,
          orgId: `org-1`,
        }),
      ]
      mockReq.query = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.provider.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockProviders })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({ orgId: `org-1`, projectId: undefined })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockProviders })
    })

    it(`should return 200 with providers for projectId`, async () => {
      const mockProviders = [
        new Provider({
          id: `prov-1`,
          name: `AWS`,
          type: `ai`,
          projectId: `proj-1`,
        }),
      ]
      mockReq.query = { projectId: `proj-1` }

      const mockList = mockReq.app?.locals.db.services.provider.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockProviders })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({ orgId: undefined, projectId: `proj-1` })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockProviders })
    })

    it(`should return 400 when neither orgId nor projectId provided`, async () => {
      mockReq.query = {}

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: `orgId or projectId query parameter required`,
      })
    })

    it(`should return empty array when no providers found`, async () => {
      mockReq.query = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.provider.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: [] })
    })

    it(`should return 500 on database error`, async () => {
      mockReq.query = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.provider.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: new Error(`Database error`) })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database error` })
    })
  })

  describe(`GET /_/providers/:id - Get Provider`, () => {
    const ep = getEndpointCfg(providers.endpoints?.getProvider)

    it(`should return 200 with provider data`, async () => {
      const mockProvider = new Provider({
        id: `prov-1`,
        name: `OpenAI`,
        type: `ai`,
        orgId: `org-1`,
      })
      mockReq.params = { id: `prov-1` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockProvider })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`prov-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockProvider })
    })

    it(`should return 404 when provider not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Provider not found` })
    })

    it(`should return 500 on database error`, async () => {
      mockReq.params = { id: `prov-1` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ error: new Error(`Database error`) })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database error` })
    })
  })

  describe(`POST /_/providers - Create Provider`, () => {
    const ep = getEndpointCfg(providers.endpoints?.createProvider)

    it(`should return 201 with created provider for orgId`, async () => {
      const providerData = {
        name: `New Provider`,
        type: `ai` as const,
        orgId: `org-1`,
      }
      const createdProvider = new Provider({
        id: `prov-new`,
        ...providerData,
      })
      mockReq.body = providerData

      const mockCreate = mockReq.app?.locals.db.services.provider.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdProvider })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledWith(providerData)
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdProvider })
    })

    it(`should return 201 with created provider for projectId`, async () => {
      const providerData = {
        name: `Project Provider`,
        type: `ai` as const,
        projectId: `proj-1`,
      }
      const createdProvider = new Provider({
        id: `prov-new`,
        ...providerData,
      })
      mockReq.body = providerData

      const mockCreate = mockReq.app?.locals.db.services.provider.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdProvider })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledWith(providerData)
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdProvider })
    })

    it(`should throw 400 when neither orgId nor projectId provided`, async () => {
      mockReq.body = { name: `Provider`, type: `ai` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider must belong to an org or project (orgId or projectId required)`
      )
    })

    it(`should throw 400 when both orgId and projectId provided`, async () => {
      mockReq.body = {
        name: `Provider`,
        type: `ai`,
        orgId: `org-1`,
        projectId: `proj-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider cannot belong to both org and project (provide only one)`
      )
    })

    it(`should throw 500 on database error`, async () => {
      mockReq.body = {
        name: `Provider`,
        type: `ai`,
        orgId: `org-1`,
      }

      const mockCreate = mockReq.app?.locals.db.services.provider.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ error: new Error(`Database error`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database error`
      )
    })
  })

  describe(`PUT /_/providers/:id - Update Provider`, () => {
    const ep = getEndpointCfg(providers.endpoints?.updateProvider)

    it(`should return 200 with updated provider`, async () => {
      const existingProvider = new Provider({
        id: `prov-1`,
        name: `Old Name`,
        type: `ai`,
        orgId: `org-1`,
      })
      const updateData = { name: `New Name` }
      const updatedProvider = new Provider({
        ...existingProvider,
        ...updateData,
      })
      mockReq.params = { id: `prov-1` }
      mockReq.body = updateData

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.provider.update as ReturnType<
        typeof vi.fn
      >

      mockGet.mockResolvedValue({ data: existingProvider })
      mockUpdate.mockResolvedValue({ data: updatedProvider })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`prov-1`)
      expect(mockUpdate).toHaveBeenCalledWith({ ...updateData, id: `prov-1` })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: updatedProvider })
    })

    it(`should return 404 when provider not found`, async () => {
      mockReq.params = { id: `nonexistent` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Provider not found` })
    })

    it(`should return 500 on get error`, async () => {
      mockReq.params = { id: `prov-1` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ error: new Error(`Database error`) })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database error` })
    })

    it(`should return 500 on update error`, async () => {
      const existingProvider = new Provider({
        id: `prov-1`,
        name: `Old Name`,
        type: `ai`,
        orgId: `org-1`,
      })
      mockReq.params = { id: `prov-1` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.provider.update as ReturnType<
        typeof vi.fn
      >

      mockGet.mockResolvedValue({ data: existingProvider })
      mockUpdate.mockResolvedValue({ error: new Error(`Update failed`) })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Update failed` })
    })
  })

  describe(`DELETE /_/providers/:id - Delete Provider`, () => {
    const ep = getEndpointCfg(providers.endpoints?.deleteProvider)

    it(`should return 200 with success on delete`, async () => {
      const existingProvider = new Provider({
        id: `prov-1`,
        name: `Provider`,
        type: `ai`,
        orgId: `org-1`,
      })
      mockReq.params = { id: `prov-1` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      const mockDelete = mockReq.app?.locals.db.services.provider.delete as ReturnType<
        typeof vi.fn
      >

      mockGet.mockResolvedValue({ data: existingProvider })
      mockDelete.mockResolvedValue({ data: existingProvider })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`prov-1`)
      expect(mockDelete).toHaveBeenCalledWith(`prov-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: { success: true, id: `prov-1` } })
    })

    it(`should return 404 when provider not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Provider not found` })
    })

    it(`should return 500 on get error`, async () => {
      mockReq.params = { id: `prov-1` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ error: new Error(`Database error`) })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database error` })
    })

    it(`should return 500 on delete error`, async () => {
      const existingProvider = new Provider({
        id: `prov-1`,
        name: `Provider`,
        type: `ai`,
        orgId: `org-1`,
      })
      mockReq.params = { id: `prov-1` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      const mockDelete = mockReq.app?.locals.db.services.provider.delete as ReturnType<
        typeof vi.fn
      >

      mockGet.mockResolvedValue({ data: existingProvider })
      mockDelete.mockResolvedValue({ error: new Error(`Delete failed`) })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Delete failed` })
    })
  })
})
