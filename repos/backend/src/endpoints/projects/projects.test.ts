import type { Response } from 'express'
import type { TApp, TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { projects } from './projects'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'

describe(`Endpoint projects`, () => {
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
            project: {
              list: vi.fn(),
              get: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
            role: {
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
              getProjectRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
              getUserOrgs: vi
                .fn()
                .mockResolvedValue({ data: [{ id: `org-1`, name: `Org 1` }] }),
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

  describe(`Parent Project configuration`, () => {
    it(`should have correct configuration`, () => {
      expect(projects.path).toBe(`/projects`)
      expect(projects.method).toBe(`use`)
      expect(projects.endpoints).toBeDefined()
      expect(projects.endpoints?.listProjects).toBeDefined()
      expect(projects.endpoints?.getProject).toBeDefined()
      expect(projects.endpoints?.createProject).toBeDefined()
      expect(projects.endpoints?.updateProject).toBeDefined()
      expect(projects.endpoints?.deleteProject).toBeDefined()
    })
  })

  describe(`GET /_/Projects - List Projects`, () => {
    const ep = getEndpointCfg(projects.endpoints?.listProjects)

    it(`should return 200 with Project data on success`, async () => {
      const mockProjects = [
        {
          id: `1`,
          name: `Get Users`,
          gitUrl: `https://api.example.com/users`,
        },
        {
          id: `2`,
          name: `Create User`,
          gitUrl: `https://api.example.com/users`,
        },
      ]

      const mockList = mockReq.app?.locals.db.services.project.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockProjects })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledOnce()
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockProjects })
    })

    it(`should filter by orgId when provided`, async () => {
      const mockProjects = []
      mockReq.query = { orgId: `org-1` }

      const mockList = mockReq.app?.locals.db.services.project.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockProjects })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockList).toHaveBeenCalledWith({ where: { orgId: `org-1` } })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockProjects })
    })

    it(`should return 500 with error message on database failure`, async () => {
      const mockError = new Error(`Database connection failed`)

      const mockList = mockReq.app?.locals.db.services.project.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ error: mockError })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database connection failed` })
    })
  })

  describe(`GET /_/Projects/:id - Get Project by ID`, () => {
    const ep = getEndpointCfg(projects.endpoints?.getProject)

    it(`should return 200 with Project data when Project exists`, async () => {
      const mockProject = {
        id: `123`,
        name: `Get Users`,
        gitUrl: `https://api.example.com/users`,
      }
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockProject })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockProject })
    })

    it(`should return 404 when Project not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Project not found` })
    })
  })

  describe(`POST /_/Projects - Create Project`, () => {
    const ep = getEndpointCfg(projects.endpoints?.createProject)

    it(`should return 201 with created Project on success`, async () => {
      const newProject = {
        orgId: `org-1`,
        name: `New Project`,
        gitUrl: `https://api.example.com/new`,
      }
      const createdProject = { id: `456`, ...newProject }
      mockReq.body = newProject

      const mockCreate = mockReq.app?.locals.db.services.project.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdProject })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ data: createdProject })
    })

    it(`should return 400 when name is missing`, async () => {
      mockReq.body = {
        orgId: `org-1`,
        gitUrl: `https://api.example.com`,
      }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Project name is required` })
    })

    it(`should accept headers and options`, async () => {
      const newProject = {
        orgId: `org-1`,
        name: `New Project`,
        gitUrl: `https://api.example.com/new`,
        headers: { [`Content-Type`]: `application/json` },
        options: { timeout: 5000 },
      }
      const createdProject = { id: `456`, ...newProject }
      mockReq.body = newProject

      const mockCreate = mockReq.app?.locals.db.services.project.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: createdProject })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { [`Content-Type`]: `application/json` },
          options: { timeout: 5000 },
        })
      )
    })
  })

  describe(`PUT /_/Projects/:id - Update Project`, () => {
    const ep = getEndpointCfg(projects.endpoints?.updateProject)

    it(`should return 200 with updated Project on success`, async () => {
      const existingProject = {
        id: `123`,
        name: `Old Name`,
        gitUrl: `https://old.api.com`,

        orgId: `org-1`,
      }
      const updateData = { name: `New Name` }
      const updatedProject = { ...existingProject, ...updateData }
      mockReq.params = { id: `123` }
      mockReq.body = updateData

      const mockGet = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      const mockUpdate = mockReq.app?.locals.db.services.project.update as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingProject })
      mockUpdate.mockResolvedValue({ data: updatedProject })
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: updatedProject })
    })

    it(`should return 404 when Project not found`, async () => {
      mockReq.params = { id: `nonexistent` }
      mockReq.body = { name: `New Name` }

      const mockGet = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Project not found` })
    })
  })

  describe(`DELETE /_/Projects/:id - Delete Project`, () => {
    const ep = getEndpointCfg(projects.endpoints?.deleteProject)

    it(`should return 200 with success on delete`, async () => {
      const existingProject = {
        id: `123`,
        name: `To Delete`,
        gitUrl: `https://api.com`,

        orgId: `org-1`,
      }
      mockReq.params = { id: `123` }

      const mockGet = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      const mockDelete = mockReq.app?.locals.db.services.project.delete as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingProject })
      mockDelete.mockResolvedValue({ data: existingProject })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`123`)
      expect(mockDelete).toHaveBeenCalledWith(`123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: { success: true, id: `123` } })
    })

    it(`should return 404 when Project not found`, async () => {
      mockReq.params = { id: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: undefined })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Project not found` })
    })
  })
})
