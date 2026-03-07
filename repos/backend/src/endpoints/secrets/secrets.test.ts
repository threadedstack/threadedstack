import type { Response } from 'express'
import type { TApp, TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { secrets } from './secrets'
import { Secret, Provider } from '@tdsk/domain'
import { isFunc } from '@keg-hub/jsutils/isFunc'
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
    decryptValue: vi.fn().mockResolvedValue(`decrypted-value`),
  }
})

describe(`Secrets endpoints`, () => {
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
            secret: {
              list: vi.fn(),
              get: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
            provider: {
              get: vi.fn(),
              list: vi.fn(),
            },
            agent: {
              get: vi.fn(),
            },
            role: {
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: `member` } }),
              getProjectRole: vi.fn().mockResolvedValue({ data: { type: `member` } }),
              isOrgMember: vi.fn().mockResolvedValue({ data: true }),
              isProjectMember: vi.fn().mockResolvedValue({ data: true }),
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
      params: {},
      body: {},
      query: {},
    }
  })

  describe(`Parent endpoint configuration`, () => {
    it(`should have correct configuration`, () => {
      expect(secrets.path).toBe(`/secrets`)
      expect(secrets.method).toBe(`use`)
      expect(secrets.endpoints).toBeDefined()
      expect(secrets.endpoints?.listSecrets).toBeDefined()
      expect(secrets.endpoints?.getSecret).toBeDefined()
      expect(secrets.endpoints?.createSecret).toBeDefined()
      expect(secrets.endpoints?.updateSecret).toBeDefined()
      expect(secrets.endpoints?.deleteSecret).toBeDefined()
    })
  })

  describe(`GET /_/secrets - List secrets`, () => {
    const ep = getEndpointCfg(secrets.endpoints?.listSecrets)

    it(`should return 200 with secret metadata on success`, async () => {
      const mockSecrets = [
        new Secret({
          id: `1`,
          name: `API_KEY`,
          hashKey: `abc123`,
          orgId: `org-1`,
          encryptedValue: `encrypted`,
          createdAt: new Date(),
        }),
        new Secret({
          id: `2`,
          name: `DB_PASS`,
          hashKey: `def456`,
          projectId: `project-1`,
          encryptedValue: `encrypted`,
          createdAt: new Date(),
        }),
      ]
      mockReq.params = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.secret.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockSecrets })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(200)
      // Should not include encryptedValue in response
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData[0].encryptedValue).toBe(undefined)
      expect(responseData[0]).toHaveProperty(`name`, `API_KEY`)
    })

    it(`should filter by orgId when provided`, async () => {
      const mockSecrets = [
        new Secret({
          id: `1`,
          name: `S1`,
          hashKey: `h1`,
          orgId: `org-1`,
          encryptedValue: `e`,
        }),
      ]
      mockReq.params = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.secret.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockSecrets })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        where: { orgId: `org-1` },
        limit: 50,
        offset: 0,
      })
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].orgId).toBe(`org-1`)
    })

    it(`should pass pagination params to list and include in response`, async () => {
      const mockSecrets = [
        new Secret({
          id: `1`,
          name: `S1`,
          hashKey: `h1`,
          orgId: `org-1`,
          encryptedValue: `e`,
        }),
      ]
      mockReq.params = { orgId: `org-1` }
      mockReq.query = { limit: `25`, offset: `10` }

      const mockList = mockReq.app?.locals.db.services.secret.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockSecrets })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        where: { orgId: `org-1` },
        limit: 25,
        offset: 10,
      })
      const response = mockJson.mock.calls[0][0]
      expect(response.limit).toBe(25)
      expect(response.offset).toBe(10)
    })

    it(`should filter by agentId when provided`, async () => {
      const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      mockAgentGet.mockResolvedValue({ data: { orgId: `org-agent-1` } })

      const mockSecrets = [
        new Secret({
          id: `1`,
          name: `AGENT_SECRET`,
          hashKey: `h1`,
          agentId: `agent-1`,
          encryptedValue: `e`,
        }),
      ]
      mockReq.query = { agentId: `agent-1` }

      const mockList = mockReq.app?.locals.db.services.secret.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockSecrets })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockAgentGet).toHaveBeenCalledWith(`agent-1`)
      expect(mockList).toHaveBeenCalledWith({
        where: { agentId: `agent-1` },
        limit: 50,
        offset: 0,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
    })

    it(`should filter by providerId when provided`, async () => {
      const mockProviderGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProviderGet.mockResolvedValue({ data: { orgId: `org-prov-1` } })

      const mockSecrets = [
        new Secret({
          id: `1`,
          name: `PROVIDER_SECRET`,
          hashKey: `h1`,
          providerId: `provider-1`,
          encryptedValue: `e`,
        }),
      ]
      mockReq.query = { providerId: `provider-1` }

      const mockList = mockReq.app?.locals.db.services.secret.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockSecrets })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockProviderGet).toHaveBeenCalledWith(`provider-1`)
      expect(mockList).toHaveBeenCalledWith({
        where: { providerId: `provider-1` },
        limit: 50,
        offset: 0,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
    })

    it(`should return 404 when provider not found for providerId query`, async () => {
      const mockProviderGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProviderGet.mockResolvedValue({ data: null })

      mockReq.query = { providerId: `provider-nonexistent` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider not found`
      )
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database connection failed`)
      mockReq.params = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.secret.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: mockError })
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database connection failed`
      )
    })
  })

  describe(`GET /_/secrets/:id - Get secret by ID`, () => {
    const ep = getEndpointCfg(secrets.endpoints?.getSecret)

    it(`should return 200 with secret metadata when secret exists`, async () => {
      const mockSecret = new Secret({
        id: `123`,
        name: `API_KEY`,
        hashKey: `abc123`,
        orgId: `org-1`,
        encryptedValue: `encrypted`,
      })
      mockReq.params = { id: `123` }
      mockReq.body = {}

      const mockGet = mockReq.app?.locals.db.services.secret.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockSecret })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      // Should not include encryptedValue
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData.encryptedValue).toBe(undefined)
    })

    it(`should return 404 when secret not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.secret.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Secret not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })
  })

  describe(`POST /_/secrets - Create secret`, () => {
    const ep = getEndpointCfg(secrets.endpoints?.createSecret)

    it(`should return 201 with created secret metadata on success`, async () => {
      // Override role to admin for create operation
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValueOnce({ data: { type: `admin` } })

      const newSecret = { name: `NEW_KEY`, value: `secret-value`, orgId: `org-123` }
      const createdSecret = new Secret({
        id: `456`,
        name: `NEW_KEY`,
        hashKey: `hash`,
        orgId: `org-123`,
        encryptedValue: `encrypted`,
      })
      mockReq.body = newSecret

      const mockCreate = mockReq.app?.locals.db.services.secret.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdSecret })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)
      // Should not include encryptedValue in response
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData.encryptedValue).toBe(undefined)
    })

    it(`should return 400 when name is missing`, async () => {
      mockReq.body = { value: `secret`, orgId: `org-1` }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Secret name is required`
      )
    })

    it(`should return 400 when value is missing`, async () => {
      mockReq.body = { name: `KEY`, orgId: `org-1` }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Secret value is required`
      )
    })

    it(`should return 400 when no owner field is provided`, async () => {
      mockReq.body = { name: `KEY`, value: `secret` }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Secret must belong to one of: orgId, agentId, projectId, providerId`
      )
    })

    it(`should treat secret as project-scoped when both orgId and projectId are provided`, async () => {
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValueOnce({ data: { type: `admin` } })

      const createdSecret = new Secret({
        id: `proj-scoped-1`,
        name: `KEY`,
        hashKey: `hash`,
        projectId: `project-1`,
        encryptedValue: `encrypted`,
      })
      const mockSecretCreate = mockReq.app?.locals.db.services.secret
        .create as ReturnType<typeof vi.fn>
      mockSecretCreate.mockResolvedValue({ data: createdSecret })

      mockReq.body = {
        name: `KEY`,
        value: `secret`,
        orgId: `org-1`,
        projectId: `project-1`,
      }
      await ep.action(mockReq as TRequest, mockRes as Response)
      expect(mockRes.status).toHaveBeenCalledWith(201)
    })

    it(`should return 201 when org+provider dual ownership is used`, async () => {
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValueOnce({ data: { type: `admin` } })

      const mockProviderGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProviderGet.mockResolvedValue({ data: { orgId: `org-1` } })

      const createdSecret = new Secret({
        id: `dual-1`,
        name: `KEY`,
        hashKey: `hash`,
        orgId: `org-1`,
        providerId: `provider-1`,
        encryptedValue: `encrypted`,
      })
      mockReq.params = { orgId: `org-1` }
      mockReq.body = {
        name: `KEY`,
        value: `secret`,
        providerId: `provider-1`,
      }

      const mockCreate = mockReq.app?.locals.db.services.secret.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdSecret })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockProviderGet).toHaveBeenCalledWith(`provider-1`)
      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)

      // Verify both orgId and providerId are set on the created secret
      const secretArg = mockCreate.mock.calls[0][0]
      expect(secretArg.orgId).toBe(`org-1`)
      expect(secretArg.providerId).toBe(`provider-1`)
    })

    it(`should return 403 when provider does not belong to the org`, async () => {
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValueOnce({ data: { type: `admin` } })

      const mockProviderGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProviderGet.mockResolvedValue({ data: { orgId: `org-different` } })

      mockReq.params = { orgId: `org-1` }
      mockReq.body = {
        name: `KEY`,
        value: `secret`,
        providerId: `provider-1`,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider does not belong to this organization`
      )
    })

    it(`should return 400 when project+provider combination is provided (BUG-004 fix)`, async () => {
      mockReq.body = {
        name: `KEY`,
        value: `secret`,
        projectId: `project-1`,
        providerId: `provider-1`,
      }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Secret can only belong to one of: orgId, agentId, projectId, providerId (exclusive arc)`
      )
    })

    it(`should return 201 when creating secret with agentId`, async () => {
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValueOnce({ data: { type: `admin` } })

      const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      mockAgentGet.mockResolvedValue({ data: { orgId: `org-agent-1` } })

      const createdSecret = new Secret({
        id: `789`,
        name: `AGENT_KEY`,
        hashKey: `hash`,
        agentId: `agent-123`,
        encryptedValue: `encrypted`,
      })
      mockReq.body = { name: `AGENT_KEY`, value: `agent-secret`, agentId: `agent-123` }

      const mockCreate = mockReq.app?.locals.db.services.secret.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdSecret })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockAgentGet).toHaveBeenCalledWith(`agent-123`)
      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData.encryptedValue).toBe(undefined)
    })

    it(`should return 400 when agentId + orgId are both provided (exclusive arc)`, async () => {
      mockReq.body = {
        name: `KEY`,
        value: `secret`,
        agentId: `agent-1`,
        orgId: `org-1`,
      }
      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Secret can only belong to one of: orgId, agentId, projectId, providerId (exclusive arc)`
      )
    })

    it(`should return 404 when agent secret references non-existent agent`, async () => {
      mockReq.body = {
        name: `KEY`,
        value: `secret`,
        agentId: `agent-nonexistent`,
      }

      const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
        typeof vi.fn
      >
      mockAgentGet.mockResolvedValue({ data: null })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Agent not found`
      )
    })

    it(`should create provider-scoped secret when providerId is in body and orgId is in route params`, async () => {
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValueOnce({ data: { type: `admin` } })

      const mockProviderGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProviderGet.mockResolvedValue({ data: { orgId: `org-1` } })

      const createdSecret = new Secret({
        id: `prov-secret-1`,
        name: `PROVIDER_KEY`,
        hashKey: `hash`,
        providerId: `provider-1`,
        encryptedValue: `encrypted`,
      })
      mockReq.params = { orgId: `org-1` }
      mockReq.body = {
        name: `PROVIDER_KEY`,
        value: `secret-value`,
        providerId: `provider-1`,
      }

      const mockCreate = mockReq.app?.locals.db.services.secret.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdSecret })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockProviderGet).toHaveBeenCalledWith(`provider-1`)
      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)
    })

    it(`should return 404 when provider secret references non-existent provider (SEC-007 fix)`, async () => {
      // Override role to admin for create operation
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValueOnce({ data: { type: `admin` } })

      mockReq.body = {
        name: `KEY`,
        value: `secret`,
        providerId: `provider-nonexistent`,
      }

      const mockProviderGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
        typeof vi.fn
      >
      mockProviderGet.mockResolvedValue({ data: null })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider not found`
      )
    })
  })

  describe(`PUT /_/secrets/:id - Update secret`, () => {
    const ep = getEndpointCfg(secrets.endpoints?.updateSecret)

    it(`should return 200 with updated secret metadata on success`, async () => {
      // Override role to admin for update operation
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValueOnce({ data: { type: `admin` } })

      const existingSecret = new Secret({
        id: `123`,
        name: `OLD_KEY`,
        hashKey: `old`,
        orgId: `org-1`,
        encryptedValue: `old-encrypted`,
      })
      const updateData = { name: `NEW_KEY` }
      const updatedSecret = { ...existingSecret, name: `NEW_KEY`, hashKey: `new` }
      mockReq.params = { id: `123` }
      mockReq.body = updateData

      const mockGet = mockReq.app?.locals.db.services.secret.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.secret.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingSecret })
      mockUpdate.mockResolvedValue({ data: updatedSecret })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should return 404 when secret not found`, async () => {
      mockReq.params = { id: `nonexistent` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.secret.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Secret not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })
  })

  describe(`DELETE /_/secrets/:id - Delete secret`, () => {
    const ep = getEndpointCfg(secrets.endpoints?.deleteSecret)

    it(`should return 200 with success on delete`, async () => {
      // Override role to admin for delete operation
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValueOnce({ data: { type: `admin` } })

      const existingSecret = new Secret({
        id: `123`,
        name: `TO_DELETE`,
        hashKey: `h`,
        orgId: `o`,
      })
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.secret.get as ReturnType<
        typeof vi.fn
      >
      const mockDelete = mockReq.app?.locals.db.services.secret.delete as ReturnType<
        typeof vi.fn
      >
      const mockProviderList = mockReq.app?.locals.db.services.provider
        .list as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: existingSecret })
      mockProviderList.mockResolvedValue({ data: [] })
      mockDelete.mockResolvedValue({ data: existingSecret })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockDelete).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: { success: true, id: `123` } })
    })

    it(`should return 404 when secret not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.secret.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Secret not found`
      )
      expect(mockGet).toHaveBeenCalledWith(`nonexistent`)
    })

    it(`should return 409 when secret is referenced as a provider API key`, async () => {
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValueOnce({ data: { type: `admin` } })

      const existingSecret = new Secret({
        id: `123`,
        name: `LINKED_KEY`,
        hashKey: `h`,
        orgId: `o`,
      })
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.secret.get as ReturnType<
        typeof vi.fn
      >
      const mockProviderList = mockReq.app?.locals.db.services.provider
        .list as ReturnType<typeof vi.fn>

      mockGet.mockResolvedValue({ data: existingSecret })
      mockProviderList.mockResolvedValue({
        data: [
          new Provider({ id: `prov-1`, name: `My Provider`, type: `ai`, orgId: `o` }),
        ],
      })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        /Cannot delete secret/
      )
    })
  })
})
