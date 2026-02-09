import type { Response } from 'express'
import type { TApp, TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { configs } from './configs'
import { Config } from '@tdsk/domain'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'

describe(`Configs endpoints`, () => {
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
            config: {
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
    mockStatus = vi.fn(() => mockRes as Response) as ReturnType<typeof vi.fn>

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
      expect(configs.path).toBe(`/configs`)
      expect(configs.method).toBe(`use`)
      expect(configs.endpoints).toBeDefined()
      expect(configs.endpoints?.listConfigs).toBeDefined()
      expect(configs.endpoints?.getConfig).toBeDefined()
      expect(configs.endpoints?.createConfig).toBeDefined()
      expect(configs.endpoints?.updateConfig).toBeDefined()
      expect(configs.endpoints?.deleteConfig).toBeDefined()
    })
  })

  describe(`GET /_/configs - List configs`, () => {
    const ep = getEndpointCfg(configs.endpoints?.listConfigs)

    it(`should return 200 with configs on success`, async () => {
      const mockConfigs = [
        new Config({
          id: `1`,
          data: { theme: `dark` },
          orgId: `org-1`,
          createdAt: new Date(),
        }),
      ]

      const mockList = mockReq.app?.locals.db.services.config.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockConfigs })
      mockReq.query = { orgId: `org-1` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalled()
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].orgId).toBe(`org-1`)
    })

    it(`should return 400 when no scope parameter provided`, async () => {
      mockReq.query = {}

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `An orgId, projectId, or userId query parameter required`
      )
    })

    it(`should filter by projectId when provided`, async () => {
      const mockConfigs = [new Config({ id: `1`, data: {}, projectId: `project-1` })]
      mockReq.query = { projectId: `project-1` }

      const mockList = mockReq.app?.locals.db.services.config.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockConfigs })
      await ep.action(mockReq as TRequest, mockRes as Response)

      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].projectId).toBe(`project-1`)
    })

    it(`should pass pagination params to list and include in response`, async () => {
      mockReq.query = { orgId: `org-1`, limit: `20`, offset: `5` }

      const mockList = mockReq.app?.locals.db.services.config.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [] })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        where: { orgId: `org-1` },
        limit: 20,
        offset: 5,
      })
      const response = mockJson.mock.calls[0][0]
      expect(response.limit).toBe(20)
      expect(response.offset).toBe(5)
    })

    it(`should return 500 on database error`, async () => {
      const mockError = new Error(`Database connection failed`)
      mockReq.query = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.config.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: mockError })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database connection failed`
      )
      expect(mockList).toHaveBeenCalledOnce()
    })
  })

  describe(`GET /_/configs/:id - Get config by ID`, () => {
    const ep = getEndpointCfg(configs.endpoints?.getConfig)

    it(`should return 200 with config when found`, async () => {
      const mockConfig = new Config({
        id: `123`,
        data: { setting: `value` },
        orgId: `org-1`,
      })
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.config.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockConfig })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockConfig })
    })

    it(`should return 404 when config not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.config.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Config not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })
  })

  describe(`POST /_/configs - Create config`, () => {
    const ep = getEndpointCfg(configs.endpoints?.createConfig)

    it(`should return 201 with created config on success`, async () => {
      const newConfig = { data: { key: `value` }, orgId: `org-123` }
      const createdConfig = new Config({
        id: `456`,
        data: { key: `value` },
        orgId: `org-123`,
      })
      mockReq.body = newConfig

      const mockCreate = mockReq.app?.locals.db.services.config.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdConfig })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdConfig })
    })

    it(`should return 400 when data is missing`, async () => {
      mockReq.body = { orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Config data is required`
      )
    })

    it(`should return 400 when no scope is provided`, async () => {
      mockReq.body = { data: { key: `value` } }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Config must belong to one of: orgId, userId, projectId`
      )
    })

    it(`should return 400 when multiple scopes are provided`, async () => {
      mockReq.body = {
        data: { key: `value` },
        orgId: `org-1`,
        projectId: `project-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Config can only belong to one of: orgId, userId, projectId (exclusive arc)`
      )
    })
  })

  describe(`PUT /_/configs/:id - Update config`, () => {
    const ep = getEndpointCfg(configs.endpoints?.updateConfig)

    it(`should return 200 with updated config on success`, async () => {
      const existingConfig = new Config({
        id: `123`,
        data: { old: `value` },
        orgId: `org-1`,
      })
      const updateData = { data: { new: `value` } }
      const updatedConfig = new Config({
        id: `123`,
        data: { new: `value` },
        orgId: `org-1`,
      })
      mockReq.params = { id: `123` }
      mockReq.body = updateData

      const mockGet = mockReq.app?.locals.db.services.config.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.config.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingConfig })
      mockUpdate.mockResolvedValue({ data: updatedConfig })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should return 404 when config not found`, async () => {
      mockReq.params = { id: `nonexistent` }
      mockReq.body = { data: { new: `value` } }

      const mockGet = mockReq.app?.locals.db.services.config.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Config not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })
  })

  describe(`DELETE /_/configs/:id - Delete config`, () => {
    const ep = getEndpointCfg(configs.endpoints?.deleteConfig)

    it(`should return 200 with success on delete`, async () => {
      const existingConfig = new Config({
        id: `123`,
        data: { to: `delete` },
        orgId: `org-1`,
      })
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.config.get as ReturnType<
        typeof vi.fn
      >
      const mockDelete = mockReq.app?.locals.db.services.config.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingConfig })
      mockDelete.mockResolvedValue({ data: existingConfig })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockDelete).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: { success: true } })
    })

    it(`should return 404 when config not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.config.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Config not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })
  })
})
