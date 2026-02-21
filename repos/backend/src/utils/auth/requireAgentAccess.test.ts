import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TRequest } from '@TBE/types'
import { ERoleType } from '@tdsk/domain'

import { requireAgentAccess } from './requireAgentAccess'

describe(`requireAgentAccess`, () => {
  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      user: { id: `test-user-id`, email: `test@example.com` },
      app: {
        locals: {
          db: {
            services: {
              agent: {
                get: vi.fn(),
              },
              role: {
                getOrgRole: vi.fn().mockResolvedValue({ data: null }),
                getProjectRole: vi.fn().mockResolvedValue({ data: null }),
                getUserProjects: vi.fn().mockResolvedValue({ data: [] }),
              },
            },
          },
        },
      },
      params: {},
      query: {},
      body: {},
      ...overrides,
    } as unknown as TRequest
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should allow org admin to access any agent (bypass)`, async () => {
    const req = buildMockReq()
    const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
      typeof vi.fn
    >
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })

    const agentData = { projects: [{ id: `project-1` }] }

    await expect(
      requireAgentAccess(req, `agent-1`, `org-1`, agentData)
    ).resolves.toBeUndefined()

    // Should NOT fetch user projects since admin bypasses
    const mockGetUserProjects = req.app.locals.db.services.role
      .getUserProjects as ReturnType<typeof vi.fn>
    expect(mockGetUserProjects).not.toHaveBeenCalled()
  })

  it(`should allow org owner to access any agent (bypass)`, async () => {
    const req = buildMockReq()
    const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
      typeof vi.fn
    >
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.owner } })

    const agentData = { projects: [] }

    await expect(
      requireAgentAccess(req, `agent-1`, `org-1`, agentData)
    ).resolves.toBeUndefined()
  })

  it(`should allow project member to access agent in their project`, async () => {
    const req = buildMockReq()
    const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
      typeof vi.fn
    >
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })

    const mockGetUserProjects = req.app.locals.db.services.role
      .getUserProjects as ReturnType<typeof vi.fn>
    mockGetUserProjects.mockResolvedValue({ data: [`project-1`] })

    const agentData = { projects: [{ id: `project-1` }] }

    await expect(
      requireAgentAccess(req, `agent-1`, `org-1`, agentData)
    ).resolves.toBeUndefined()

    expect(mockGetUserProjects).toHaveBeenCalledWith(`test-user-id`)
  })

  it(`should throw 403 when non-member tries to access agent`, async () => {
    const req = buildMockReq()
    const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
      typeof vi.fn
    >
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })

    const mockGetUserProjects = req.app.locals.db.services.role
      .getUserProjects as ReturnType<typeof vi.fn>
    mockGetUserProjects.mockResolvedValue({ data: [`other-project`] })

    const agentData = { projects: [{ id: `project-1` }] }

    try {
      await requireAgentAccess(req, `agent-1`, `org-1`, agentData)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      expect(err.message).toContain(`not a member of any project`)
    }
  })

  it(`should throw 403 when agent has no projects and user is not admin`, async () => {
    const req = buildMockReq()
    const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
      typeof vi.fn
    >
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })

    const agentData = { projects: [] }

    try {
      await requireAgentAccess(req, `agent-1`, `org-1`, agentData)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      expect(err.message).toContain(`not assigned to any project`)
    }
  })

  it(`should throw 401 when user is not authenticated`, async () => {
    const req = buildMockReq({ user: {} })

    try {
      await requireAgentAccess(req, `agent-1`, `org-1`)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(401)
      expect(err.message).toContain(`Authentication required`)
    }
  })

  it(`should throw 401 when user is undefined`, async () => {
    const req = buildMockReq({ user: undefined })

    try {
      await requireAgentAccess(req, `agent-1`, `org-1`)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(401)
    }
  })

  it(`should fetch agent from DB when agentData not provided`, async () => {
    const req = buildMockReq()
    const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
      typeof vi.fn
    >
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })

    const mockGetUserProjects = req.app.locals.db.services.role
      .getUserProjects as ReturnType<typeof vi.fn>
    mockGetUserProjects.mockResolvedValue({ data: [`project-1`] })

    const mockAgentGet = req.app.locals.db.services.agent.get as ReturnType<typeof vi.fn>
    mockAgentGet.mockResolvedValue({
      data: { id: `agent-1`, projects: [{ id: `project-1` }] },
    })

    await expect(requireAgentAccess(req, `agent-1`, `org-1`)).resolves.toBeUndefined()

    expect(mockAgentGet).toHaveBeenCalledWith(`agent-1`)
    expect(mockGetUserProjects).toHaveBeenCalledWith(`test-user-id`)
  })

  it(`should throw 404 when agent not found in DB`, async () => {
    const req = buildMockReq()
    const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
      typeof vi.fn
    >
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })

    const mockAgentGet = req.app.locals.db.services.agent.get as ReturnType<typeof vi.fn>
    mockAgentGet.mockResolvedValue({ data: undefined })

    try {
      await requireAgentAccess(req, `agent-1`, `org-1`)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(404)
      expect(err.message).toContain(`Agent not found`)
    }
  })

  it(`should throw 404 when agent fetch returns error`, async () => {
    const req = buildMockReq()
    const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
      typeof vi.fn
    >
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })

    const mockAgentGet = req.app.locals.db.services.agent.get as ReturnType<typeof vi.fn>
    mockAgentGet.mockResolvedValue({ error: new Error(`DB error`) })

    try {
      await requireAgentAccess(req, `agent-1`, `org-1`)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(404)
    }
  })

  it(`should allow access when user is member of one of multiple projects`, async () => {
    const req = buildMockReq()
    const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
      typeof vi.fn
    >
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })

    const mockGetUserProjects = req.app.locals.db.services.role
      .getUserProjects as ReturnType<typeof vi.fn>
    // User is only a member of project-2
    mockGetUserProjects.mockResolvedValue({ data: [`project-2`] })

    const agentData = {
      projects: [{ id: `project-1` }, { id: `project-2` }, { id: `project-3` }],
    }

    await expect(
      requireAgentAccess(req, `agent-1`, `org-1`, agentData)
    ).resolves.toBeUndefined()

    // Single bulk fetch instead of N queries
    expect(mockGetUserProjects).toHaveBeenCalledTimes(1)
    expect(mockGetUserProjects).toHaveBeenCalledWith(`test-user-id`)
  })

  it(`should throw 403 when user is not member of any of multiple projects`, async () => {
    const req = buildMockReq()
    const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
      typeof vi.fn
    >
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })

    const mockGetUserProjects = req.app.locals.db.services.role
      .getUserProjects as ReturnType<typeof vi.fn>
    mockGetUserProjects.mockResolvedValue({ data: [`other-project`] })

    const agentData = {
      projects: [{ id: `project-1` }, { id: `project-2` }],
    }

    try {
      await requireAgentAccess(req, `agent-1`, `org-1`, agentData)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      // Single bulk fetch
      expect(mockGetUserProjects).toHaveBeenCalledTimes(1)
    }
  })

  it(`should allow super admin to bypass access check`, async () => {
    const req = buildMockReq()
    const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
      typeof vi.fn
    >
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.super } })

    const agentData = { projects: [] }

    await expect(
      requireAgentAccess(req, `agent-1`, `org-1`, agentData)
    ).resolves.toBeUndefined()
  })

  it(`should treat undefined projects array same as empty`, async () => {
    const req = buildMockReq()
    const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
      typeof vi.fn
    >
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })

    const agentData = { projects: undefined as any }

    try {
      await requireAgentAccess(req, `agent-1`, `org-1`, agentData)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      expect(err.message).toContain(`not assigned to any project`)
    }
  })

  it(`should throw 500 when getUserProjects fails`, async () => {
    const req = buildMockReq()
    const mockGetOrgRole = req.app.locals.db.services.role.getOrgRole as ReturnType<
      typeof vi.fn
    >
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })

    const mockGetUserProjects = req.app.locals.db.services.role
      .getUserProjects as ReturnType<typeof vi.fn>
    mockGetUserProjects.mockResolvedValue({ error: new Error(`DB connection failed`) })

    const agentData = { projects: [{ id: `project-1` }] }

    try {
      await requireAgentAccess(req, `agent-1`, `org-1`, agentData)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(500)
      expect(err.message).toContain(`Failed to retrieve user projects`)
    }
  })
})
