import type { Response } from 'express'
import type { TApp, TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { domains } from './domains'
import { Domain } from '@tdsk/domain'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

const mockResolveCname = vi.fn()
const mockResolve4 = vi.fn()

vi.mock(`node:dns`, () => ({
  default: {
    promises: {
      resolveCname: (...args: any[]) => mockResolveCname(...args),
      resolve4: (...args: any[]) => mockResolve4(...args),
    },
  },
}))

describe(`Domains endpoints`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const buildApp = () => {
    return {
      locals: {
        config: {
          ...config,
          domains: {
            proxyHost: `proxy.example.com`,
            prewarmHeader: `X-Prewarm`,
          },
        },
        payments: new PaymentsService(config.payments),
        db: {
          services: {
            domain: {
              by: vi.fn(),
              list: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
              verified: vi.fn(),
            },
            project: {
              get: vi.fn(),
            },
            role: {
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
              getProjectRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
              getUserOrgs: vi.fn().mockResolvedValue({ data: [`org-1`] }),
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
    it(`should have correct path and method`, () => {
      expect(domains.path).toBe(`/domains`)
      expect(domains.method).toBe(`use`)
    })

    it(`should have all endpoint configs defined`, () => {
      expect(domains.endpoints).toBeDefined()
      expect(domains.endpoints?.getDomain).toBeDefined()
      expect(domains.endpoints?.listDomains).toBeDefined()
      expect(domains.endpoints?.createDomain).toBeDefined()
      expect(domains.endpoints?.updateDomain).toBeDefined()
      expect(domains.endpoints?.deleteDomain).toBeDefined()
    })
  })

  describe(`GET /_/domains - List domains`, () => {
    const ep = getEndpointCfg(domains.endpoints?.listDomains)

    it(`should return 200 with domains when orgId provided`, async () => {
      const mockDomains = [
        new Domain({ id: `dom-1`, domain: `test.example.com`, orgId: `org-1` }),
        new Domain({ id: `dom-2`, domain: `api.example.com`, orgId: `org-1` }),
      ]
      mockReq.params = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.domain.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockDomains })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        where: { orgId: `org-1` },
        limit: 50,
        offset: 0,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockDomains, limit: 50, offset: 0 })
    })

    it(`should return 400 when neither orgId nor projectId provided`, async () => {
      mockReq.query = {}

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Either orgId or projectId is required`
      )
    })

    it(`should return 200 with domains when projectId provided`, async () => {
      const mockDomains = [
        new Domain({ id: `dom-3`, domain: `app.example.com`, projectId: `project-1` }),
      ]
      mockReq.params = { projectId: `project-1` }

      const mockProjectGet = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      mockProjectGet.mockResolvedValue({
        data: { id: `project-1`, orgId: `org-1`, name: `Project` },
      })

      const mockList = mockReq.app?.locals.db.services.domain.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockDomains })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        where: { projectId: `project-1` },
        limit: 50,
        offset: 0,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockDomains, limit: 50, offset: 0 })
    })

    it(`should return 404 when project not found for projectId query`, async () => {
      mockReq.params = { projectId: `project-nonexistent` }

      const mockProjectGet = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      mockProjectGet.mockResolvedValue({ data: null })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Project not found`
      )
    })

    it(`should allow member to list domains from their own org`, async () => {
      const mockDomains = [
        new Domain({ id: `dom-1`, domain: `member.example.com`, orgId: `org-1` }),
      ]
      mockReq.params = { orgId: `org-1` }

      const mockGetUserOrgs = mockReq.app?.locals.db.services.role
        .getUserOrgs as ReturnType<typeof vi.fn>
      mockGetUserOrgs.mockResolvedValue({ data: [`org-1`] })

      const mockList = mockReq.app?.locals.db.services.domain.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue(mockDomains)

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({
        where: { orgId: `org-1` },
        limit: 50,
        offset: 0,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it(`should return 401 when user not authenticated`, async () => {
      mockReq.user = undefined as any
      mockReq.params = { orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should return 403 for non-member regular users`, async () => {
      mockReq.params = { orgId: `org-999` }

      const mockGetUserOrgs = mockReq.app?.locals.db.services.role
        .getUserOrgs as ReturnType<typeof vi.fn>
      mockGetUserOrgs.mockResolvedValue({ data: [`org-1`] })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Access denied`
      )
    })

    it(`should return 500 on database error`, async () => {
      mockReq.params = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.domain.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockRejectedValue(new Error(`Database connection failed`))

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database connection failed`
      )
    })
  })

  describe(`GET /_/domains/:domain - Get domain`, () => {
    const ep = getEndpointCfg(domains.endpoints?.getDomain)

    it(`should return 200 with domain record when found`, async () => {
      const mockDomain = new Domain({
        id: `dom-1`,
        domain: `test.example.com`,
        orgId: `org-1`,
      })
      mockReq.params = { domain: `test.example.com` }

      const mockBy = mockReq.app?.locals.db.services.domain.by as ReturnType<typeof vi.fn>
      mockBy.mockResolvedValue({ data: mockDomain })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockBy).toHaveBeenCalledWith({ domain: `test.example.com` })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockDomain })
    })

    it(`should return 404 when domain not found`, async () => {
      mockReq.params = { domain: `nonexistent.example.com` }

      const mockBy = mockReq.app?.locals.db.services.domain.by as ReturnType<typeof vi.fn>
      mockBy.mockResolvedValue({
        data: undefined,
        error: new Error(`Domain "nonexistent.example.com" not found!`),
      })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Domain "nonexistent.example.com" not found!`
      )
      expect(mockBy).toHaveBeenCalledWith({ domain: `nonexistent.example.com` })
    })

    it(`should check project permission for project-based domain`, async () => {
      const mockDomain = new Domain({
        id: `dom-1`,
        domain: `proj.example.com`,
        projectId: `project-1`,
      })
      const mockProject = { id: `project-1`, orgId: `org-1`, name: `P1` }
      mockReq.params = { domain: `proj.example.com` }

      const mockBy = mockReq.app?.locals.db.services.domain.by as ReturnType<typeof vi.fn>
      const mockProjectGet = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      mockBy.mockResolvedValue({ data: mockDomain })
      mockProjectGet.mockResolvedValue({ data: mockProject })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockProjectGet).toHaveBeenCalledWith(`project-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockDomain })
    })

    it(`should return 400 when domain param missing`, async () => {
      mockReq.params = {}

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Domain parameter is required`
      )
    })
  })

  describe(`POST /_/domains - Create domain`, () => {
    const ep = getEndpointCfg(domains.endpoints?.createDomain)

    it(`should return 400 when domain name missing`, async () => {
      mockReq.body = { orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Domain is required`
      )
    })

    it(`should return 400 when neither orgId nor projectId provided`, async () => {
      mockReq.body = { domain: `test.example.com` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Either orgId or projectId is required`
      )
    })

    it(`should return 201 when DNS CNAME points to proxy host`, async () => {
      mockResolveCname.mockResolvedValue([`proxy.example.com`])

      const mockDomain = new Domain({
        id: `dom-new`,
        domain: `new.example.com`,
        orgId: `org-1`,
      })
      mockReq.body = { domain: `new.example.com`, orgId: `org-1` }

      const mockCreate = mockReq.app?.locals.db.services.domain.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: mockDomain })

      // Mock global fetch for pre-warm
      const origFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        text: vi.fn().mockResolvedValue(`OK`),
      }) as any

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({
        data: mockDomain,
        message: `Domain created successfully. SSL certificate will be generated shortly.`,
      })

      globalThis.fetch = origFetch
    })

    it(`should fall back to A record when CNAME fails`, async () => {
      mockResolveCname.mockRejectedValue(new Error(`CNAME not found`))
      mockResolve4.mockResolvedValue([`proxy.example.com`])

      const mockDomain = new Domain({
        id: `dom-new`,
        domain: `a-record.example.com`,
        orgId: `org-1`,
      })
      mockReq.body = { domain: `a-record.example.com`, orgId: `org-1` }

      const mockCreate = mockReq.app?.locals.db.services.domain.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: mockDomain })

      const origFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        text: vi.fn().mockResolvedValue(`OK`),
      }) as any

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)

      globalThis.fetch = origFetch
    })

    it(`should return 400 when DNS does not point to proxy host`, async () => {
      mockResolveCname.mockResolvedValue([`other-host.example.com`])

      mockReq.body = { domain: `wrong-dns.example.com`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Domain must point to proxy.example.com`
      )
    })

    it(`should return 400 when DNS resolution fails entirely`, async () => {
      mockResolveCname.mockRejectedValue(new Error(`CNAME not found`))
      mockResolve4.mockRejectedValue(new Error(`A record not found`))

      mockReq.body = { domain: `nodns.example.com`, orgId: `org-1` }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `DNS verification failed`
      )
    })

    it(`should create domain with projectId and verify project exists`, async () => {
      mockResolveCname.mockResolvedValue([`proxy.example.com`])

      const mockProject = { id: `project-1`, orgId: `org-1`, name: `P1` }
      const mockDomain = new Domain({
        id: `dom-new`,
        domain: `proj.example.com`,
        projectId: `project-1`,
      })
      mockReq.body = { domain: `proj.example.com`, projectId: `project-1` }

      const mockProjectGet = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      mockProjectGet.mockResolvedValue({ data: mockProject })

      const mockCreate = mockReq.app?.locals.db.services.domain.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: mockDomain })

      const origFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        text: vi.fn().mockResolvedValue(`OK`),
      }) as any

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockProjectGet).toHaveBeenCalledWith(`project-1`)
      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)

      globalThis.fetch = origFetch
    })

    it(`should return 404 when project not found for projectId`, async () => {
      mockResolveCname.mockResolvedValue([`proxy.example.com`])

      mockReq.body = { domain: `proj.example.com`, projectId: `project-nonexistent` }

      const mockProjectGet = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      mockProjectGet.mockResolvedValue({ data: null })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Project not found`
      )
    })

    it(`should return 500 on database create error`, async () => {
      mockResolveCname.mockResolvedValue([`proxy.example.com`])

      mockReq.body = { domain: `test.example.com`, orgId: `org-1` }

      const mockCreate = mockReq.app?.locals.db.services.domain.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({
        error: new Error(`Failed to create domain`),
      })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Failed to create domain`
      )
    })
  })

  describe(`PATCH /_/domains/:domain - Update domain`, () => {
    const ep = getEndpointCfg(domains.endpoints?.updateDomain)

    it(`should return 200 with updated domain on success`, async () => {
      const existingDomain = new Domain({
        id: `dom-1`,
        domain: `test.example.com`,
        orgId: `org-1`,
        verified: false,
      })
      const updatedDomain = new Domain({
        id: `dom-1`,
        domain: `test.example.com`,
        orgId: `org-1`,
        verified: true,
      })
      mockReq.params = { domain: `test.example.com` }
      mockReq.body = { verified: true }

      const mockBy = mockReq.app?.locals.db.services.domain.by as ReturnType<typeof vi.fn>
      const mockUpdate = mockReq.app?.locals.db.services.domain.update as ReturnType<
        typeof vi.fn
      >
      mockBy.mockResolvedValue({ data: existingDomain })
      mockUpdate.mockResolvedValue({ data: updatedDomain })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockBy).toHaveBeenCalledWith({ domain: `test.example.com` })
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: updatedDomain })
    })

    it(`should return 404 when domain not found`, async () => {
      mockReq.params = { domain: `nonexistent.example.com` }
      mockReq.body = { verified: true }

      const mockBy = mockReq.app?.locals.db.services.domain.by as ReturnType<typeof vi.fn>
      mockBy.mockResolvedValue({
        data: undefined,
        error: new Error(`Domain "nonexistent.example.com" not found!`),
      })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Domain "nonexistent.example.com" not found!`
      )
    })

    it(`should return 400 when domain param missing`, async () => {
      mockReq.params = {}
      mockReq.body = { verified: true }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Domain parameter is required`
      )
    })
  })

  describe(`DELETE /_/domains/:domain - Delete domain`, () => {
    const ep = getEndpointCfg(domains.endpoints?.deleteDomain)

    it(`should return 200 with success on delete`, async () => {
      const existingDomain = new Domain({
        id: `dom-1`,
        domain: `test.example.com`,
        orgId: `org-1`,
      })
      mockReq.params = { domain: `test.example.com` }

      const mockBy = mockReq.app?.locals.db.services.domain.by as ReturnType<typeof vi.fn>
      const mockDelete = mockReq.app?.locals.db.services.domain.delete as ReturnType<
        typeof vi.fn
      >
      mockBy.mockResolvedValue({ data: existingDomain })
      mockDelete.mockResolvedValue({ data: existingDomain })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockBy).toHaveBeenCalledWith({ domain: `test.example.com` })
      expect(mockDelete).toHaveBeenCalledWith(`test.example.com`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: {
          success: true,
          domain: `test.example.com`,
        },
      })
    })

    it(`should return 404 when domain not found`, async () => {
      mockReq.params = { domain: `nonexistent.example.com` }

      const mockBy = mockReq.app?.locals.db.services.domain.by as ReturnType<typeof vi.fn>
      mockBy.mockResolvedValue({
        data: undefined,
        error: new Error(`Domain "nonexistent.example.com" not found!`),
      })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Domain "nonexistent.example.com" not found!`
      )
    })

    it(`should return 400 when domain param missing`, async () => {
      mockReq.params = {}

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Domain parameter is required`
      )
    })

    it(`should return 500 on database delete error`, async () => {
      const existingDomain = new Domain({
        id: `dom-1`,
        domain: `test.example.com`,
        orgId: `org-1`,
      })
      mockReq.params = { domain: `test.example.com` }

      const mockBy = mockReq.app?.locals.db.services.domain.by as ReturnType<typeof vi.fn>
      const mockDelete = mockReq.app?.locals.db.services.domain.delete as ReturnType<
        typeof vi.fn
      >
      mockBy.mockResolvedValue({ data: existingDomain })
      mockDelete.mockResolvedValue({
        error: new Error(`Database delete failed`),
      })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database delete failed`
      )
    })
  })
})
