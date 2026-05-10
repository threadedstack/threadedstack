import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { sandboxes } from './sandboxes'
import { Sandbox } from '@tdsk/domain'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'

describe(`Sandboxes endpoints`, () => {
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
            sandbox: {
              list: vi.fn(),
              get: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
            provider: {
              get: vi.fn(),
              list: vi.fn(),
              validate: vi.fn().mockResolvedValue(undefined),
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
      expect(sandboxes.path).toBe(`/sandboxes`)
      expect(sandboxes.method).toBe(`use`)
      expect(sandboxes.endpoints).toBeDefined()
      expect(sandboxes.endpoints?.createSandbox).toBeDefined()
      expect(sandboxes.endpoints?.updateSandbox).toBeDefined()
      expect(sandboxes.endpoints?.deleteSandbox).toBeDefined()
      expect(sandboxes.endpoints?.getSandbox).toBeDefined()
      expect(sandboxes.endpoints?.listSandboxes).toBeDefined()
    })

    it(`should have all 6 config CRUD endpoint configs defined`, () => {
      const endpointKeys = Object.keys(sandboxes.endpoints || {})
      expect(endpointKeys).toHaveLength(6)
      expect(endpointKeys).toContain(`createSandbox`)
      expect(endpointKeys).toContain(`updateSandbox`)
      expect(endpointKeys).toContain(`deleteSandbox`)
      expect(endpointKeys).toContain(`getSandbox`)
      expect(endpointKeys).toContain(`listSandboxes`)
      expect(endpointKeys).toContain(`copySandbox`)
    })
  })

  describe(`POST /_/sandboxes - Create sandbox`, () => {
    const ep = getEndpointCfg(sandboxes.endpoints?.createSandbox)

    it(`should return 201 with created sandbox`, async () => {
      const createdSandbox = new Sandbox({
        id: `sandbox-new`,
        name: `New Sandbox`,
        orgId: `org-1`,
        config: { image: `tdsk-sandbox-claude`, runtime: `claude-code` } as any,
      })
      mockReq.body = {
        orgId: `org-1`,
        name: `New Sandbox`,
        config: { image: `tdsk-sandbox-claude`, runtime: `claude-code` },
        providerInputs: [{ id: `provider-1` }],
      }

      const mockValidate = mockReq.app?.locals.db.services.provider
        .validate as ReturnType<typeof vi.fn>
      mockValidate.mockResolvedValue([{ id: `provider-1` }])

      const mockCreate = mockReq.app?.locals.db.services.sandbox.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdSandbox })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdSandbox })
    })

    it(`should create sandbox without providerInputs`, async () => {
      const createdSandbox = new Sandbox({
        id: `sandbox-new`,
        name: `Custom Sandbox`,
        orgId: `org-1`,
        config: { image: `my-image`, runtime: `custom` } as any,
      })
      mockReq.body = {
        orgId: `org-1`,
        name: `Custom Sandbox`,
        config: { image: `my-image`, runtime: `custom` },
      }

      const mockCreate = mockReq.app?.locals.db.services.sandbox.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdSandbox })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)
    })

    it(`should return 400 when name missing`, async () => {
      mockReq.body = {
        orgId: `org-1`,
        config: { image: `tdsk-sandbox-claude` },
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Sandbox name is required`
      )
    })

    it(`should return 400 when config.image missing`, async () => {
      mockReq.body = {
        orgId: `org-1`,
        name: `Test Sandbox`,
        config: {},
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Sandbox config.image is required`
      )
    })

    it(`should return 400 when orgId missing`, async () => {
      mockReq.params = {}
      mockReq.body = {
        name: `Test Sandbox`,
        config: { image: `tdsk-sandbox-claude` },
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `orgId is required`
      )
    })

    it(`should return 404 when provider not found`, async () => {
      mockReq.body = {
        orgId: `org-1`,
        name: `Test Sandbox`,
        config: { image: `tdsk-sandbox-claude` },
        providerInputs: [{ id: `nonexistent-provider` }],
      }

      const mockValidate = mockReq.app?.locals.db.services.provider
        .validate as ReturnType<typeof vi.fn>
      mockValidate.mockRejectedValue(new Error(`Provider nonexistent-provider not found`))

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider nonexistent-provider not found`
      )
    })

    it(`should return 400 when provider is not AI type`, async () => {
      mockReq.body = {
        orgId: `org-1`,
        name: `Test Sandbox`,
        config: { image: `tdsk-sandbox-claude` },
        providerInputs: [{ id: `git-provider` }],
      }

      const mockValidate = mockReq.app?.locals.db.services.provider
        .validate as ReturnType<typeof vi.fn>
      mockValidate.mockRejectedValue(
        new Error(`Invalid git provider. Only ai providers are allowed`)
      )

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Invalid git provider. Only ai providers are allowed`
      )
    })

    it(`should return 403 when provider belongs to different org`, async () => {
      mockReq.body = {
        orgId: `org-1`,
        name: `Test Sandbox`,
        config: { image: `tdsk-sandbox-claude` },
        providerInputs: [{ id: `provider-other-org` }],
      }

      const mockValidate = mockReq.app?.locals.db.services.provider
        .validate as ReturnType<typeof vi.fn>
      mockValidate.mockRejectedValue(
        new Error(`Provider provider-other-org does not belong to organization org-1`)
      )

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider provider-other-org does not belong to organization org-1`
      )
    })

    it(`should return 500 on database error`, async () => {
      mockReq.body = {
        orgId: `org-1`,
        name: `Test Sandbox`,
        config: { image: `tdsk-sandbox-claude` },
      }

      const mockCreate = mockReq.app?.locals.db.services.sandbox.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ error: new Error(`Insert failed`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Insert failed`
      )
    })

    it(`should return 400 when idleTimeoutMinutes is less than 1`, async () => {
      mockReq.body = {
        orgId: `org-1`,
        name: `Test Sandbox`,
        config: { image: `tdsk-sandbox-claude`, idleTimeoutMinutes: 0 },
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `idleTimeoutMinutes must be at least 1`
      )
    })
  })

  describe(`PUT /_/sandboxes/:id - Update sandbox`, () => {
    const ep = getEndpointCfg(sandboxes.endpoints?.updateSandbox)

    it(`should return 200 with updated sandbox`, async () => {
      const existingSandbox = new Sandbox({
        id: `sb_test01`,
        name: `Old Name`,
        orgId: `org-1`,
        config: { image: `tdsk-sandbox-claude` } as any,
      })
      const updatedSandbox = new Sandbox({
        id: `sb_test01`,
        name: `New Name`,
        orgId: `org-1`,
        config: { image: `tdsk-sandbox-claude` } as any,
      })
      mockReq.params = { id: `sb_test01` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.sandbox.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.sandbox.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingSandbox })
      mockUpdate.mockResolvedValue({ data: updatedSandbox })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockUpdate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: updatedSandbox })
    })

    it(`should update sandbox with new providerInputs`, async () => {
      const existingSandbox = new Sandbox({
        id: `sb_test01`,
        name: `Sandbox`,
        orgId: `org-1`,
        config: { image: `tdsk-sandbox-claude` } as any,
      })
      const updatedSandbox = new Sandbox({
        id: `sb_test01`,
        name: `Sandbox`,
        orgId: `org-1`,
        config: { image: `tdsk-sandbox-claude` } as any,
        providerLinks: [
          {
            provider: { id: `provider-1`, type: `ai`, orgId: `org-1` } as any,
            priority: 0,
          },
        ],
      })
      mockReq.params = { id: `sb_test01` }
      mockReq.body = { providerInputs: [{ id: `provider-1` }] }

      const mockGet = mockReq.app?.locals.db.services.sandbox.get as ReturnType<
        typeof vi.fn
      >
      const mockValidate = mockReq.app?.locals.db.services.provider
        .validate as ReturnType<typeof vi.fn>
      const mockUpdate = mockReq.app?.locals.db.services.sandbox.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingSandbox })
      mockValidate.mockResolvedValue([{ id: `provider-1` }])
      mockUpdate.mockResolvedValue({ data: updatedSandbox })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `sb_test01`,
          providerInputs: [{ id: `provider-1` }],
        })
      )
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should clear providers with empty providerInputs array`, async () => {
      const existingSandbox = new Sandbox({
        id: `sb_test01`,
        name: `Sandbox`,
        orgId: `org-1`,
        config: { image: `tdsk-sandbox-claude` } as any,
        providerLinks: [
          {
            provider: { id: `provider-1`, type: `ai`, orgId: `org-1` } as any,
            priority: 0,
          },
        ],
      })
      const updatedSandbox = new Sandbox({
        id: `sb_test01`,
        name: `Sandbox`,
        orgId: `org-1`,
        config: { image: `tdsk-sandbox-claude` } as any,
      })
      mockReq.params = { id: `sb_test01` }
      mockReq.body = { providerInputs: [] }

      const mockGet = mockReq.app?.locals.db.services.sandbox.get as ReturnType<
        typeof vi.fn
      >
      const mockValidate = mockReq.app?.locals.db.services.provider
        .validate as ReturnType<typeof vi.fn>
      const mockUpdate = mockReq.app?.locals.db.services.sandbox.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingSandbox })
      mockValidate.mockResolvedValue([])
      mockUpdate.mockResolvedValue({ data: updatedSandbox })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `sb_test01`,
          providerInputs: [],
        })
      )
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should preserve providers when providerInputs is omitted`, async () => {
      const existingSandbox = new Sandbox({
        id: `sb_test01`,
        name: `Sandbox`,
        orgId: `org-1`,
        config: { image: `tdsk-sandbox-claude` } as any,
        providerLinks: [
          {
            provider: { id: `provider-1`, type: `ai`, orgId: `org-1` } as any,
            priority: 0,
          },
        ],
      })
      const updatedSandbox = new Sandbox({
        id: `sb_test01`,
        name: `Updated Sandbox`,
        orgId: `org-1`,
        config: { image: `tdsk-sandbox-claude` } as any,
        providerLinks: [
          {
            provider: { id: `provider-1`, type: `ai`, orgId: `org-1` } as any,
            priority: 0,
          },
        ],
      })
      mockReq.params = { id: `sb_test01` }
      mockReq.body = { name: `Updated Sandbox` }

      const mockGet = mockReq.app?.locals.db.services.sandbox.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.sandbox.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingSandbox })
      mockUpdate.mockResolvedValue({ data: updatedSandbox })

      await ep.action(mockReq as TRequest, mockRes as Response)

      const updateArg = mockUpdate.mock.calls[0][0]
      expect(updateArg.providerInputs).toBeUndefined()
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should validate provider existence on update`, async () => {
      const existingSandbox = new Sandbox({
        id: `sb_test01`,
        name: `Sandbox`,
        orgId: `org-1`,
        config: { image: `tdsk-sandbox-claude` } as any,
      })
      mockReq.params = { id: `sb_test01` }
      mockReq.body = { providerInputs: [{ id: `nonexistent` }] }

      const mockGet = mockReq.app?.locals.db.services.sandbox.get as ReturnType<
        typeof vi.fn
      >
      const mockValidate = mockReq.app?.locals.db.services.provider
        .validate as ReturnType<typeof vi.fn>
      mockGet.mockResolvedValue({ data: existingSandbox })
      mockValidate.mockRejectedValue(new Error(`Provider nonexistent not found`))

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Provider nonexistent not found`
      )
    })

    it(`should return 404 when sandbox not found`, async () => {
      mockReq.params = { id: `sb_noexst` }
      mockReq.body = { name: `Updated` }

      const mockGet = mockReq.app?.locals.db.services.sandbox.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Sandbox not found`
      )
    })

    it(`should return 400 when idleTimeoutMinutes is less than 1`, async () => {
      const existingSandbox = new Sandbox({
        id: `sb_test01`,
        name: `Sandbox`,
        orgId: `org-1`,
        config: { image: `tdsk-sandbox-claude` } as any,
      })
      mockReq.params = { id: `sb_test01` }
      mockReq.body = { config: { idleTimeoutMinutes: 0 } }

      const mockGet = mockReq.app?.locals.db.services.sandbox.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingSandbox })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `idleTimeoutMinutes must be at least 1`
      )
    })

    it(`should return 500 on database error`, async () => {
      const existingSandbox = new Sandbox({
        id: `sb_test01`,
        name: `Sandbox`,
        orgId: `org-1`,
        config: { image: `tdsk-sandbox-claude` } as any,
      })
      mockReq.params = { id: `sb_test01` }
      mockReq.body = { name: `Updated` }

      const mockGet = mockReq.app?.locals.db.services.sandbox.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.sandbox.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingSandbox })
      mockUpdate.mockResolvedValue({ error: new Error(`Update failed`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Update failed`
      )
    })
  })

  describe(`GET /_/sandboxes - List sandboxes`, () => {
    const ep = getEndpointCfg(sandboxes.endpoints?.listSandboxes)

    it(`should return all sandboxes when user is admin`, async () => {
      const sbLinked = new Sandbox({
        id: `sb-1`,
        name: `Linked`,
        orgId: `org-1`,
        config: { image: `test` } as any,
        projects: [{ id: `proj-1`, name: `Project 1`, orgId: `org-1` } as any],
      })
      const sbUnlinked = new Sandbox({
        id: `sb-2`,
        name: `Built-in`,
        orgId: `org-1`,
        config: { image: `test` } as any,
        projects: [],
      })

      const mockList = mockReq.app?.locals.db.services.sandbox.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [sbLinked, sbUnlinked] })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ data: [sbLinked, sbUnlinked] })
      )
    })

    it(`should return unlinked sandboxes for non-admin (built-ins)`, async () => {
      const sbUnlinked = new Sandbox({
        id: `sb-1`,
        name: `Built-in`,
        orgId: `org-1`,
        config: { image: `test` } as any,
        projects: [],
      })

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValue({ data: { type: `member` } })

      const mockGetUserProjects = mockReq.app?.locals.db.services.role
        .getUserProjects as ReturnType<typeof vi.fn>
      mockGetUserProjects.mockResolvedValue({ data: [] })

      const mockList = mockReq.app?.locals.db.services.sandbox.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [sbUnlinked] })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].id).toBe(`sb-1`)
    })

    it(`should return sandboxes linked to user projects for non-admin`, async () => {
      const sbInProject = new Sandbox({
        id: `sb-1`,
        name: `In Project`,
        orgId: `org-1`,
        config: { image: `test` } as any,
        projects: [{ id: `proj-1`, name: `Project 1`, orgId: `org-1` } as any],
      })

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValue({ data: { type: `member` } })

      const mockGetUserProjects = mockReq.app?.locals.db.services.role
        .getUserProjects as ReturnType<typeof vi.fn>
      mockGetUserProjects.mockResolvedValue({ data: [`proj-1`] })

      const mockList = mockReq.app?.locals.db.services.sandbox.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [sbInProject] })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].id).toBe(`sb-1`)
    })

    it(`should filter out sandboxes in other projects for non-admin`, async () => {
      const sbOtherProject = new Sandbox({
        id: `sb-1`,
        name: `Other Project`,
        orgId: `org-1`,
        config: { image: `test` } as any,
        projects: [{ id: `proj-2`, name: `Project 2`, orgId: `org-1` } as any],
      })
      const sbMyProject = new Sandbox({
        id: `sb-2`,
        name: `My Project`,
        orgId: `org-1`,
        config: { image: `test` } as any,
        projects: [{ id: `proj-1`, name: `Project 1`, orgId: `org-1` } as any],
      })

      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      mockGetOrgRole.mockResolvedValue({ data: { type: `member` } })

      const mockGetUserProjects = mockReq.app?.locals.db.services.role
        .getUserProjects as ReturnType<typeof vi.fn>
      mockGetUserProjects.mockResolvedValue({ data: [`proj-1`] })

      const mockList = mockReq.app?.locals.db.services.sandbox.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [sbOtherProject, sbMyProject] })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].id).toBe(`sb-2`)
    })

    it(`should return 400 when orgId is missing`, async () => {
      mockReq.params = {}
      mockReq.query = {}

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `orgId parameter required`
      )
    })

    it(`should filter by projectId when provided`, async () => {
      const sbInTarget = new Sandbox({
        id: `sb-1`,
        name: `In Target`,
        orgId: `org-1`,
        config: { image: `test` } as any,
        projects: [{ id: `proj-1`, name: `Project 1`, orgId: `org-1` } as any],
      })
      const sbNotInTarget = new Sandbox({
        id: `sb-2`,
        name: `Not In Target`,
        orgId: `org-1`,
        config: { image: `test` } as any,
        projects: [{ id: `proj-2`, name: `Project 2`, orgId: `org-1` } as any],
      })

      mockReq.params = { orgId: `org-1`, projectId: `proj-1` }

      const mockList = mockReq.app?.locals.db.services.sandbox.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: [sbInTarget, sbNotInTarget] })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].id).toBe(`sb-1`)
    })
  })
})
