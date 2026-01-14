import type { Response } from 'express'
import type { TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { projects } from './projects'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { config } from '@TBE/configs/backend.config'

describe(`Endpoint projects`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const getEndpointCfg = (endpoint: TEndpoint): TEndpointConfig =>
    isFunc(endpoint) ? endpoint(config) : endpoint

  beforeEach(() => {
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response)

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: {
        locals: {
          db: {
            services: {
              Project: {
                list: vi.fn(),
                get: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                delete: vi.fn(),
              },
            },
          },
        },
      } as any,
      params: {},
      body: {},
      query: {},
    }
  })

  describe(`Parent Project configuration`, () => {
    it(`should have correct configuration`, () => {
      expect(projects.path).toBe(`/Projects`)
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
          url: `https://api.example.com/users`,
          method: `GET`,
          projectId: `project-1`,
        },
        {
          id: `2`,
          name: `Create User`,
          url: `https://api.example.com/users`,
          method: `POST`,
          projectId: `project-1`,
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

    it(`should filter by projectId when provided`, async () => {
      const mockProjects = [
        { id: `1`, name: `EP1`, url: `u1`, method: `GET`, projectId: `project-1` },
        { id: `2`, name: `EP2`, url: `u2`, method: `GET`, projectId: `project-2` },
      ]
      mockReq.query = { projectId: `project-1` }

      const mockList = mockReq.app?.locals.db.services.project.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockProjects })
      await ep.action(mockReq as TRequest, mockRes as Response)

      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].projectId).toBe('project-1')
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
        url: `https://api.example.com/users`,
        method: `GET`,
        projectId: `project-1`,
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
        name: `New Project`,
        url: `https://api.example.com/new`,
        method: `GET`,
        projectId: `project-123`,
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
        url: `https://api.example.com`,
        method: `GET`,
        projectId: `project-1`,
      }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Project name is required` })
    })

    it(`should return 400 when url is missing`, async () => {
      mockReq.body = { name: `Test`, method: `GET`, projectId: `project-1` }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Project URL is required` })
    })

    it(`should return 400 when method is missing`, async () => {
      mockReq.body = {
        name: `Test`,
        url: `https://api.example.com`,
        projectId: `project-1`,
      }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Project method is required` })
    })

    it(`should return 400 when projectId is missing`, async () => {
      mockReq.body = { name: `Test`, url: `https://api.example.com`, method: `GET` }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Project projectId is required` })
    })

    it(`should return 400 when method is invalid`, async () => {
      mockReq.body = {
        name: `Test`,
        url: `https://api.example.com`,
        method: `INVALID`,
        projectId: `project-1`,
      }
      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson.mock.calls[0][0].error).toContain(`Invalid HTTP method`)
    })

    it(`should accept headers and options`, async () => {
      const newProject = {
        name: `New Project`,
        url: `https://api.example.com/new`,
        method: `POST`,
        projectId: `project-123`,
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
        url: `https://old.api.com`,
        method: `GET`,
        projectId: `project-1`,
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

    it(`should return 400 when method is invalid`, async () => {
      const existingProject = {
        id: `123`,
        name: `Test`,
        url: `https://api.com`,
        method: `GET`,
        projectId: `project-1`,
      }
      mockReq.params = { id: `123` }
      mockReq.body = { method: `INVALID` }

      const mockGet = mockReq.app?.locals.db.services.project.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: existingProject })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson.mock.calls[0][0].error).toContain(`Invalid HTTP method`)
    })
  })

  describe(`DELETE /_/Projects/:id - Delete Project`, () => {
    const ep = getEndpointCfg(projects.endpoints?.deleteProject)

    it(`should return 200 with success on delete`, async () => {
      const existingProject = {
        id: `123`,
        name: `To Delete`,
        url: `https://api.com`,
        method: `GET`,
        projectId: `project-1`,
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
