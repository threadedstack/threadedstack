import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { agentThreads } from './threads'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'

describe(`Thread endpoints`, () => {
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
              create: vi.fn(),
              delete: vi.fn(),
              branchThread: vi.fn(),
            },
            message: {
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
      params: { orgId: `org-1`, agentId: `agent-1` },
      body: {},
      query: {},
    }
  })

  // ── PARENT CONFIG ─────────────────────────────────────────────────

  describe(`Parent endpoint configuration`, () => {
    it(`should have correct path and method`, () => {
      expect(agentThreads.path).toBe(`/:agentId/threads`)
      expect(agentThreads.method).toBe(`use`)
      expect(agentThreads.endpoints).toBeDefined()
    })

    it(`should have all 9 endpoint configs`, () => {
      const keys = Object.keys(agentThreads.endpoints || {})
      expect(keys).toHaveLength(9)
      expect(keys).toContain(`getThread`)
      expect(keys).toContain(`listThreads`)
      expect(keys).toContain(`createThread`)
      expect(keys).toContain(`deleteThread`)
      expect(keys).toContain(`listMessages`)
      expect(keys).toContain(`createMessage`)
      expect(keys).toContain(`updateMessage`)
      expect(keys).toContain(`deleteMessage`)
      expect(keys).toContain(`branchThread`)
    })
  })

  // ── CREATE THREAD ─────────────────────────────────────────────────

  describe(`POST / - Create thread`, () => {
    const ep = getEndpointCfg(agentThreads.endpoints?.createThread)

    it(`should return 201 with created thread`, async () => {
      const createdThread = {
        id: `t-new`,
        name: `New Thread`,
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `test-user-id`,
      }

      const mockCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdThread })
      mockReq.body = { name: `New Thread` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledOnce()
      expect(mockCreate).toHaveBeenCalledWith({
        name: `New Thread`,
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `test-user-id`,
      })
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdThread })
    })

    it(`should spread req.body into thread data`, async () => {
      const createdThread = {
        id: `t-new`,
        name: `Thread`,
        metadata: { key: `val` },
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `test-user-id`,
      }

      const mockCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdThread })
      mockReq.body = { name: `Thread`, metadata: { key: `val` } }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledWith({
        name: `Thread`,
        metadata: { key: `val` },
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `test-user-id`,
      })
    })

    it(`should throw 401 when no user`, async () => {
      mockReq.user = undefined as any

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should throw 400 when orgId missing`, async () => {
      const app = buildApp()
      mockReq.app = app
      mockReq.params = { agentId: `agent-1` }
      const epl = getEpCfg(app, agentThreads.endpoints?.createThread)

      await expect(epl.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `orgId is required`
      )
    })

    it(`should throw 400 when agentId missing`, async () => {
      const app = buildApp()
      mockReq.app = app
      mockReq.params = { orgId: `org-1` }
      const epl = getEpCfg(app, agentThreads.endpoints?.createThread)

      await expect(epl.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `agentId is required`
      )
    })

    it(`should throw 500 on db create error`, async () => {
      const mockCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ error: `Create failed` })
      mockReq.body = { name: `Fail` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Create failed`
      )
    })
  })

  // ── LIST THREADS ──────────────────────────────────────────────────

  describe(`GET / - List threads`, () => {
    const ep = getEndpointCfg(agentThreads.endpoints?.listThreads)

    it(`should return 200 with threads and default pagination`, async () => {
      const mockThreads = [
        {
          id: `t-1`,
          name: `Thread 1`,
          orgId: `org-1`,
          agentId: `agent-1`,
          userId: `test-user-id`,
        },
        {
          id: `t-2`,
          name: `Thread 2`,
          orgId: `org-1`,
          agentId: `agent-1`,
          userId: `test-user-id`,
        },
      ]

      const mockList = mockReq.app?.locals.db.services.thread.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockThreads })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledOnce()
      expect(mockList).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
        where: { orgId: `org-1`, userId: `test-user-id`, agentId: `agent-1` },
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: mockThreads,
        limit: 50,
        offset: 0,
      })
    })

    it(`should respect custom pagination params`, async () => {
      const mockList = mockReq.app?.locals.db.services.thread.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [] })
      mockReq.query = { limit: `10`, offset: `20` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        limit: 10,
        offset: 20,
        where: { orgId: `org-1`, userId: `test-user-id`, agentId: `agent-1` },
      })
      expect(mockJson).toHaveBeenCalledWith({
        data: [],
        limit: 10,
        offset: 20,
      })
    })

    it(`should return empty array when data is null`, async () => {
      const mockList = mockReq.app?.locals.db.services.thread.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: [],
        limit: 50,
        offset: 0,
      })
    })

    it(`should throw 400 when orgId missing`, async () => {
      const app = buildApp()
      mockReq.app = app
      mockReq.params = { agentId: `agent-1` }
      const epl = getEpCfg(app, agentThreads.endpoints?.listThreads)

      await expect(epl.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `orgId parameter required`
      )
    })

    it(`should throw 400 when agentId missing`, async () => {
      const app = buildApp()
      mockReq.app = app
      mockReq.params = { orgId: `org-1` }
      const epl = getEpCfg(app, agentThreads.endpoints?.listThreads)

      await expect(epl.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `agentId parameter required`
      )
    })

    it(`should throw 401 when no userId`, async () => {
      const app = buildApp()
      mockReq.app = app
      mockReq.user = undefined as any
      const epl = getEpCfg(app, agentThreads.endpoints?.listThreads)

      await expect(epl.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should throw 500 on db error`, async () => {
      const mockList = mockReq.app?.locals.db.services.thread.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: `DB failure` })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `DB failure`
      )
    })
  })

  // ── GET THREAD ────────────────────────────────────────────────────

  describe(`GET /:id - Get thread`, () => {
    const ep = getEndpointCfg(agentThreads.endpoints?.getThread)

    it(`should return 200 with thread`, async () => {
      const mockThread = {
        id: `t-1`,
        name: `Thread 1`,
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `test-user-id`,
      }

      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockThread })
      mockReq.params = { id: `t-1`, agentId: `agent-1`, orgId: `org-1` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`t-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockThread })
    })

    it(`should throw 401 when no user`, async () => {
      mockReq.user = undefined as any

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should throw 404 when thread not found`, async () => {
      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: null })
      mockReq.params = { id: `t-missing`, agentId: `agent-1`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 404 when service returns error`, async () => {
      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ error: `Not found` })
      mockReq.params = { id: `t-1`, agentId: `agent-1`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 404 when thread belongs to different agent`, async () => {
      const mockThread = {
        id: `t-1`,
        orgId: `org-1`,
        agentId: `other-agent`,
        userId: `test-user-id`,
      }

      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockThread })
      mockReq.params = { id: `t-1`, agentId: `agent-1`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 403 when thread belongs to different user`, async () => {
      const mockThread = {
        id: `t-1`,
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `other-user`,
      }

      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockThread })
      mockReq.params = { id: `t-1`, agentId: `agent-1`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Access denied`
      )
    })
  })

  // ── DELETE THREAD ─────────────────────────────────────────────────

  describe(`DELETE /:id - Delete thread`, () => {
    const ep = getEndpointCfg(agentThreads.endpoints?.deleteThread)

    it(`should return 200 on successful delete`, async () => {
      const mockThread = {
        id: `t-1`,
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `test-user-id`,
      }

      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockDel = mockReq.app?.locals.db.services.thread.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockThread })
      mockDel.mockResolvedValue({ data: mockThread })
      mockReq.params = { id: `t-1`, agentId: `agent-1`, orgId: `org-1` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`t-1`)
      expect(mockDel).toHaveBeenCalledWith(`t-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockThread })
    })

    it(`should throw 401 when no user`, async () => {
      mockReq.user = undefined as any

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should throw 404 when thread not found`, async () => {
      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: null })
      mockReq.params = { id: `t-nope`, agentId: `agent-1`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 404 when service returns error on get`, async () => {
      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ error: `Not found` })
      mockReq.params = { id: `t-1`, agentId: `agent-1`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 404 when thread belongs to different agent`, async () => {
      const mockThread = {
        id: `t-1`,
        orgId: `org-1`,
        agentId: `other-agent`,
        userId: `test-user-id`,
      }

      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockThread })
      mockReq.params = { id: `t-1`, agentId: `agent-1`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 403 when thread belongs to different user`, async () => {
      const mockThread = {
        id: `t-1`,
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `other-user`,
      }

      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockThread })
      mockReq.params = { id: `t-1`, agentId: `agent-1`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Access denied`
      )
    })

    it(`should throw 500 on db delete error`, async () => {
      const mockThread = {
        id: `t-1`,
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `test-user-id`,
      }

      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockDel = mockReq.app?.locals.db.services.thread.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockThread })
      mockDel.mockResolvedValue({ error: `Delete failed` })
      mockReq.params = { id: `t-1`, agentId: `agent-1`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Delete failed`
      )
      expect(mockDel).toHaveBeenCalledWith(`t-1`)
    })
  })

  // ── LIST MESSAGES ─────────────────────────────────────────────────

  describe(`GET /:threadId/messages - List messages`, () => {
    const ep = getEndpointCfg(agentThreads.endpoints?.listMessages)

    it(`should return 200 with messages and default pagination`, async () => {
      const mockThread = {
        id: `t-1`,
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `test-user-id`,
      }

      const mockMessages = [
        {
          id: `m-1`,
          threadId: `t-1`,
          type: `user`,
          content: [{ type: `text`, text: `Hello` }],
        },
        {
          id: `m-2`,
          threadId: `t-1`,
          type: `assistant`,
          content: [{ type: `text`, text: `Hi` }],
        },
      ]

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockListMsg = mockReq.app?.locals.db.services.message.list as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockListMsg.mockResolvedValue({ data: mockMessages })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGetThread).toHaveBeenCalledWith(`t-1`)
      expect(mockListMsg).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
        where: { threadId: `t-1` },
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: mockMessages,
        limit: 50,
        offset: 0,
      })
    })

    it(`should respect custom pagination params`, async () => {
      const mockThread = {
        id: `t-1`,
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `test-user-id`,
      }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockListMsg = mockReq.app?.locals.db.services.message.list as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockListMsg.mockResolvedValue({ data: [] })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.query = { limit: `20`, offset: `10` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockListMsg).toHaveBeenCalledWith({
        limit: 20,
        offset: 10,
        where: { threadId: `t-1` },
      })
      expect(mockJson).toHaveBeenCalledWith({
        data: [],
        limit: 20,
        offset: 10,
      })
    })

    it(`should return empty array when data is null`, async () => {
      const mockThread = {
        id: `t-1`,
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `test-user-id`,
      }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockListMsg = mockReq.app?.locals.db.services.message.list as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockListMsg.mockResolvedValue({ data: null })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: [],
        limit: 50,
        offset: 0,
      })
    })

    it(`should throw 401 when no user`, async () => {
      mockReq.user = undefined as any

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should throw 404 when thread not found`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: null })
      mockReq.params = {
        threadId: `t-nope`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 404 when thread service returns error`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ error: `Not found` })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 404 when thread belongs to different agent`, async () => {
      const mockThread = {
        id: `t-1`,
        orgId: `org-1`,
        agentId: `other-agent`,
        userId: `test-user-id`,
      }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 403 when thread belongs to different user`, async () => {
      const mockThread = {
        id: `t-1`,
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `other-user`,
      }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Access denied`
      )
    })

    it(`should throw 500 on message list error`, async () => {
      const mockThread = {
        id: `t-1`,
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `test-user-id`,
      }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockListMsg = mockReq.app?.locals.db.services.message.list as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockListMsg.mockResolvedValue({ error: `DB error` })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `DB error`
      )
    })
  })

  // ── CREATE MESSAGE ────────────────────────────────────────────────

  describe(`POST /:threadId/messages - Create message`, () => {
    const ep = getEndpointCfg(agentThreads.endpoints?.createMessage)

    const mockThread = {
      id: `t-1`,
      orgId: `org-1`,
      agentId: `agent-1`,
      userId: `test-user-id`,
    }

    it(`should return 201 with created message`, async () => {
      const createdMessage = {
        id: `m-new`,
        threadId: `t-1`,
        type: `user`,
        content: [{ type: `text`, text: `Hello` }],
        orgId: `org-1`,
      }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockCreateMsg = mockReq.app?.locals.db.services.message.create as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockCreateMsg.mockResolvedValue({ data: createdMessage })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = {
        type: `user`,
        content: [{ type: `text`, text: `Hello` }],
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGetThread).toHaveBeenCalledWith(`t-1`)
      expect(mockCreateMsg).toHaveBeenCalledWith({
        threadId: `t-1`,
        type: `user`,
        content: [{ type: `text`, text: `Hello` }],
        orgId: `org-1`,
      })
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdMessage })
    })

    it(`should throw 401 when no user`, async () => {
      mockReq.user = undefined as any

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should throw 404 when thread not found`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: null })
      mockReq.params = {
        threadId: `t-nope`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = { type: `user`, content: [{ type: `text`, text: `Hi` }] }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 404 when thread belongs to different agent`, async () => {
      const wrongAgentThread = { ...mockThread, agentId: `other-agent` }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: wrongAgentThread })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = { type: `user`, content: [{ type: `text`, text: `Hi` }] }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 403 when thread belongs to different user`, async () => {
      const otherUserThread = { ...mockThread, userId: `other-user` }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: otherUserThread })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = { type: `user`, content: [{ type: `text`, text: `Hi` }] }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Access denied`
      )
    })

    it(`should throw 400 when type is missing`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = { content: [{ type: `text`, text: `Hi` }] }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `type is required`
      )
    })

    it(`should throw 400 when content is missing`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = { type: `user` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `content is required`
      )
    })

    it(`should throw 500 on db create error`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockCreateMsg = mockReq.app?.locals.db.services.message.create as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockCreateMsg.mockResolvedValue({ error: `Create failed` })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = { type: `user`, content: [{ type: `text`, text: `Hi` }] }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Create failed`
      )
    })
  })

  // ── UPDATE MESSAGE ────────────────────────────────────────────────

  describe(`PUT /:threadId/messages/:messageId - Update message`, () => {
    const ep = getEndpointCfg(agentThreads.endpoints?.updateMessage)

    const mockThread = {
      id: `t-1`,
      orgId: `org-1`,
      agentId: `agent-1`,
      userId: `test-user-id`,
    }

    const mockMessage = {
      id: `m-1`,
      threadId: `t-1`,
      type: `user`,
      content: [{ type: `text`, text: `Hello` }],
    }

    it(`should return 200 with updated message`, async () => {
      const updatedMessage = {
        ...mockMessage,
        content: [{ type: `text`, text: `Updated` }],
      }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockGetMsg = mockReq.app?.locals.db.services.message.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdateMsg = mockReq.app?.locals.db.services.message.update as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockGetMsg.mockResolvedValue({ data: mockMessage })
      mockUpdateMsg.mockResolvedValue({ data: updatedMessage })
      mockReq.params = {
        threadId: `t-1`,
        messageId: `m-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = { content: [{ type: `text`, text: `Updated` }] }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGetThread).toHaveBeenCalledWith(`t-1`)
      expect(mockGetMsg).toHaveBeenCalledWith(`m-1`)
      expect(mockUpdateMsg).toHaveBeenCalledWith({
        id: `m-1`,
        content: [{ type: `text`, text: `Updated` }],
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: updatedMessage })
    })

    it(`should update type and meta fields`, async () => {
      const updatedMessage = { ...mockMessage, type: `system`, meta: { edited: true } }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockGetMsg = mockReq.app?.locals.db.services.message.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdateMsg = mockReq.app?.locals.db.services.message.update as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockGetMsg.mockResolvedValue({ data: mockMessage })
      mockUpdateMsg.mockResolvedValue({ data: updatedMessage })
      mockReq.params = {
        threadId: `t-1`,
        messageId: `m-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = { type: `system`, meta: { edited: true } }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockUpdateMsg).toHaveBeenCalledWith({
        id: `m-1`,
        type: `system`,
        meta: { edited: true },
      })
    })

    it(`should throw 401 when no user`, async () => {
      mockReq.user = undefined as any

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should throw 404 when thread not found`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: null })
      mockReq.params = {
        threadId: `t-nope`,
        messageId: `m-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 404 when thread belongs to different agent`, async () => {
      const wrongAgentThread = { ...mockThread, agentId: `other-agent` }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: wrongAgentThread })
      mockReq.params = {
        threadId: `t-1`,
        messageId: `m-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 403 when thread belongs to different user`, async () => {
      const otherUserThread = { ...mockThread, userId: `other-user` }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: otherUserThread })
      mockReq.params = {
        threadId: `t-1`,
        messageId: `m-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Access denied`
      )
    })

    it(`should throw 404 when message not found`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockGetMsg = mockReq.app?.locals.db.services.message.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockGetMsg.mockResolvedValue({ data: null })
      mockReq.params = {
        threadId: `t-1`,
        messageId: `m-nope`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Message not found`
      )
    })

    it(`should throw 404 when message belongs to different thread`, async () => {
      const wrongThreadMsg = { ...mockMessage, threadId: `t-other` }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockGetMsg = mockReq.app?.locals.db.services.message.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockGetMsg.mockResolvedValue({ data: wrongThreadMsg })
      mockReq.params = {
        threadId: `t-1`,
        messageId: `m-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Message not found in this thread`
      )
    })

    it(`should throw 500 on db update error`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockGetMsg = mockReq.app?.locals.db.services.message.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdateMsg = mockReq.app?.locals.db.services.message.update as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockGetMsg.mockResolvedValue({ data: mockMessage })
      mockUpdateMsg.mockResolvedValue({ error: `Update failed` })
      mockReq.params = {
        threadId: `t-1`,
        messageId: `m-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = { content: `new` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Update failed`
      )
    })
  })

  // ── DELETE MESSAGE ────────────────────────────────────────────────

  describe(`DELETE /:threadId/messages/:messageId - Delete message`, () => {
    const ep = getEndpointCfg(agentThreads.endpoints?.deleteMessage)

    const mockThread = {
      id: `t-1`,
      orgId: `org-1`,
      agentId: `agent-1`,
      userId: `test-user-id`,
    }

    const mockMessage = {
      id: `m-1`,
      threadId: `t-1`,
      type: `user`,
      content: [{ type: `text`, text: `Hello` }],
    }

    it(`should return 200 on successful delete`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockGetMsg = mockReq.app?.locals.db.services.message.get as ReturnType<
        typeof vi.fn
      >
      const mockDelMsg = mockReq.app?.locals.db.services.message.delete as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockGetMsg.mockResolvedValue({ data: mockMessage })
      mockDelMsg.mockResolvedValue({ data: mockMessage })
      mockReq.params = {
        threadId: `t-1`,
        messageId: `m-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGetThread).toHaveBeenCalledWith(`t-1`)
      expect(mockGetMsg).toHaveBeenCalledWith(`m-1`)
      expect(mockDelMsg).toHaveBeenCalledWith(`m-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockMessage })
    })

    it(`should throw 401 when no user`, async () => {
      mockReq.user = undefined as any

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should throw 404 when thread not found`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: null })
      mockReq.params = {
        threadId: `t-nope`,
        messageId: `m-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 404 when thread belongs to different agent`, async () => {
      const wrongAgentThread = { ...mockThread, agentId: `other-agent` }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: wrongAgentThread })
      mockReq.params = {
        threadId: `t-1`,
        messageId: `m-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 403 when thread belongs to different user`, async () => {
      const otherUserThread = { ...mockThread, userId: `other-user` }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: otherUserThread })
      mockReq.params = {
        threadId: `t-1`,
        messageId: `m-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Access denied`
      )
    })

    it(`should throw 404 when message not found`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockGetMsg = mockReq.app?.locals.db.services.message.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockGetMsg.mockResolvedValue({ data: null })
      mockReq.params = {
        threadId: `t-1`,
        messageId: `m-nope`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Message not found`
      )
    })

    it(`should throw 404 when message belongs to different thread`, async () => {
      const wrongThreadMsg = { ...mockMessage, threadId: `t-other` }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockGetMsg = mockReq.app?.locals.db.services.message.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockGetMsg.mockResolvedValue({ data: wrongThreadMsg })
      mockReq.params = {
        threadId: `t-1`,
        messageId: `m-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Message not found in this thread`
      )
    })

    it(`should throw 500 on db delete error`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockGetMsg = mockReq.app?.locals.db.services.message.get as ReturnType<
        typeof vi.fn
      >
      const mockDelMsg = mockReq.app?.locals.db.services.message.delete as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockGetMsg.mockResolvedValue({ data: mockMessage })
      mockDelMsg.mockResolvedValue({ error: `Delete failed` })
      mockReq.params = {
        threadId: `t-1`,
        messageId: `m-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Delete failed`
      )
    })
  })

  // ── BRANCH THREAD ─────────────────────────────────────────────────

  describe(`POST /:threadId/branch - Branch thread`, () => {
    const ep = getEndpointCfg(agentThreads.endpoints?.branchThread)

    const mockThread = {
      id: `t-1`,
      orgId: `org-1`,
      agentId: `agent-1`,
      userId: `test-user-id`,
    }

    it(`should return 201 with branched thread`, async () => {
      const branchedThread = {
        id: `t-branch`,
        name: `Thread 1 (branch)`,
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `test-user-id`,
        parentThreadId: `t-1`,
        branchMessageId: `m-3`,
        messages: [
          { id: `m-new-1`, threadId: `t-branch`, type: `user` },
          { id: `m-new-2`, threadId: `t-branch`, type: `assistant` },
        ],
      }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockBranch = mockReq.app?.locals.db.services.thread
        .branchThread as ReturnType<typeof vi.fn>
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockBranch.mockResolvedValue({ data: branchedThread })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = { messageId: `m-3` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGetThread).toHaveBeenCalledWith(`t-1`)
      expect(mockBranch).toHaveBeenCalledWith(`t-1`, `m-3`, `test-user-id`)
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: branchedThread })
    })

    it(`should throw 401 when no user`, async () => {
      mockReq.user = undefined as any

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should throw 400 when messageId missing from body`, async () => {
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = {}

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `messageId is required`
      )
    })

    it(`should throw 404 when thread not found`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: null })
      mockReq.params = {
        threadId: `t-nope`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = { messageId: `m-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 404 when thread belongs to different agent`, async () => {
      const wrongAgentThread = { ...mockThread, agentId: `other-agent` }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: wrongAgentThread })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = { messageId: `m-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Thread not found`
      )
    })

    it(`should throw 403 when thread belongs to different user`, async () => {
      const otherUserThread = { ...mockThread, userId: `other-user` }

      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGetThread.mockResolvedValue({ data: otherUserThread })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = { messageId: `m-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Access denied`
      )
    })

    it(`should throw 500 on db branch error`, async () => {
      const mockGetThread = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      const mockBranch = mockReq.app?.locals.db.services.thread
        .branchThread as ReturnType<typeof vi.fn>
      mockGetThread.mockResolvedValue({ data: mockThread })
      mockBranch.mockResolvedValue({ error: `Branch failed` })
      mockReq.params = {
        threadId: `t-1`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      mockReq.body = { messageId: `m-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Branch failed`
      )
    })
  })
})
