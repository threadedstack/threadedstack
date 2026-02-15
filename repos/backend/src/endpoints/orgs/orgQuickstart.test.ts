import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { orgQuickstart } from './orgQuickstart'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'

vi.mock(`@tdsk/domain`, async () => {
  const actual = await vi.importActual(`@tdsk/domain`)
  return {
    ...actual,
    deriveKey: vi.fn().mockResolvedValue(Buffer.alloc(32, `key`)),
    encryptValue: vi.fn().mockResolvedValue({
      iv: Buffer.alloc(12, `iv`),
      authTag: Buffer.alloc(16, `tag`),
      encrypted: Buffer.from(`encrypted`),
    }),
  }
})

const mockInsertReturning = vi.fn()
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }))
const mockInsert = vi.fn(() => ({ values: mockInsertValues }))

const mockTx = {
  insert: mockInsert,
}

describe(`Quickstart endpoint`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockTransaction: ReturnType<typeof vi.fn>

  const buildApp = () => {
    mockTransaction = vi.fn(async (fn: (tx: any) => any) => fn(mockTx)) as any
    return {
      locals: {
        config,
        payments: new PaymentsService(config.payments),
        db: {
          transaction: mockTransaction,
          services: {
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
  const ep = getEndpointCfg(orgQuickstart)

  const validBody = {
    providerTemp: `anthropic`,
    apiKey: `sk-ant-api03-test-key`,
    projectName: `My Claude Project`,
    agentName: `claude-agent`,
  }

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
      params: { orgId: `org-1` },
      body: { ...validBody },
      query: {},
    }

    // Setup default mock returns for each insert (provider, secret, project, agent, agentProject, endpoint)
    mockInsertReturning
      .mockResolvedValueOnce([
        {
          id: `provider-1`,
          name: `Anthropic`,
          type: `ai`,
          orgId: `org-1`,
          options: { baseUrl: `https://api.anthropic.com` },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: `secret-1`,
          name: `ANTHROPIC_API_KEY`,
          hashKey: `hash`,
          encryptedValue: `enc`,
          providerId: `provider-1`,
        },
      ])
      .mockResolvedValueOnce([
        { id: `project-1`, name: `My Claude Project`, orgId: `org-1`, meta: {} },
      ])
      .mockResolvedValueOnce([
        {
          id: `agent-1`,
          name: `claude-agent`,
          orgId: `org-1`,
          providerId: `provider-1`,
          model: `claude-sonnet-4-20250514`,
        },
      ])

    // agentProjects insert doesn't call returning
    mockInsertValues.mockReturnValueOnce({ returning: mockInsertReturning })

    mockInsertReturning.mockResolvedValueOnce([
      {
        id: `endpoint-1`,
        name: `claude-agent`,
        path: `/ai/claude-agent`,
        type: `agent`,
        method: `post`,
        projectId: `project-1`,
      },
    ])
  })

  describe(`POST /:orgId/quickstart - Create all resources`, () => {
    it(`should return 201 with all created resources on success`, async () => {
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(201)
      const response = mockJson.mock.calls[0][0]
      expect(response.data).toBeDefined()
      expect(response.data.provider).toBeDefined()
      expect(response.data.secret).toBeDefined()
      expect(response.data.project).toBeDefined()
      expect(response.data.agent).toBeDefined()
      expect(response.data.endpoint).toBeDefined()
    })

    it(`should sanitize secret - no encryptedValue in response`, async () => {
      await ep.action(mockReq as TRequest, mockRes as Response)

      const response = mockJson.mock.calls[0][0]
      expect(response.data.secret.encryptedValue).toBeUndefined()
      expect(response.data.secret.id).toBe(`secret-1`)
    })

    it(`should call db.transaction`, async () => {
      await ep.action(mockReq as TRequest, mockRes as Response)

      const mockTxn = mockReq.app?.locals.db.transaction as ReturnType<typeof vi.fn>
      expect(mockTxn).toHaveBeenCalledOnce()
    })
  })

  describe(`Validation`, () => {
    it(`should return 400 when template is missing`, async () => {
      mockReq.body = { ...validBody, providerTemp: undefined }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `template is required`
      )
    })

    it(`should return 400 when apiKey is missing`, async () => {
      mockReq.body = { ...validBody, apiKey: undefined }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `apiKey is required`
      )
    })

    it(`should return 400 when projectName is missing`, async () => {
      mockReq.body = { ...validBody, projectName: undefined }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `projectName is required`
      )
    })

    it(`should return 400 when agentName is missing`, async () => {
      mockReq.body = { ...validBody, agentName: undefined }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `agentName is required`
      )
    })

    it(`should return 400 for unknown template`, async () => {
      mockReq.body = { ...validBody, providerTemp: `nonexistent` }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Unknown template: nonexistent`
      )
    })

    it(`should return 400 when custom provider has no name`, async () => {
      mockReq.body = {
        ...validBody,
        providerTemp: `custom`,
        providerUrl: `https://example.com`,
      }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `providerName is required for custom providers`
      )
    })

    it(`should return 400 when custom provider has no baseUrl`, async () => {
      mockReq.body = {
        ...validBody,
        providerTemp: `custom`,
        providerName: `My Provider`,
      }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `providerUrl is required for custom providers`
      )
    })
  })

  describe(`Permission check`, () => {
    it(`should return 403 when user is not admin`, async () => {
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValueOnce({ data: { type: `viewer` } })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow()
    })
  })

  describe(`Custom provider`, () => {
    it(`should accept custom provider with name and baseUrl`, async () => {
      mockReq.body = {
        ...validBody,
        providerTemp: `custom`,
        providerName: `My LLM`,
        providerUrl: `https://my-llm.example.com`,
        model: `my-model`,
      }

      await ep.action(mockReq as TRequest, mockRes as Response)
      expect(mockStatus).toHaveBeenCalledWith(201)
    })
  })

  describe(`Template resolution`, () => {
    it(`should use openai template defaults`, async () => {
      mockReq.body = { ...validBody, providerTemp: `openai`, apiKey: `sk-test` }

      await ep.action(mockReq as TRequest, mockRes as Response)
      expect(mockStatus).toHaveBeenCalledWith(201)

      // Check that insert was called with openai values
      const providerInsertCall = (mockInsertValues.mock.calls as any[][])[0]?.[0]
      expect(providerInsertCall?.name).toBe(`OpenAI`)
      expect(providerInsertCall?.options?.baseUrl).toBe(`https://api.openai.com/v1`)
    })

    it(`should use google template defaults`, async () => {
      mockReq.body = { ...validBody, providerTemp: `google`, apiKey: `AIzaTest` }

      await ep.action(mockReq as TRequest, mockRes as Response)
      expect(mockStatus).toHaveBeenCalledWith(201)

      const providerInsertCall = (mockInsertValues.mock.calls as any[][])[0]?.[0]
      expect(providerInsertCall?.name).toBe(`Google AI`)
    })
  })

  describe(`Transaction rollback`, () => {
    it(`should propagate DB errors from inside transaction`, async () => {
      const txError = new Error(`unique constraint violated`)
      ;(
        mockReq.app?.locals.db.transaction as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(txError)

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow()
    })

    it(`should return 409 for unique constraint violations`, async () => {
      const txError = new Error(`duplicate key value violates unique constraint`)
      ;(
        mockReq.app?.locals.db.transaction as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(txError)

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `A resource with that name already exists`
      )
    })
  })

  describe(`Endpoint path generation`, () => {
    it(`should generate slug from agent name`, async () => {
      mockReq.body = { ...validBody, agentName: `My Cool Agent` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      // The endpoint insert should use a slugified path
      const endpointInsertCall = (mockInsertValues.mock.calls as any[][])[5]?.[0]
      expect(endpointInsertCall?.path).toBe(`/ai/my-cool-agent`)
    })
  })
})
