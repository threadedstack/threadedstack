import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { Agent } from '@tdsk/domain'
import { EPMethod } from '@TBE/types'
import {
  getAgentProjectConfig,
  upsertAgentProjectConfig,
  deleteAgentProjectConfig,
} from './deleteAPConfig'

describe(`AgentProjectConfig endpoints`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const mockAgent = new Agent({
    id: `agent-1`,
    name: `Test Agent`,
    orgId: `org-1`,
    providerLinks: [
      {
        provider: { id: `provider-1`, type: `ai`, orgId: `org-1` } as any,
        priority: 0,
        model: null,
      },
    ],
    projects: [{ id: `proj-1`, name: `Project One`, orgId: `org-1` }] as any,
    projectConfigs: [
      {
        agentId: `agent-1`,
        projectId: `proj-1`,
        model: `gpt-4o`,
        maxTokens: 2000,
        systemPrompt: `You are helpful`,
        tools: [`search`],
        functionIds: [`func-1`],
        envVars: { KEY: `val` },
        environment: { NODE_ENV: `production` },
        enabled: true,
      },
    ] as any,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      params: { agentId: `agent-1`, projectId: `proj-1` },
      body: {},
      query: {},
      user: { id: `user-1` } as any,
      app: {
        locals: {
          db: {
            services: {
              agent: {
                get: vi.fn().mockResolvedValue({ data: mockAgent }),
                getProjectConfig: vi.fn(),
                upsertProjectConfig: vi.fn().mockResolvedValue({ data: true }),
              },
              function: {
                get: vi.fn(),
              },
              role: {
                getOrgRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
                getProjectRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
              },
            },
          },
        },
      },
    } as any
  })

  describe(`Endpoint configuration`, () => {
    it(`should have correct path and method for getAgentProjectConfig`, () => {
      expect(getAgentProjectConfig.path).toBe(`/`)
      expect(getAgentProjectConfig.method).toBe(EPMethod.Get)
    })

    it(`should have correct path and method for upsertAgentProjectConfig`, () => {
      expect(upsertAgentProjectConfig.path).toBe(`/`)
      expect(upsertAgentProjectConfig.method).toBe(EPMethod.Put)
    })

    it(`should have correct path and method for deleteAgentProjectConfig`, () => {
      expect(deleteAgentProjectConfig.path).toBe(`/`)
      expect(deleteAgentProjectConfig.method).toBe(EPMethod.Delete)
    })
  })

  describe(`GET - getAgentProjectConfig`, () => {
    it(`should return 200 with config when found`, async () => {
      const mockConfig = {
        agentId: `agent-1`,
        projectId: `proj-1`,
        model: `gpt-4o`,
        maxTokens: 2000,
      }

      const mockGetProjectConfig = mockReq.app?.locals.db.services.agent
        .getProjectConfig as ReturnType<typeof vi.fn>
      mockGetProjectConfig.mockResolvedValue({ data: mockConfig })

      await getAgentProjectConfig.action!(mockReq as TRequest, mockRes as Response)

      expect(mockGetProjectConfig).toHaveBeenCalledWith(`agent-1`, `proj-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockConfig })
    })

    it(`should return 404 when config not found`, async () => {
      const mockGetProjectConfig = mockReq.app?.locals.db.services.agent
        .getProjectConfig as ReturnType<typeof vi.fn>
      mockGetProjectConfig.mockResolvedValue({ error: new Error(`Not found`) })

      await expect(
        getAgentProjectConfig.action!(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`No config found for agent agent-1 in project proj-1`)
    })
  })

  describe(`PUT - upsertAgentProjectConfig`, () => {
    it(`should upsert config and return effective agent`, async () => {
      const updatedAgent = new Agent({
        id: `agent-1`,
        name: `Test Agent`,
        orgId: `org-1`,
        providerLinks: [
          {
            provider: { id: `provider-1`, type: `ai`, orgId: `org-1` } as any,
            priority: 0,
            model: null,
          },
        ],
        projects: [{ id: `proj-1`, name: `Project One`, orgId: `org-1` }] as any,
        projectConfigs: [
          {
            agentId: `agent-1`,
            projectId: `proj-1`,
            model: `claude-3`,
            maxTokens: 4000,
          },
        ] as any,
      })

      mockReq.body = { model: `claude-3`, maxTokens: 4000 }

      const mockUpsert = mockReq.app?.locals.db.services.agent
        .upsertProjectConfig as ReturnType<typeof vi.fn>
      mockUpsert.mockResolvedValue({ data: true })

      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      // First call returns existing agent, second call returns updated agent
      mockGet
        .mockResolvedValueOnce({ data: mockAgent })
        .mockResolvedValueOnce({ data: updatedAgent })

      await upsertAgentProjectConfig.action!(mockReq as TRequest, mockRes as Response)

      expect(mockUpsert).toHaveBeenCalledWith(`agent-1`, `proj-1`, {
        model: `claude-3`,
        maxTokens: 4000,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalled()
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toBeDefined()
    })

    it(`should validate functionIds belong to project`, async () => {
      mockReq.body = { functionIds: [`func-1`, `func-2`] }

      const mockFuncGet = mockReq.app?.locals.db.services.function.get as ReturnType<
        typeof vi.fn
      >
      mockFuncGet
        .mockResolvedValueOnce({ data: { id: `func-1`, projectId: `proj-1` } })
        .mockResolvedValueOnce({ data: { id: `func-2`, projectId: `proj-1` } })

      const updatedAgent = new Agent({
        id: `agent-1`,
        name: `Test Agent`,
        orgId: `org-1`,
        providerLinks: [
          {
            provider: { id: `provider-1`, type: `ai`, orgId: `org-1` } as any,
            priority: 0,
            model: null,
          },
        ],
      })
      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      mockGet
        .mockResolvedValueOnce({ data: mockAgent })
        .mockResolvedValueOnce({ data: updatedAgent })

      await upsertAgentProjectConfig.action!(mockReq as TRequest, mockRes as Response)

      expect(mockFuncGet).toHaveBeenCalledTimes(2)
      expect(mockFuncGet).toHaveBeenCalledWith(`func-1`)
      expect(mockFuncGet).toHaveBeenCalledWith(`func-2`)
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should return 404 when function not found`, async () => {
      mockReq.body = { functionIds: [`func-missing`] }

      const mockFuncGet = mockReq.app?.locals.db.services.function.get as ReturnType<
        typeof vi.fn
      >
      mockFuncGet.mockResolvedValue({ data: null, error: new Error(`Not found`) })

      await expect(
        upsertAgentProjectConfig.action!(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Function func-missing not found`)
    })

    it(`should return 400 when function belongs to different project`, async () => {
      mockReq.body = { functionIds: [`func-other`] }

      const mockFuncGet = mockReq.app?.locals.db.services.function.get as ReturnType<
        typeof vi.fn
      >
      mockFuncGet.mockResolvedValue({
        data: { id: `func-other`, projectId: `proj-other` },
      })

      await expect(
        upsertAgentProjectConfig.action!(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Function func-other does not belong to project proj-1`)
    })

    it(`should return 500 when upsertProjectConfig fails`, async () => {
      mockReq.body = { model: `claude-3` }

      const mockUpsert = mockReq.app?.locals.db.services.agent
        .upsertProjectConfig as ReturnType<typeof vi.fn>
      mockUpsert.mockResolvedValue({ error: new Error(`Upsert failed`) })

      await expect(
        upsertAgentProjectConfig.action!(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Upsert failed`)
    })

    it(`should only include defined fields in config`, async () => {
      mockReq.body = { model: `claude-3`, enabled: false }

      const updatedAgent = new Agent({
        id: `agent-1`,
        name: `Test Agent`,
        orgId: `org-1`,
        providerLinks: [
          {
            provider: { id: `provider-1`, type: `ai`, orgId: `org-1` } as any,
            priority: 0,
            model: null,
          },
        ],
      })
      const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      mockGet
        .mockResolvedValueOnce({ data: mockAgent })
        .mockResolvedValueOnce({ data: updatedAgent })

      const mockUpsert = mockReq.app?.locals.db.services.agent
        .upsertProjectConfig as ReturnType<typeof vi.fn>
      mockUpsert.mockResolvedValue({ data: true })

      await upsertAgentProjectConfig.action!(mockReq as TRequest, mockRes as Response)

      expect(mockUpsert).toHaveBeenCalledWith(`agent-1`, `proj-1`, {
        model: `claude-3`,
        enabled: false,
      })
    })
  })

  describe(`DELETE - deleteAgentProjectConfig`, () => {
    it(`should reset config and return configReset: true`, async () => {
      const mockUpsert = mockReq.app?.locals.db.services.agent
        .upsertProjectConfig as ReturnType<typeof vi.fn>
      mockUpsert.mockResolvedValue({ data: true })

      await deleteAgentProjectConfig.action!(mockReq as TRequest, mockRes as Response)

      expect(mockUpsert).toHaveBeenCalledWith(`agent-1`, `proj-1`, {
        model: null,
        maxTokens: null,
        systemPrompt: null,
        tools: null,
        functionIds: null,
        envVars: null,
        environment: null,
        enabled: true,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: { id: `agent-1`, configReset: true },
      })
    })

    it(`should return 500 when upsertProjectConfig fails on reset`, async () => {
      const mockUpsert = mockReq.app?.locals.db.services.agent
        .upsertProjectConfig as ReturnType<typeof vi.fn>
      mockUpsert.mockResolvedValue({ error: new Error(`Reset failed`) })

      await expect(
        deleteAgentProjectConfig.action!(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Reset failed`)
    })
  })
})
