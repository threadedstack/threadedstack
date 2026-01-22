import type { Response } from 'express'
import type { TApp, TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { apiKeys } from './apiKeys'
import { ApiKey } from '@tdsk/domain'
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

describe(`API Keys endpoints`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockSetHeader: ReturnType<typeof vi.fn>

  const mockApp = {
    locals: {
      config,
      payments: new PaymentsService(config.payments),
      db: {
        services: {
          apiKey: {
            list: vi.fn(),
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            revoke: vi.fn(),
          },
          role: {
            getOrgRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
            getProjectRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
          },
        },
      },
    },
  } as unknown as TApp

  const getEndpointCfg = (endpoint: TEndpoint): TEndpointConfig =>
    isFunc(endpoint) ? endpoint(mockApp) : endpoint

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
      app: mockApp,
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
      } as any,
      params: {},
      body: {},
      query: { orgId: `org-1` },
    }
  })

  describe(`Parent endpoint configuration`, () => {
    it(`should have correct configuration`, () => {
      expect(apiKeys.path).toBe(`/api-keys`)
      expect(apiKeys.method).toBe(`use`)
      expect(apiKeys.endpoints).toBeDefined()
      expect(apiKeys.endpoints?.listApiKeys).toBeDefined()
      expect(apiKeys.endpoints?.getApiKey).toBeDefined()
      expect(apiKeys.endpoints?.createApiKey).toBeDefined()
      expect(apiKeys.endpoints?.updateApiKey).toBeDefined()
      expect(apiKeys.endpoints?.deleteApiKey).toBeDefined()
    })
  })

  describe(`GET /_/api-keys - List API keys`, () => {
    const ep = getEndpointCfg(apiKeys.endpoints?.listApiKeys)

    it(`should return 200 with masked API key data`, async () => {
      const mockApiKeys = [
        new ApiKey({
          id: `1`,
          name: `Production Key`,
          keyHash: `abc123hash`,
          keyPrefix: `tdsk_prod`,
          scopes: `read,write`,
          active: true,
          orgId: `org-1`,
          createdAt: new Date(),
        }),
        new ApiKey({
          id: `2`,
          name: `Test Key`,
          keyHash: `def456hash`,
          keyPrefix: `tdsk_test`,
          scopes: `read`,
          active: true,
          projectId: `project-1`,
          createdAt: new Date(),
        }),
      ]

      const mockList = mockReq.app?.locals.db.services.apiKey.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockApiKeys })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(200)

      // Verify keyHash is not included in response
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData[0].keyHash).toBe(undefined)
      expect(responseData[0]).toHaveProperty(`keyPrefix`, `tdsk_prod`)
    })

    it(`should filter by orgId when provided`, async () => {
      const mockApiKeys = [
        new ApiKey({
          id: `1`,
          name: `K1`,
          keyHash: `h1`,
          keyPrefix: `p1`,
          orgId: `org-1`,
        }),
        new ApiKey({
          id: `2`,
          name: `K2`,
          keyHash: `h2`,
          keyPrefix: `p2`,
          orgId: `org-2`,
        }),
      ]
      mockReq.query = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.apiKey.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockApiKeys })
      await ep.action(mockReq as TRequest, mockRes as Response)

      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].orgId).toBe(`org-1`)
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database connection failed`)

      const mockList = mockReq.app?.locals.db.services.apiKey.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: mockError })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database connection failed` })
    })
  })

  describe(`GET /_/api-keys/:id - Get API key by ID`, () => {
    const ep = getEndpointCfg(apiKeys.endpoints?.getApiKey)

    it(`should return 200 with masked API key data`, async () => {
      const mockApiKey = new ApiKey({
        id: `123`,
        name: `My API Key`,
        keyHash: `secret_hash`,
        keyPrefix: `tdsk_myke`,
        scopes: `read`,
        active: true,
        orgId: `org-1`,
      })
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.apiKey.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockApiKey })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)

      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData.keyHash).toBe(undefined)
    })

    it(`should return 404 when API key not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.apiKey.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `API key not found` })
    })
  })

  describe(`POST /_/api-keys - Create API key`, () => {
    const ep = getEndpointCfg(apiKeys.endpoints?.createApiKey)

    it(`should return 201 with created API key including the raw key`, async () => {
      const newApiKey = { name: `New Key`, orgId: `org-123` }
      const createdApiKey = new ApiKey({
        id: `456`,
        name: `New Key`,
        keyHash: `some_hash`,
        keyPrefix: `tdsk_newk`,
        scopes: `read`,
        active: true,
        orgId: `org-123`,
        createdAt: new Date(),
      })
      mockReq.body = newApiKey

      const mockCreate = mockReq.app?.locals.db.services.apiKey.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdApiKey })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)

      // Verify the raw key is returned
      const response = mockJson.mock.calls[0][0]
      expect(response.data).toHaveProperty(`key`)
      expect(response.data.key).toMatch(/^tdsk_/)
      expect(response.warning).toContain(`not be shown again`)
    })

    it(`should return 400 when name is missing`, async () => {
      mockReq.body = { orgId: `org-1` }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `API key name is required` })
    })

    it(`should return 400 when neither orgId nor projectId is provided`, async () => {
      mockReq.body = { name: `KEY` }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: `API key must belong to an org or project`,
      })
    })

    it(`should return 400 when both orgId and projectId are provided`, async () => {
      mockReq.body = { name: `KEY`, orgId: `org-1`, projectId: `project-1` }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: `API key can only belong to one of: org or project (exclusive arc)`,
      })
    })

    it(`should return 400 when scopes are invalid`, async () => {
      mockReq.body = { name: `KEY`, orgId: `org-1`, scopes: `invalid_scope` }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson.mock.calls[0][0].error).toContain(`Invalid scopes`)
    })

    it(`should accept custom scopes`, async () => {
      mockReq.body = { name: `Admin Key`, orgId: `org-123`, scopes: `read,write,admin` }
      const createdApiKey = new ApiKey({
        id: `789`,
        name: `Admin Key`,
        keyHash: `hash`,
        keyPrefix: `tdsk_admi`,
        scopes: `read,write,admin`,
        active: true,
        orgId: `org-123`,
      })

      const mockCreate = mockReq.app?.locals.db.services.apiKey.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdApiKey })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: `read,write,admin`,
        })
      )
    })

    it(`should accept expiration date`, async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString() // 1 day from now
      mockReq.body = { name: `Temp Key`, orgId: `org-123`, expiresAt: futureDate }
      const createdApiKey = new ApiKey({
        id: `101`,
        name: `Temp Key`,
        keyHash: `hash`,
        keyPrefix: `tdsk_temp`,
        scopes: `read`,
        active: true,
        orgId: `org-123`,
        expiresAt: new Date(futureDate),
      })

      const mockCreate = mockReq.app?.locals.db.services.apiKey.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdApiKey })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: expect.any(Date),
        })
      )
    })

    it(`should return 400 when expiration date is in the past`, async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString()
      mockReq.body = { name: `Expired Key`, orgId: `org-1`, expiresAt: pastDate }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: `Expiration date must be in the future`,
      })
    })
  })

  describe(`PUT /_/api-keys/:id - Update API key`, () => {
    const ep = getEndpointCfg(apiKeys.endpoints?.updateApiKey)

    it(`should return 200 with updated API key`, async () => {
      const existingApiKey = new ApiKey({
        id: `123`,
        name: `Old Name`,
        keyHash: `hash`,
        keyPrefix: `tdsk_old_`,
        scopes: `read`,
        active: true,
        orgId: `org-1`,
      })
      const updateData = { name: `New Name`, scopes: `read,write` }
      const updatedApiKey = { ...existingApiKey, ...updateData }
      mockReq.params = { id: `123` }
      mockReq.body = updateData

      const mockGet = mockReq.app?.locals.db.services.apiKey.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.apiKey.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingApiKey })
      mockUpdate.mockResolvedValue({ data: updatedApiKey })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should return 404 when API key not found`, async () => {
      mockReq.params = { id: `nonexistent` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.apiKey.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `API key not found` })
    })

    it(`should return 400 when scopes are invalid`, async () => {
      const existingApiKey = new ApiKey({
        id: `123`,
        name: `Key`,
        keyHash: `hash`,
        keyPrefix: `p`,
        scopes: `read`,
        orgId: `org-1`,
      })
      mockReq.params = { id: `123` }
      mockReq.body = { scopes: `invalid` }

      const mockGet = mockReq.app?.locals.db.services.apiKey.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingApiKey })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
    })
  })

  describe(`DELETE /_/api-keys/:id - Revoke API key`, () => {
    const ep = getEndpointCfg(apiKeys.endpoints?.deleteApiKey)

    it(`should return 200 with success on revoke`, async () => {
      const existingApiKey = new ApiKey({
        id: `123`,
        name: `To Revoke`,
        keyHash: `h`,
        keyPrefix: `p`,
        orgId: `o`,
      })
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.apiKey.get as ReturnType<
        typeof vi.fn
      >
      const mockRevoke = mockReq.app?.locals.db.services.apiKey.revoke as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingApiKey })
      mockRevoke.mockResolvedValue({ data: { ...existingApiKey, active: false } })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockRevoke).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: { success: true, id: `123` } })
    })

    it(`should return 404 when API key not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.apiKey.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `API key not found` })
    })
  })
})
