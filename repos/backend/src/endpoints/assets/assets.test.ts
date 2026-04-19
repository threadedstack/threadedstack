import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { assets } from './assets'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock(`@TDB/configs/db.config`, () => ({
  config: {
    logger: { label: `db`, level: `error` },
  },
}))

describe(`Asset endpoints`, () => {
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
            asset: {
              list: vi.fn(),
              get: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
            thread: {
              get: vi.fn(),
            },
            message: {
              get: vi.fn(),
            },
            project: {
              get: vi.fn(),
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

  const getEndpointCfg = (ep?: TEndpoint) => getEpCfg(buildApp(), ep)

  beforeEach(() => {
    vi.clearAllMocks()
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

  // ── PARENT CONFIG ─────────────────────────────────────────────────

  describe(`Parent endpoint configuration`, () => {
    it(`should have correct path and method`, () => {
      expect(assets.path).toBe(`/assets`)
      expect(assets.method).toBe(`use`)
      expect(assets.endpoints).toBeDefined()
    })

    it(`should have all 5 endpoint configs`, () => {
      const keys = Object.keys(assets.endpoints || {})
      expect(keys).toHaveLength(5)
      expect(keys).toContain(`listAssets`)
      expect(keys).toContain(`getAsset`)
      expect(keys).toContain(`createAsset`)
      expect(keys).toContain(`updateAsset`)
      expect(keys).toContain(`deleteAsset`)
    })
  })

  // ── LIST ASSETS ────────────────────────────────────────────────────

  describe(`GET / - List assets`, () => {
    const ep = getEndpointCfg(assets.endpoints?.listAssets)

    it(`should return 200 with assets for orgId filter`, async () => {
      const mockAssets = [
        { id: `a-1`, name: `Asset 1`, type: `document`, orgId: `org-1` },
        { id: `a-2`, name: `Asset 2`, type: `image`, orgId: `org-1` },
      ]

      const mockList = mockReq.app?.locals.db.services.asset.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockAssets })
      mockReq.query = { orgId: `org-1` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        where: { orgId: `org-1` },
        limit: 50,
        offset: 0,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockAssets, limit: 50, offset: 0 })
    })

    it(`should filter by threadId`, async () => {
      const mockThread = { id: `t-1`, orgId: `org-1` }
      const mockThreadGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockThreadGet.mockResolvedValue({ data: mockThread })

      const mockList = mockReq.app?.locals.db.services.asset.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [] })
      mockReq.query = { threadId: `t-1` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockThreadGet).toHaveBeenCalledWith(`t-1`)
      expect(mockList).toHaveBeenCalledWith({
        where: { threadId: `t-1` },
        limit: 50,
        offset: 0,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should filter by messageId`, async () => {
      const mockMessage = { id: `m-1`, orgId: `org-1` }
      const mockMessageGet = mockReq.app?.locals.db.services.message.get as ReturnType<
        typeof vi.fn
      >
      mockMessageGet.mockResolvedValue({ data: mockMessage })

      const mockList = mockReq.app?.locals.db.services.asset.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [] })
      mockReq.query = { messageId: `m-1` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockMessageGet).toHaveBeenCalledWith(`m-1`)
      expect(mockList).toHaveBeenCalledWith({
        where: { messageId: `m-1` },
        limit: 50,
        offset: 0,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should respect custom pagination params`, async () => {
      const mockList = mockReq.app?.locals.db.services.asset.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [] })
      mockReq.query = { orgId: `org-1`, limit: `10`, offset: `20` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        where: { orgId: `org-1` },
        limit: 10,
        offset: 20,
      })
      expect(mockJson).toHaveBeenCalledWith({ data: [], limit: 10, offset: 20 })
    })

    it(`should return empty array when data is null`, async () => {
      const mockList = mockReq.app?.locals.db.services.asset.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: null })
      mockReq.query = { orgId: `org-1` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: [], limit: 50, offset: 0 })
    })

    it(`should throw 400 when no filter is provided`, async () => {
      mockReq.query = {}

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `At least one filter is required`
      )
    })

    it(`should throw 404 when threadId references non-existent thread`, async () => {
      const mockThreadGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockThreadGet.mockResolvedValue({ data: null })
      mockReq.query = { threadId: `t-nonexistent` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 404 when messageId references non-existent message`, async () => {
      const mockMessageGet = mockReq.app?.locals.db.services.message.get as ReturnType<
        typeof vi.fn
      >
      mockMessageGet.mockResolvedValue({ data: null })
      mockReq.query = { messageId: `m-nonexistent` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Message not found`
      )
    })

    it(`should throw 500 on database error`, async () => {
      const mockList = mockReq.app?.locals.db.services.asset.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: new Error(`DB failure`) })
      mockReq.query = { orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `DB failure`
      )
    })
  })

  // ── GET ASSET ──────────────────────────────────────────────────────

  describe(`GET /:id - Get asset`, () => {
    const ep = getEndpointCfg(assets.endpoints?.getAsset)

    it(`should return 200 with asset data`, async () => {
      const mockAsset = {
        id: `a-1`,
        name: `Document`,
        type: `document`,
        orgId: `org-1`,
        url: `https://example.com/doc.pdf`,
      }

      const mockGet = mockReq.app?.locals.db.services.asset.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockAsset })
      mockReq.params = { id: `a-1` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`a-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockAsset })
    })

    it(`should throw 404 when asset is not found`, async () => {
      const mockGet = mockReq.app?.locals.db.services.asset.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: null })
      mockReq.params = { id: `a-nonexistent` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Asset not found`
      )
    })

    it(`should throw 500 on database error`, async () => {
      const mockGet = mockReq.app?.locals.db.services.asset.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ error: new Error(`DB error`) })
      mockReq.params = { id: `a-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `DB error`
      )
    })
  })

  // ── CREATE ASSET ───────────────────────────────────────────────────

  describe(`POST / - Create asset`, () => {
    const ep = getEndpointCfg(assets.endpoints?.createAsset)

    it(`should return 201 with created asset`, async () => {
      const createdAsset = {
        id: `a-new`,
        name: `New Asset`,
        type: `document`,
        orgId: `org-1`,
        url: `https://example.com/new.pdf`,
      }

      const mockCreate = mockReq.app?.locals.db.services.asset.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdAsset })
      mockReq.body = {
        name: `New Asset`,
        type: `document`,
        orgId: `org-1`,
        url: `https://example.com/new.pdf`,
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdAsset })
    })

    it(`should create asset with threadId owner`, async () => {
      const createdAsset = {
        id: `a-new`,
        name: `Thread Asset`,
        type: `image`,
        threadId: `t-1`,
      }

      const mockCreate = mockReq.app?.locals.db.services.asset.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdAsset })
      mockReq.body = {
        name: `Thread Asset`,
        type: `image`,
        threadId: `t-1`,
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(201)
    })

    it(`should create asset with messageId owner`, async () => {
      const createdAsset = {
        id: `a-new`,
        name: `Message Asset`,
        type: `file`,
        messageId: `m-1`,
      }

      const mockCreate = mockReq.app?.locals.db.services.asset.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdAsset })
      mockReq.body = {
        name: `Message Asset`,
        type: `file`,
        messageId: `m-1`,
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(201)
    })

    it(`should throw 400 when name is missing`, async () => {
      mockReq.body = { type: `document`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Asset name is required`
      )
    })

    it(`should throw 400 when type is missing`, async () => {
      mockReq.body = { name: `Asset`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Asset type is required`
      )
    })

    it(`should throw 400 when no owner field is provided (exclusive arc)`, async () => {
      mockReq.body = { name: `Asset`, type: `document` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Asset must belong to one of`
      )
    })

    it(`should throw 400 when multiple owner fields are provided (exclusive arc)`, async () => {
      mockReq.body = {
        name: `Asset`,
        type: `document`,
        orgId: `org-1`,
        projectId: `proj-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Asset can only belong to one of`
      )
    })

    it(`should throw 500 on database create error`, async () => {
      const mockCreate = mockReq.app?.locals.db.services.asset.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ error: new Error(`Create failed`) })
      mockReq.body = {
        name: `Asset`,
        type: `document`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Create failed`
      )
    })

    it(`should create asset with projectId owner`, async () => {
      const createdAsset = {
        id: `a-new`,
        name: `Project Asset`,
        type: `document`,
        projectId: `proj-1`,
      }

      const mockCreate = mockReq.app?.locals.db.services.asset.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdAsset })
      mockReq.body = {
        name: `Project Asset`,
        type: `document`,
        projectId: `proj-1`,
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(201)
    })

    it(`should create asset with userId owner matching authenticated user`, async () => {
      const createdAsset = {
        id: `a-new`,
        name: `User Asset`,
        type: `image`,
        userId: `test-user-id`,
      }

      const mockCreate = mockReq.app?.locals.db.services.asset.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdAsset })
      mockReq.body = {
        name: `User Asset`,
        type: `image`,
        userId: `test-user-id`,
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(201)
    })
  })

  // ── UPDATE ASSET ───────────────────────────────────────────────────

  describe(`PUT /:id - Update asset`, () => {
    const ep = getEndpointCfg(assets.endpoints?.updateAsset)

    const existingAsset = {
      id: `a-1`,
      name: `Original`,
      type: `document`,
      orgId: `org-1`,
      projectId: null,
      url: `https://example.com/original.pdf`,
    }

    it(`should return 200 with updated asset`, async () => {
      const updatedAsset = { ...existingAsset, name: `Updated Asset` }

      const mockGet = mockReq.app?.locals.db.services.asset.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.asset.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAsset })
      mockUpdate.mockResolvedValue({ data: updatedAsset })
      mockReq.params = { id: `a-1` }
      mockReq.body = { name: `Updated Asset` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`a-1`)
      expect(mockUpdate).toHaveBeenCalledWith({
        id: `a-1`,
        name: `Updated Asset`,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: updatedAsset })
    })

    it(`should update multiple fields`, async () => {
      const updatedAsset = {
        ...existingAsset,
        name: `New Name`,
        type: `image`,
        url: `https://example.com/new.png`,
        meta: { size: 1024 },
      }

      const mockGet = mockReq.app?.locals.db.services.asset.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.asset.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAsset })
      mockUpdate.mockResolvedValue({ data: updatedAsset })
      mockReq.params = { id: `a-1` }
      mockReq.body = {
        name: `New Name`,
        type: `image`,
        url: `https://example.com/new.png`,
        meta: { size: 1024 },
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockUpdate).toHaveBeenCalledWith({
        id: `a-1`,
        name: `New Name`,
        type: `image`,
        url: `https://example.com/new.png`,
        meta: { size: 1024 },
      })
    })

    it(`should only include defined fields in update`, async () => {
      const mockGet = mockReq.app?.locals.db.services.asset.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.asset.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAsset })
      mockUpdate.mockResolvedValue({ data: { ...existingAsset, name: `Only Name` } })
      mockReq.params = { id: `a-1` }
      mockReq.body = { name: `Only Name` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      const updateArg = mockUpdate.mock.calls[0][0]
      expect(updateArg).toEqual({ id: `a-1`, name: `Only Name` })
      expect(updateArg).not.toHaveProperty(`type`)
      expect(updateArg).not.toHaveProperty(`url`)
      expect(updateArg).not.toHaveProperty(`meta`)
      expect(updateArg).not.toHaveProperty(`content`)
    })

    it(`should throw 404 when asset is not found`, async () => {
      const mockGet = mockReq.app?.locals.db.services.asset.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: null })
      mockReq.params = { id: `a-nonexistent` }
      mockReq.body = { name: `Updated` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Asset not found`
      )
    })

    it(`should throw 500 on get error`, async () => {
      const mockGet = mockReq.app?.locals.db.services.asset.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ error: new Error(`Get failed`) })
      mockReq.params = { id: `a-1` }
      mockReq.body = { name: `Updated` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Get failed`
      )
    })

    it(`should throw 500 on update error`, async () => {
      const mockGet = mockReq.app?.locals.db.services.asset.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.asset.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAsset })
      mockUpdate.mockResolvedValue({ error: `Update failed` })
      mockReq.params = { id: `a-1` }
      mockReq.body = { name: `Updated` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Update failed`
      )
    })
  })

  // ── DELETE ASSET ───────────────────────────────────────────────────

  describe(`DELETE /:id - Delete asset`, () => {
    const ep = getEndpointCfg(assets.endpoints?.deleteAsset)

    const existingAsset = {
      id: `a-1`,
      name: `To Delete`,
      type: `document`,
      orgId: `org-1`,
      projectId: null,
    }

    it(`should return 200 with success on delete`, async () => {
      const mockGet = mockReq.app?.locals.db.services.asset.get as ReturnType<
        typeof vi.fn
      >
      const mockDelete = mockReq.app?.locals.db.services.asset.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAsset })
      mockDelete.mockResolvedValue({ data: existingAsset })
      mockReq.params = { id: `a-1` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`a-1`)
      expect(mockDelete).toHaveBeenCalledWith(`a-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: { success: true, id: `a-1` } })
    })

    it(`should throw 404 when asset is not found`, async () => {
      const mockGet = mockReq.app?.locals.db.services.asset.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: null })
      mockReq.params = { id: `a-nonexistent` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Asset not found`
      )
    })

    it(`should throw 500 on get error`, async () => {
      const mockGet = mockReq.app?.locals.db.services.asset.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ error: new Error(`Get failed`) })
      mockReq.params = { id: `a-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Get failed`
      )
    })

    it(`should throw 500 on delete error`, async () => {
      const mockGet = mockReq.app?.locals.db.services.asset.get as ReturnType<
        typeof vi.fn
      >
      const mockDelete = mockReq.app?.locals.db.services.asset.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAsset })
      mockDelete.mockResolvedValue({ error: new Error(`Delete failed`) })
      mockReq.params = { id: `a-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Delete failed`
      )
    })
  })
})
