import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TRequest } from '@TBE/types'
import { ERoleType } from '@tdsk/domain'

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  getUserRole: vi.fn(),
}))

import { getUserRole } from '@TBE/utils/auth/checkPermission'
import { requireProjectAccess } from './requireProjectAccess'

const mockGetUserRole = getUserRole as ReturnType<typeof vi.fn>

describe(`requireProjectAccess`, () => {
  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      user: { id: `test-user-id`, email: `test@example.com` },
      app: {
        locals: {
          db: {
            services: {
              role: {
                isProjectMember: vi.fn().mockResolvedValue({ data: false }),
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

  it(`should allow admin to bypass project membership check`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.admin)

    await expect(requireProjectAccess(req, `project-1`, `org-1`)).resolves.toBeUndefined()

    const mockIsProjectMember = req.app.locals.db.services.role
      .isProjectMember as ReturnType<typeof vi.fn>
    expect(mockIsProjectMember).not.toHaveBeenCalled()
  })

  it(`should allow owner to bypass project membership check`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.owner)

    await expect(requireProjectAccess(req, `project-1`, `org-1`)).resolves.toBeUndefined()

    const mockIsProjectMember = req.app.locals.db.services.role
      .isProjectMember as ReturnType<typeof vi.fn>
    expect(mockIsProjectMember).not.toHaveBeenCalled()
  })

  it(`should allow super to bypass project membership check`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.super)

    await expect(requireProjectAccess(req, `project-1`, `org-1`)).resolves.toBeUndefined()

    const mockIsProjectMember = req.app.locals.db.services.role
      .isProjectMember as ReturnType<typeof vi.fn>
    expect(mockIsProjectMember).not.toHaveBeenCalled()
  })

  it(`should allow member who is a project member`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)

    const mockIsProjectMember = req.app.locals.db.services.role
      .isProjectMember as ReturnType<typeof vi.fn>
    mockIsProjectMember.mockResolvedValue({ data: true })

    await expect(requireProjectAccess(req, `project-1`, `org-1`)).resolves.toBeUndefined()

    expect(mockIsProjectMember).toHaveBeenCalledWith(`test-user-id`, `project-1`)
  })

  it(`should throw 403 when member is not a project member`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)

    const mockIsProjectMember = req.app.locals.db.services.role
      .isProjectMember as ReturnType<typeof vi.fn>
    mockIsProjectMember.mockResolvedValue({ data: false })

    try {
      await requireProjectAccess(req, `project-1`, `org-1`)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      expect(err.message).toContain(`not a member of this project`)
    }
  })

  it(`should throw 401 when userId is undefined (no user.id)`, async () => {
    const req = buildMockReq({ user: { email: `test@example.com` } })

    try {
      await requireProjectAccess(req, `project-1`, `org-1`)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(401)
      expect(err.message).toContain(`Authentication required`)
    }
  })

  it(`should throw 401 when user object is undefined`, async () => {
    const req = buildMockReq({ user: undefined })

    try {
      await requireProjectAccess(req, `project-1`, `org-1`)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(401)
      expect(err.message).toContain(`Authentication required`)
    }
  })

  it(`should throw 500 when isProjectMember returns error`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)

    const mockIsProjectMember = req.app.locals.db.services.role
      .isProjectMember as ReturnType<typeof vi.fn>
    mockIsProjectMember.mockResolvedValue({
      error: new Error(`DB connection failed`),
    })

    try {
      await requireProjectAccess(req, `project-1`, `org-1`)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(500)
      expect(err.message).toContain(`Failed to check project membership`)
    }
  })

  it(`should fall through to membership check when getUserRole returns null`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(null)

    const mockIsProjectMember = req.app.locals.db.services.role
      .isProjectMember as ReturnType<typeof vi.fn>
    mockIsProjectMember.mockResolvedValue({ data: true })

    await expect(requireProjectAccess(req, `project-1`, `org-1`)).resolves.toBeUndefined()

    expect(mockIsProjectMember).toHaveBeenCalledWith(`test-user-id`, `project-1`)
  })
})
