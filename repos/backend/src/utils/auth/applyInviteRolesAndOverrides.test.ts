import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Invitation } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { logger } from '@TBE/utils/logger'
import { applyInviteRolesAndOverrides } from './applyInviteRolesAndOverrides'

const buildMockDb = (overrides: Record<string, any> = {}) => {
  return {
    services: {
      role: {
        create: vi.fn().mockResolvedValue({ data: { id: `role-1` } }),
        ...overrides.role,
      },
      permissionOverride: {
        create: vi.fn().mockResolvedValue({ data: { id: `override-1` } }),
        ...overrides.permissionOverride,
      },
    },
  } as any
}

const buildInvitation = (overrides: Partial<Invitation> = {}): Invitation =>
  ({
    orgId: `org-1`,
    invitedBy: `inviter-1`,
    ...overrides,
  }) as Invitation

describe(`applyInviteRolesAndOverrides`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`is a no-op when projectRoles and permissionOverrides are both undefined`, async () => {
    const db = buildMockDb()
    const warnings: string[] = []

    await applyInviteRolesAndOverrides(db, buildInvitation(), `user-1`, warnings)

    expect(db.services.role.create).not.toHaveBeenCalled()
    expect(db.services.permissionOverride.create).not.toHaveBeenCalled()
    expect(warnings).toEqual([])
  })

  it(`is a no-op when projectRoles and permissionOverrides are empty arrays`, async () => {
    const db = buildMockDb()
    const warnings: string[] = []

    await applyInviteRolesAndOverrides(
      db,
      buildInvitation({ projectRoles: [], permissionOverrides: [] }),
      `user-1`,
      warnings
    )

    expect(db.services.role.create).not.toHaveBeenCalled()
    expect(db.services.permissionOverride.create).not.toHaveBeenCalled()
    expect(warnings).toEqual([])
  })

  it(`creates a project role for each entry in projectRoles`, async () => {
    const db = buildMockDb()
    const warnings: string[] = []

    await applyInviteRolesAndOverrides(
      db,
      buildInvitation({
        projectRoles: [
          { projectId: `proj-1`, roleType: `member` as any },
          { projectId: `proj-2`, roleType: `admin` as any },
        ],
      }),
      `user-1`,
      warnings
    )

    expect(db.services.role.create).toHaveBeenCalledTimes(2)
    expect(db.services.role.create).toHaveBeenNthCalledWith(1, {
      projectId: `proj-1`,
      userId: `user-1`,
      type: `member`,
    })
    expect(db.services.role.create).toHaveBeenNthCalledWith(2, {
      projectId: `proj-2`,
      userId: `user-1`,
      type: `admin`,
    })
    expect(warnings).toEqual([])
  })

  it(`logs and pushes a warning, but continues, when a role create fails`, async () => {
    const db = buildMockDb({
      role: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ error: new Error(`DB error`) })
          .mockResolvedValueOnce({ data: { id: `role-2` } }),
      },
    })
    const warnings: string[] = []

    await applyInviteRolesAndOverrides(
      db,
      buildInvitation({
        projectRoles: [
          { projectId: `proj-1`, roleType: `member` as any },
          { projectId: `proj-2`, roleType: `member` as any },
        ],
      }),
      `user-1`,
      warnings
    )

    expect(db.services.role.create).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledWith(
      `Failed to create project role for proj-1:`,
      expect.any(Error)
    )
    expect(warnings).toEqual([`Failed to set up project access for proj-1`])
  })

  it(`creates a project-scoped permission override when po.projectId is present`, async () => {
    const db = buildMockDb()
    const warnings: string[] = []

    await applyInviteRolesAndOverrides(
      db,
      buildInvitation({
        permissionOverrides: [
          {
            projectId: `proj-1`,
            permission: `agent:read` as any,
            effect: `grant`,
            reason: `invite grant`,
            expiresAt: `2026-08-01T00:00:00.000Z`,
          },
        ],
      }),
      `user-1`,
      warnings
    )

    expect(db.services.permissionOverride.create).toHaveBeenCalledWith({
      userId: `user-1`,
      effect: `grant`,
      reason: `invite grant`,
      expiresAt: `2026-08-01T00:00:00.000Z`,
      permission: `agent:read`,
      grantedBy: `inviter-1`,
      projectId: `proj-1`,
    })
  })

  it(`falls back to orgId scoping when po.projectId is absent`, async () => {
    const db = buildMockDb()
    const warnings: string[] = []

    await applyInviteRolesAndOverrides(
      db,
      buildInvitation({
        orgId: `org-9`,
        permissionOverrides: [{ permission: `org:write` as any, effect: `deny` }],
      }),
      `user-1`,
      warnings
    )

    expect(db.services.permissionOverride.create).toHaveBeenCalledWith({
      userId: `user-1`,
      effect: `deny`,
      reason: undefined,
      expiresAt: undefined,
      permission: `org:write`,
      grantedBy: `inviter-1`,
      orgId: `org-9`,
    })
  })

  it(`logs and pushes a warning, but continues, when a permission override create fails`, async () => {
    const db = buildMockDb({
      permissionOverride: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ error: new Error(`DB error`) })
          .mockResolvedValueOnce({ data: { id: `override-2` } }),
      },
    })
    const warnings: string[] = []

    await applyInviteRolesAndOverrides(
      db,
      buildInvitation({
        permissionOverrides: [
          { permission: `agent:read` as any, effect: `grant` },
          { permission: `agent:write` as any, effect: `deny` },
        ],
      }),
      `user-1`,
      warnings
    )

    expect(db.services.permissionOverride.create).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledWith(
      `Failed to create permission override:`,
      expect.any(Error)
    )
    expect(warnings).toEqual([`Failed to set agent:read permission override`])
  })
})
