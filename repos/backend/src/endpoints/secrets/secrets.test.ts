import type { Response } from 'express'
import type { TApp, TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { secrets } from './secrets'
import { Secret } from '@tdsk/domain'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { config } from '@TBE/configs/backend.config'
import { PolarService } from '@TBE/services/payments'

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
        payments: new PolarService(config.payments),
        db: {
          services: {
            secret: {
              list: vi.fn(),
              get: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
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

  const getEndpointCfg = (endpoint: TEndpoint): TEndpointConfig =>
    isFunc(endpoint) ? endpoint(buildApp()) : endpoint

  beforeEach(() => {
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response)

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
      mockReq.query = { orgId: `org-1` }

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
        new Secret({
          id: `2`,
          name: `S2`,
          hashKey: `h2`,
          orgId: `org-2`,
          encryptedValue: `e`,
        }),
      ]
      mockReq.query = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.secret.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockSecrets })
      await ep.action(mockReq as TRequest, mockRes as Response)

      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].orgId).toBe(`org-1`)
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database connection failed`)
      mockReq.query = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.secret.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: mockError })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database connection failed` })
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

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Secret not found` })
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
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Secret name is required` })
    })

    it(`should return 400 when value is missing`, async () => {
      mockReq.body = { name: `KEY`, orgId: `org-1` }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Secret value is required` })
    })

    it(`should return 400 when neither orgId nor projectId is provided`, async () => {
      mockReq.body = { name: `KEY`, value: `secret` }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: `Secret must belong to an org, project, or provider`,
      })
    })

    it(`should return 400 when both orgId and projectId are provided`, async () => {
      mockReq.body = {
        name: `KEY`,
        value: `secret`,
        orgId: `org-1`,
        projectId: `project-1`,
      }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: `Secret can only belong to one of: org, project, or provider (exclusive arc)`,
      })
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

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Secret not found` })
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
      mockGet.mockResolvedValue({ data: existingSecret })
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

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Secret not found` })
    })
  })
})
