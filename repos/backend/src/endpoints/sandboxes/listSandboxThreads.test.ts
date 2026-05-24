import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { listSandboxThreads } from './listSandboxThreads'
import { listSandboxThreadMessages } from './listSandboxThreadMessages'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'

describe(`Sandbox thread endpoints`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

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
            thread: {
              list: vi.fn(),
              get: vi.fn(),
            },
            message: {
              listByThread: vi.fn(),
            },
            role: {
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
            },
          },
        },
      },
    } as unknown as TApp
  }

  const getEndpointCfg = (ep?: TEndpoint) => getEpCfg(buildApp(), ep)

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
      params: { orgId: `org-1` },
      body: {},
      query: {},
    }
  })

  describe(`GET /:id/threads - listSandboxThreads`, () => {
    const ep = getEndpointCfg(listSandboxThreads)

    it(`should have correct configuration`, () => {
      expect(listSandboxThreads.path).toBe(`/:id/threads`)
      expect(listSandboxThreads.method).toBe(`get`)
    })

    it(`should return threads for a sandbox`, async () => {
      mockReq.params = { orgId: `org-1`, id: `sb_test01` }

      const threads = [
        { id: `th_01`, sandboxId: `sb_test01`, userId: `test-user-id` },
        { id: `th_02`, sandboxId: `sb_test01`, userId: `test-user-id` },
      ]

      const mockList = mockReq.app?.locals.db.services.thread.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: threads })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ data: threads }))
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: `org-1`, sandboxId: `sb_test01`, userId: `test-user-id` },
        })
      )
    })

    it(`should throw 400 when orgId is missing`, async () => {
      mockReq.params = { id: `sb_test01` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `orgId parameter required`
      )
    })

    it(`should throw 400 when sandboxId is missing`, async () => {
      mockReq.params = { orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `sandboxId parameter required`
      )
    })

    it(`should throw 401 when not authenticated`, async () => {
      mockReq.params = { orgId: `org-1`, id: `sb_test01` }
      mockReq.user = undefined as any

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should throw 500 on database error`, async () => {
      mockReq.params = { orgId: `org-1`, id: `sb_test01` }

      const mockList = mockReq.app?.locals.db.services.thread.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: new Error(`DB error`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `DB error`
      )
    })
  })

  describe(`GET /:id/threads/:threadId/messages - listSandboxThreadMessages`, () => {
    const ep = getEndpointCfg(listSandboxThreadMessages)

    it(`should have correct configuration`, () => {
      expect(listSandboxThreadMessages.path).toBe(`/:id/threads/:threadId/messages`)
      expect(listSandboxThreadMessages.method).toBe(`get`)
    })

    it(`should return messages for a sandbox thread`, async () => {
      mockReq.params = { orgId: `org-1`, id: `sb_test01`, threadId: `th_01` }

      const thread = {
        id: `th_01`,
        orgId: `org-1`,
        sandboxId: `sb_test01`,
        userId: `test-user-id`,
      }
      const messages = [
        { id: `msg_01`, threadId: `th_01`, content: `Hello` },
        { id: `msg_02`, threadId: `th_01`, content: `World` },
      ]

      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockListByThread = mockReq.app?.locals.db.services.message
        .listByThread as ReturnType<typeof vi.fn>

      mockGet.mockResolvedValue({ data: thread })
      mockListByThread.mockResolvedValue({ data: messages })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ data: messages }))
    })

    it(`should throw 404 when thread belongs to different org`, async () => {
      mockReq.params = { orgId: `org-1`, id: `sb_test01`, threadId: `th_01` }

      const thread = {
        id: `th_01`,
        orgId: `org-other`,
        sandboxId: `sb_test01`,
        userId: `test-user-id`,
      }

      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: thread })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 404 when thread does not belong to sandbox`, async () => {
      mockReq.params = { orgId: `org-1`, id: `sb_test01`, threadId: `th_01` }

      const thread = {
        id: `th_01`,
        orgId: `org-1`,
        sandboxId: `sb_other`,
        userId: `test-user-id`,
      }

      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: thread })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 403 when thread belongs to a different user`, async () => {
      mockReq.params = { orgId: `org-1`, id: `sb_test01`, threadId: `th_01` }

      const thread = {
        id: `th_01`,
        orgId: `org-1`,
        sandboxId: `sb_test01`,
        userId: `other-user-id`,
      }

      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: thread })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Access denied`
      )
    })

    it(`should throw 404 when thread does not exist`, async () => {
      mockReq.params = { orgId: `org-1`, id: `sb_test01`, threadId: `th_01` }

      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: null })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 400 when orgId is missing`, async () => {
      mockReq.params = { id: `sb_test01`, threadId: `th_01` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `orgId parameter required`
      )
    })

    it(`should throw 400 when sandboxId is missing`, async () => {
      mockReq.params = { orgId: `org-1`, threadId: `th_01` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `sandboxId parameter required`
      )
    })

    it(`should throw 401 when not authenticated`, async () => {
      mockReq.params = { orgId: `org-1`, id: `sb_test01`, threadId: `th_01` }
      mockReq.user = undefined as any

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should throw 500 on thread lookup error`, async () => {
      mockReq.params = { orgId: `org-1`, id: `sb_test01`, threadId: `th_01` }

      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ error: new Error(`Thread lookup failed`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread lookup failed`
      )
    })

    it(`should throw 500 on message listing error`, async () => {
      mockReq.params = { orgId: `org-1`, id: `sb_test01`, threadId: `th_01` }

      const thread = {
        id: `th_01`,
        orgId: `org-1`,
        sandboxId: `sb_test01`,
        userId: `test-user-id`,
      }
      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockListByThread = mockReq.app?.locals.db.services.message
        .listByThread as ReturnType<typeof vi.fn>

      mockGet.mockResolvedValue({ data: thread })
      mockListByThread.mockResolvedValue({ error: new Error(`Message listing failed`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Message listing failed`
      )
    })
  })
})
