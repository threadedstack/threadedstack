import type { Response } from 'express'
import type { TApp, TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { agents } from './agents'
import { Agent } from '@tdsk/domain'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'

describe(`Agents endpoints`, () => {
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
            agent: {
              list: vi.fn(),
              get: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
            provider: {
              get: vi.fn(),
            },
            project: {
              list: vi.fn(),
              get: vi.fn(),
            },
            role: {
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
              getProjectRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
              isProjectMember: vi.fn().mockResolvedValue({ data: true }),
              getUserProjects: vi.fn().mockResolvedValue({ data: [] }),
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

  describe(`Parent endpoint configuration`, () => {
    it(`should have correct configuration`, () => {
      expect(agents.path).toBe(`/agents`)
      expect(agents.method).toBe(`use`)
      expect(agents.endpoints).toBeDefined()
      expect(agents.endpoints?.listAgents).toBeDefined()
      expect(agents.endpoints?.getAgent).toBeDefined()
      expect(agents.endpoints?.createAgent).toBeDefined()
      expect(agents.endpoints?.updateAgent).toBeDefined()
      expect(agents.endpoints?.deleteAgent).toBeDefined()
    })

    it(`should have all 6 endpoint configs defined`, () => {
      const endpointKeys = Object.keys(agents.endpoints || {})
      expect(endpointKeys).toHaveLength(6)
      expect(endpointKeys).toContain(`getAgent`)
      expect(endpointKeys).toContain(`runAgent`)
      expect(endpointKeys).toContain(`listAgents`)
      expect(endpointKeys).toContain(`createAgent`)
      expect(endpointKeys).toContain(`updateAgent`)
      expect(endpointKeys).toContain(`deleteAgent`)
    })
  })

  describe(`GET /_/agents - List agents`, () => {
    const ep = getEndpointCfg(agents.endpoints?.listAgents)

    it(`should return 200 with agents when orgId provided`, async () => {
      const mockAgents = [
        new Agent({
          id: `agent-1`,
          name: `Agent One`,
          orgId: `org-1`,
          providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
          projects: [],
        }),
        new Agent({
          id: `agent-2`,
          name: `Agent Two`,
          orgId: `org-1`,
          providers: [{ id: `provider-2`, type: `ai`, orgId: `org-1` }] as any,
          projects: [],
        }),
      ]

      const mockList = mockReq.app?.locals.db.services.agent.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockAgents })
      mockReq.params = { orgId: `org-1` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledOnce()
      expect(mockList).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
        sanitize: true,
        where: { orgId: `org-1` },
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalled()
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(2)
    })

    it(`should return 400 when no orgId param`, async () => {
      const app = buildApp()
      mockReq.params = {}
      mockReq.app = app
      const epl = getEpCfg(app, agents.endpoints?.listAgents)

      await expect(epl.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `orgId parameter required`
      )
    })

    it(`should filter by projectId when provided`, async () => {
      const mockAgents = [
        new Agent({
          id: `agent-1`,
          name: `Agent One`,
          orgId: `org-1`,
          providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
          projects: [{ id: `project-1`, name: `P1`, orgId: `org-1` }] as any,
        }),
        new Agent({
          id: `agent-2`,
          name: `Agent Two`,
          orgId: `org-1`,
          providers: [{ id: `provider-2`, type: `ai`, orgId: `org-1` }] as any,
          projects: [{ id: `project-2`, name: `P2`, orgId: `org-1` }] as any,
        }),
        new Agent({
          id: `agent-3`,
          name: `Agent Three`,
          orgId: `org-1`,
          providers: [{ id: `provider-3`, type: `ai`, orgId: `org-1` }] as any,
          projects: [
            { id: `project-1`, name: `P1`, orgId: `org-1` },
            { id: `project-3`, name: `P3`, orgId: `org-1` },
          ] as any,
        }),
      ]

      const mockList = mockReq.app?.locals.db.services.agent.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockAgents })
      mockReq.params = { orgId: `org-1` }
      mockReq.query = { projectId: `project-1` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(2)
      expect(responseData[0].id).toBe(`agent-1`)
      expect(responseData[1].id).toBe(`agent-3`)
    })

    it(`should pass sanitize=false when query param is 'false' and user is admin`, async () => {
      const mockAgents = [
        new Agent({
          id: `agent-1`,
          name: `Agent One`,
          orgId: `org-1`,
          providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
          projects: [],
        }),
      ]

      const mockList = mockReq.app?.locals.db.services.agent.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockAgents })
      mockReq.params = { orgId: `org-1` }
      mockReq.query = { sanitize: `false` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        sanitize: false,
        where: { orgId: `org-1` },
        limit: 50,
        offset: 0,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should return 403 when non-admin requests sanitize=false`, async () => {
      mockReq.params = { orgId: `org-1` }
      mockReq.query = { sanitize: `false` }

      // Override role mock to return viewer for this test
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValue({ data: { type: `viewer` } })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Admin or higher role required to view secret values`
      )
    })

    it(`should return 500 on database error`, async () => {
      const mockError = new Error(`Database connection failed`)
      mockReq.params = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.agent.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: mockError })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database connection failed`
      )
      expect(mockList).toHaveBeenCalledOnce()
    })
  })

  describe(`GET /_/agents/:id - Get agent`, () => {
    const ep = getEndpointCfg(agents.endpoints?.getAgent)

    it(`should return 200 with sanitized agent by default`, async () => {
      const mockAgent = new Agent({
        id: `agent-1`,
        name: `Agent One`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
        secrets: [
          { id: `s1`, key: `API_KEY`, value: `secret-value`, orgId: `org-1` },
        ] as any,
      })
      mockReq.params = { id: `agent-1` }
      mockReq.query = {}

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockAgent })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`agent-1`, { sanitize: false })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalled()
      // When sanitize is default (true), the agent.sanitize() method is called
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toBeDefined()
    })

    it(`should return 200 with full agent when sanitize=false and admin role`, async () => {
      const mockAgent = new Agent({
        id: `agent-1`,
        name: `Agent One`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
        secrets: [
          { id: `s1`, key: `API_KEY`, value: `secret-value`, orgId: `org-1` },
        ] as any,
      })
      mockReq.params = { id: `agent-1` }
      mockReq.query = { sanitize: `false` }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockAgent })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`agent-1`, { sanitize: false })
      expect(mockStatus).toHaveBeenCalledWith(200)
      // When admin requests sanitize=false, the raw agent is returned (not sanitized)
      expect(mockJson).toHaveBeenCalledWith({ data: mockAgent })
    })

    it(`should return 404 when agent not found`, async () => {
      mockReq.params = { id: `nonexistent` }
      mockReq.query = {}

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Agent not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`, { sanitize: false })
    })

    it(`should return 403 when non-admin requests sanitize=false`, async () => {
      const mockAgent = new Agent({
        id: `agent-1`,
        name: `Agent One`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [{ id: `project-1`, name: `P1`, orgId: `org-1` }] as any,
        secrets: [
          { id: `s1`, key: `API_KEY`, value: `secret-value`, orgId: `org-1` },
        ] as any,
      })
      mockReq.params = { id: `agent-1` }
      mockReq.query = { sanitize: `false` }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockAgent })

      // Override role mock to return viewer for this test
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValue({ data: { type: `viewer` } })

      // Agent has projects and user is a project member, so access check passes
      const mockGetUserProjects = mockReq.app?.locals.db.services.role
        .getUserProjects as ReturnType<typeof vi.fn>
      mockGetUserProjects.mockResolvedValue({ data: [`project-1`] })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Admin or higher role required to view secret values`
      )
    })
  })

  describe(`POST /_/agents - Create agent`, () => {
    const ep = getEndpointCfg(agents.endpoints?.createAgent)

    it(`should return 201 with created agent`, async () => {
      const createdAgent = new Agent({
        id: `agent-new`,
        name: `New Agent`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      mockReq.body = {
        orgId: `org-1`,
        providerIds: [`provider-1`],
        name: `New Agent`,
      }

      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProvGet.mockResolvedValue({
        data: { id: `provider-1`, type: `ai`, name: `Anthropic`, orgId: `org-1` },
      })

      const mockCreate = mockReq.app?.locals.db.services.agent.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdAgent })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdAgent })
    })

    it(`should return 400 when orgId missing`, async () => {
      mockReq.params = {}
      mockReq.body = { providerIds: [`provider-1`], name: `Test Agent` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Agent must belong to an organization (orgId required)`
      )
    })

    it(`should return 400 when providerIds missing`, async () => {
      mockReq.body = { orgId: `org-1`, name: `Test Agent` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Agent must have at least one provider (providerIds or providers required)`
      )
    })

    it(`should associate projects when projectIds provided`, async () => {
      const mockProjects = [
        { id: `project-1`, name: `P1`, orgId: `org-1` },
        { id: `project-2`, name: `P2`, orgId: `org-1` },
      ]
      const createdAgent = new Agent({
        id: `agent-new`,
        name: `New Agent`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: mockProjects as any,
      })
      mockReq.body = {
        orgId: `org-1`,
        providerIds: [`provider-1`],
        name: `New Agent`,
        projectIds: [`project-1`, `project-2`],
      }

      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProvGet.mockResolvedValue({
        data: { id: `provider-1`, type: `ai`, name: `Anthropic`, orgId: `org-1` },
      })

      const mockProjectList = mockReq.app?.locals.db.services.project.list as ReturnType<
        typeof vi.fn
      >
      mockProjectList.mockResolvedValue({ data: mockProjects })

      const mockCreate = mockReq.app?.locals.db.services.agent.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdAgent })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockProjectList).toHaveBeenCalledWith({
        where: { id: [`project-1`, `project-2`] },
      })
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          projects: mockProjects,
        })
      )
      expect(mockStatus).toHaveBeenCalledWith(201)
    })

    it(`should not fetch projects when projectIds is empty`, async () => {
      const createdAgent = new Agent({
        id: `agent-new`,
        name: `New Agent`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      mockReq.body = {
        orgId: `org-1`,
        providerIds: [`provider-1`],
        name: `New Agent`,
      }

      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProvGet.mockResolvedValue({
        data: { id: `provider-1`, type: `ai`, name: `Anthropic`, orgId: `org-1` },
      })

      const mockProjectList = mockReq.app?.locals.db.services.project.list as ReturnType<
        typeof vi.fn
      >
      const mockCreate = mockReq.app?.locals.db.services.agent.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdAgent })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockProjectList).not.toHaveBeenCalled()
      expect(mockCreate).toHaveBeenCalled()
    })

    it(`should return 404 when provider not found`, async () => {
      mockReq.body = {
        orgId: `org-1`,
        providerIds: [`nonexistent-provider`],
        name: `Test Agent`,
      }

      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProvGet.mockResolvedValue({ data: null })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider nonexistent-provider not found`
      )
    })

    it(`should return 400 when provider is not AI type`, async () => {
      mockReq.body = {
        orgId: `org-1`,
        providerIds: [`git-provider`],
        name: `Test Agent`,
      }

      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProvGet.mockResolvedValue({
        data: { id: `git-provider`, type: `git`, name: `GitHub`, orgId: `org-1` },
      })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Agent must be linked to AI providers (provider git-provider has type: "git")`
      )
    })

    it(`should allow creating agent with AI-type provider`, async () => {
      const createdAgent = new Agent({
        id: `agent-new`,
        name: `New Agent`,
        orgId: `org-1`,
        providers: [{ id: `ai-provider`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      mockReq.body = {
        orgId: `org-1`,
        providerIds: [`ai-provider`],
        name: `New Agent`,
      }

      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProvGet.mockResolvedValue({
        data: { id: `ai-provider`, type: `ai`, name: `Anthropic`, orgId: `org-1` },
      })

      const mockCreate = mockReq.app?.locals.db.services.agent.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdAgent })

      await ep.action(mockReq as TRequest, mockRes as Response)
      expect(mockStatus).toHaveBeenCalledWith(201)
    })

    it(`should accept providers with explicit priority and sort by priority`, async () => {
      const createdAgent = new Agent({
        id: `agent-new`,
        name: `New Agent`,
        orgId: `org-1`,
        providers: [
          { id: `provider-2`, type: `ai`, orgId: `org-1` },
          { id: `provider-1`, type: `ai`, orgId: `org-1` },
        ] as any,
        projects: [],
      })
      mockReq.body = {
        orgId: `org-1`,
        providers: [
          { id: `provider-1`, priority: 1 },
          { id: `provider-2`, priority: 0 },
        ],
        name: `New Agent`,
      }

      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProvGet
        .mockResolvedValueOnce({
          data: { id: `provider-2`, type: `ai`, name: `Anthropic`, orgId: `org-1` },
        })
        .mockResolvedValueOnce({
          data: { id: `provider-1`, type: `ai`, name: `OpenAI`, orgId: `org-1` },
        })

      const mockCreate = mockReq.app?.locals.db.services.agent.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdAgent })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalled()
      const createArg = mockCreate.mock.calls[0][0]
      // providerIds should be sorted by priority: provider-2 (priority 0) first, then provider-1 (priority 1)
      expect(createArg.providerIds).toEqual([`provider-2`, `provider-1`])
      expect(mockStatus).toHaveBeenCalledWith(201)
    })

    it(`should fall back to providerIds when providers not provided`, async () => {
      const createdAgent = new Agent({
        id: `agent-new`,
        name: `New Agent`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      mockReq.body = {
        orgId: `org-1`,
        providerIds: [`provider-1`],
        name: `New Agent`,
      }

      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProvGet.mockResolvedValue({
        data: { id: `provider-1`, type: `ai`, name: `Anthropic`, orgId: `org-1` },
      })

      const mockCreate = mockReq.app?.locals.db.services.agent.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdAgent })

      await ep.action(mockReq as TRequest, mockRes as Response)

      const createArg = mockCreate.mock.calls[0][0]
      expect(createArg.providerIds).toEqual([`provider-1`])
    })

    it(`should return 500 on database error`, async () => {
      mockReq.body = {
        orgId: `org-1`,
        providerIds: [`provider-1`],
        name: `Test Agent`,
      }

      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProvGet.mockResolvedValue({
        data: { id: `provider-1`, type: `ai`, name: `Anthropic`, orgId: `org-1` },
      })

      const mockCreate = mockReq.app?.locals.db.services.agent.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ error: new Error(`Insert failed`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Insert failed`
      )
      expect(mockCreate).toHaveBeenCalledOnce()
    })

    it(`should return 403 when provider belongs to different org`, async () => {
      mockReq.body = {
        orgId: `org-1`,
        providerIds: [`provider-other-org`],
        name: `Test Agent`,
      }

      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProvGet.mockResolvedValue({
        data: { id: `provider-other-org`, type: `ai`, name: `Anthropic`, orgId: `org-2` },
      })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider provider-other-org does not belong to organization org-1`
      )
    })

    it(`should validate multiple providers and reject if any is non-AI`, async () => {
      mockReq.body = {
        orgId: `org-1`,
        providerIds: [`provider-1`, `git-provider`],
        name: `Test Agent`,
      }

      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProvGet
        .mockResolvedValueOnce({
          data: { id: `provider-1`, type: `ai`, name: `Anthropic`, orgId: `org-1` },
        })
        .mockResolvedValueOnce({
          data: { id: `git-provider`, type: `git`, name: `GitHub`, orgId: `org-1` },
        })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Agent must be linked to AI providers (provider git-provider has type: "git")`
      )
    })
  })

  describe(`PUT /_/agents/:id - Update agent`, () => {
    const ep = getEndpointCfg(agents.endpoints?.updateAgent)

    it(`should return 200 with updated agent`, async () => {
      const existingAgent = new Agent({
        id: `agent-1`,
        name: `Old Name`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      const updatedAgent = new Agent({
        id: `agent-1`,
        name: `New Name`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      mockReq.params = { id: `agent-1` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.agent.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAgent })
      mockUpdate.mockResolvedValue({ data: updatedAgent })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`agent-1`)
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: updatedAgent })
    })

    it(`should update project associations when projectIds provided`, async () => {
      const existingAgent = new Agent({
        id: `agent-1`,
        name: `Agent`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      const mockProjects = [{ id: `project-1`, name: `P1`, orgId: `org-1` }]
      const updatedAgent = new Agent({
        id: `agent-1`,
        name: `Agent`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: mockProjects as any,
      })
      mockReq.params = { id: `agent-1` }
      mockReq.body = { projectIds: [`project-1`] }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      const mockProjectList = mockReq.app?.locals.db.services.project.list as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.agent.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAgent })
      mockProjectList.mockResolvedValue({ data: mockProjects })
      mockUpdate.mockResolvedValue({ data: updatedAgent })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockProjectList).toHaveBeenCalledWith({
        where: { id: [`project-1`] },
      })
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `agent-1`,
          projects: mockProjects,
        })
      )
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should return 404 when agent not found`, async () => {
      mockReq.params = { id: `nonexistent` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Agent not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })

    it(`should return 500 on database error`, async () => {
      const existingAgent = new Agent({
        id: `agent-1`,
        name: `Old Name`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      mockReq.params = { id: `agent-1` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.agent.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAgent })
      mockUpdate.mockResolvedValue({ error: new Error(`Update failed`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Update failed`
      )
      expect(mockUpdate).toHaveBeenCalledOnce()
    })

    it(`should throw 400 when changing providerIds to non-AI provider`, async () => {
      const existingAgent = new Agent({
        id: `agent-1`,
        name: `Agent`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      mockReq.params = { id: `agent-1` }
      mockReq.body = { providerIds: [`git-provider`] }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAgent })
      mockProvGet.mockResolvedValue({
        data: { id: `git-provider`, type: `git`, name: `GitHub`, orgId: `org-1` },
      })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Agent must be linked to AI providers (provider git-provider has type: "git")`
      )
    })

    it(`should throw 404 when changing providerIds to nonexistent provider`, async () => {
      const existingAgent = new Agent({
        id: `agent-1`,
        name: `Agent`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      mockReq.params = { id: `agent-1` }
      mockReq.body = { providerIds: [`nonexistent`] }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAgent })
      mockProvGet.mockResolvedValue({ data: null })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider nonexistent not found`
      )
    })

    it(`should skip provider validation when providerIds not provided`, async () => {
      const existingAgent = new Agent({
        id: `agent-1`,
        name: `Old Name`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      const updatedAgent = new Agent({
        id: `agent-1`,
        name: `New Name`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      mockReq.params = { id: `agent-1` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.agent.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAgent })
      mockUpdate.mockResolvedValue({ data: updatedAgent })

      await ep.action(mockReq as TRequest, mockRes as Response)

      // provider.get should NOT be called since providerIds was not provided
      expect(mockProvGet).not.toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should allow changing to valid AI providers`, async () => {
      const existingAgent = new Agent({
        id: `agent-1`,
        name: `Agent`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      const updatedAgent = new Agent({
        id: `agent-1`,
        name: `Agent`,
        orgId: `org-1`,
        providers: [{ id: `new-ai-provider`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      mockReq.params = { id: `agent-1` }
      mockReq.body = { providerIds: [`new-ai-provider`] }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.agent.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAgent })
      mockProvGet.mockResolvedValue({
        data: { id: `new-ai-provider`, type: `ai`, name: `OpenAI`, orgId: `org-1` },
      })
      mockUpdate.mockResolvedValue({ data: updatedAgent })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockProvGet).toHaveBeenCalledWith(`new-ai-provider`)
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should return 403 when provider belongs to different org`, async () => {
      const existingAgent = new Agent({
        id: `agent-1`,
        name: `Agent`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      mockReq.params = { id: `agent-1` }
      mockReq.body = { providerIds: [`provider-other-org`] }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAgent })
      mockProvGet.mockResolvedValue({
        data: { id: `provider-other-org`, type: `ai`, name: `Anthropic`, orgId: `org-2` },
      })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider provider-other-org does not belong to organization org-1`
      )
    })
  })

  describe(`DELETE /_/agents/:id - Delete agent`, () => {
    const ep = getEndpointCfg(agents.endpoints?.deleteAgent)

    it(`should return 200 on successful delete`, async () => {
      const existingAgent = new Agent({
        id: `agent-1`,
        name: `To Delete`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      const deleteResult = { id: `agent-1` }
      mockReq.params = { id: `agent-1` }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      const mockDelete = mockReq.app?.locals.db.services.agent.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAgent })
      mockDelete.mockResolvedValue({ data: deleteResult })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`agent-1`)
      expect(mockDelete).toHaveBeenCalledWith(`agent-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: deleteResult })
    })

    it(`should return 404 when agent not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Agent not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })

    it(`should return 500 on database error`, async () => {
      const existingAgent = new Agent({
        id: `agent-1`,
        name: `To Delete`,
        orgId: `org-1`,
        providers: [{ id: `provider-1`, type: `ai`, orgId: `org-1` }] as any,
        projects: [],
      })
      mockReq.params = { id: `agent-1` }

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      const mockDelete = mockReq.app?.locals.db.services.agent.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingAgent })
      mockDelete.mockResolvedValue({ error: new Error(`Delete failed`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Delete failed`
      )
      expect(mockDelete).toHaveBeenCalledWith(`agent-1`)
    })
  })
})
