import type { Response } from 'express'
import type { TAuthHeaderObj } from '@tdsk/domain'
import type { TApp, TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'

import { providers } from './providers'
import { Provider } from '@tdsk/domain'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
        auth: {
          orgId: `org-1`,
        },
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
    mockStatus = vi.fn(() => mockRes as Response) as ReturnType<typeof vi.fn>

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
      mockReq.params = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.provider.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockProviders })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        where: { orgId: `org-1` },
        limit: 50,
        offset: 0,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockProviders, limit: 50, offset: 0 })
    })

    it(`should return 400 when orgId is not provided`, async () => {
      const app = buildApp()
      app.locals.auth = {} as TAuthHeaderObj
      mockReq.query = {}
      mockReq.app = app
      const endpoint = providers.endpoints?.listProviders
      const epl = isFunc(endpoint) ? endpoint(app) : endpoint

      await expect(epl.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `orgId is required`
      )
    })

    it(`should return empty array when no providers found`, async () => {
      mockReq.params = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.provider.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: [], limit: 50, offset: 0 })
    })

    it(`should pass pagination params to list and include in response`, async () => {
      mockReq.params = { orgId: `org-1` }
      mockReq.query = { limit: `10`, offset: `20` }

      const mockList = mockReq.app?.locals.db.services.provider.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [] })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        where: { orgId: `org-1` },
        limit: 10,
        offset: 20,
      })
      const response = mockJson.mock.calls[0][0]
      expect(response.limit).toBe(10)
      expect(response.offset).toBe(20)
    })

    it(`should return 500 on database error`, async () => {
      mockReq.params = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.provider.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: new Error(`Database error`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database error`
      )
      expect(mockList).toHaveBeenCalledOnce()
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

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })

    it(`should return 500 on database error`, async () => {
      mockReq.params = { id: `prov-1` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ error: new Error(`Database error`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database error`
      )
      expect(mockGet).toHaveBeenCalledWith(`prov-1`)
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

    it(`should throw 400 when orgId is not provided`, async () => {
      mockReq.body = { name: `Provider`, type: `ai` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `orgId is required`
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

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })

    it(`should return 500 on get error`, async () => {
      mockReq.params = { id: `prov-1` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ error: new Error(`Database error`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database error`
      )
      expect(mockGet).toHaveBeenCalledWith(`prov-1`)
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

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Update failed`
      )
      expect(mockGet).toHaveBeenCalledWith(`prov-1`)
      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  describe(`POST /_/providers - Provider type validation`, () => {
    const ep = getEndpointCfg(providers.endpoints?.createProvider)

    it(`should throw 400 when type is missing`, async () => {
      mockReq.body = { name: `Provider`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Invalid provider type`
      )
    })

    it(`should throw 400 when type is invalid`, async () => {
      mockReq.body = { name: `Provider`, type: `invalid`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Invalid provider type`
      )
    })

    it(`should accept valid type "ai"`, async () => {
      mockReq.body = { name: `AI Provider`, type: `ai`, orgId: `org-1` }
      const mockCreate = mockReq.app?.locals.db.services.provider.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({
        data: new Provider({ id: `prov-1`, ...mockReq.body }),
      })

      await ep.action(mockReq as TRequest, mockRes as Response)
      expect(mockStatus).toHaveBeenCalledWith(201)
    })

    it(`should accept valid type "git"`, async () => {
      mockReq.body = { name: `Git Provider`, type: `git`, orgId: `org-1` }
      const mockCreate = mockReq.app?.locals.db.services.provider.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({
        data: new Provider({ id: `prov-1`, ...mockReq.body }),
      })

      await ep.action(mockReq as TRequest, mockRes as Response)
      expect(mockStatus).toHaveBeenCalledWith(201)
    })
  })

  describe(`PUT /_/providers/:id - Provider type validation on update`, () => {
    const ep = getEndpointCfg(providers.endpoints?.updateProvider)

    it(`should throw 400 when updating type to invalid value`, async () => {
      const existingProvider = new Provider({
        id: `prov-1`,
        name: `Provider`,
        type: `ai`,
        orgId: `org-1`,
      })
      mockReq.params = { id: `prov-1` }
      mockReq.body = { type: `invalid` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingProvider })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Invalid provider type`
      )
    })

    it(`should allow update without type field (name-only update)`, async () => {
      const existingProvider = new Provider({
        id: `prov-1`,
        name: `Old Name`,
        type: `ai`,
        orgId: `org-1`,
      })
      const updatedProvider = new Provider({
        id: `prov-1`,
        name: `New Name`,
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
      mockUpdate.mockResolvedValue({ data: updatedProvider })

      await ep.action(mockReq as TRequest, mockRes as Response)
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should allow updating type to a valid value`, async () => {
      const existingProvider = new Provider({
        id: `prov-1`,
        name: `Provider`,
        type: `ai`,
        orgId: `org-1`,
      })
      const updatedProvider = new Provider({
        id: `prov-1`,
        name: `Provider`,
        type: `git`,
        orgId: `org-1`,
      })
      mockReq.params = { id: `prov-1` }
      mockReq.body = { type: `git` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.provider.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingProvider })
      mockUpdate.mockResolvedValue({ data: updatedProvider })

      await ep.action(mockReq as TRequest, mockRes as Response)
      expect(mockStatus).toHaveBeenCalledWith(200)
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

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })

    it(`should return 500 on get error`, async () => {
      mockReq.params = { id: `prov-1` }

      const mockGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ error: new Error(`Database error`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database error`
      )
      expect(mockGet).toHaveBeenCalledWith(`prov-1`)
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

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Delete failed`
      )
      expect(mockGet).toHaveBeenCalledWith(`prov-1`)
      expect(mockDelete).toHaveBeenCalledWith(`prov-1`)
    })
  })
})
