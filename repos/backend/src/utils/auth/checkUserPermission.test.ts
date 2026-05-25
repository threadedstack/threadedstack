import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ERoleType, EPermAction, EPermResource } from '@tdsk/domain'

import { checkUserPermission } from './checkUserPermission'

const buildMockDb = (overrides: Record<string, any> = {}) => {
  return {
    services: {
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: null }),
        getProjectRole: vi.fn().mockResolvedValue({ data: null }),
        ...overrides.role,
      },
      permissionOverride: {
        getForUser: vi.fn().mockResolvedValue({ data: [] }),
        ...overrides.permissionOverride,
      },
    },
  } as any
}

describe(`checkUserPermission`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should deny when user has no role in the org`, async () => {
    const db = buildMockDb()
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.read,
      EPermResource.sandbox
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe(`Not a member of this organization`)
  })

  it(`should allow super admin for any action`, async () => {
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.super } }),
      },
    })
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.delete,
      EPermResource.org
    )
    expect(result.allowed).toBe(true)
  })

  it(`should allow member to connect to sandbox`, async () => {
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.member } }),
      },
    })
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.connect,
      EPermResource.sandbox
    )
    expect(result.allowed).toBe(true)
  })

  it(`should deny member to delete sandbox`, async () => {
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.member } }),
      },
    })
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.delete,
      EPermResource.sandbox
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain(`sandbox:delete`)
  })

  it(`should deny when role lookup fails`, async () => {
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ error: new Error(`DB error`) }),
      },
    })
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.read,
      EPermResource.sandbox
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe(`Permission check failed, please retry`)
  })

  it(`should deny when project role lookup fails`, async () => {
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.member } }),
        getProjectRole: vi.fn().mockResolvedValue({ error: new Error(`DB error`) }),
      },
    })
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.read,
      EPermResource.sandbox,
      `project-1`
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe(`Permission check failed, please retry`)
  })

  it(`should use highest role when both org and project roles exist`, async () => {
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.member } }),
        getProjectRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.admin } }),
      },
    })
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.manage,
      EPermResource.sandbox,
      `project-1`
    )
    // admin can manage sandbox
    expect(result.allowed).toBe(true)
  })

  it(`should apply permission overrides that grant access`, async () => {
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.member } }),
      },
      permissionOverride: {
        getForUser: vi.fn().mockResolvedValue({
          data: [
            {
              permission: `sandbox:manage`,
              effect: `grant`,
            },
          ],
        }),
      },
    })
    // member normally cannot manage sandbox
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.manage,
      EPermResource.sandbox
    )
    expect(result.allowed).toBe(true)
  })

  it(`should apply permission overrides that deny access`, async () => {
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.member } }),
      },
      permissionOverride: {
        getForUser: vi.fn().mockResolvedValue({
          data: [
            {
              permission: `sandbox:connect`,
              effect: `deny`,
            },
          ],
        }),
      },
    })
    // member normally can connect to sandbox, but override denies it
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.connect,
      EPermResource.sandbox
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain(`sandbox:connect`)
  })

  it(`should deny access when override lookup fails (fail-closed)`, async () => {
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.member } }),
      },
      permissionOverride: {
        getForUser: vi.fn().mockResolvedValue({ error: new Error(`DB error`) }),
      },
    })
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.connect,
      EPermResource.sandbox
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe(`Permission check failed, please retry`)
  })

  it(`should scope override query to projectId when provided`, async () => {
    const getForUser = vi.fn().mockResolvedValue({ data: [] })
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.member } }),
        getProjectRole: vi.fn().mockResolvedValue({ data: null }),
      },
      permissionOverride: { getForUser },
    })
    await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.read,
      EPermResource.sandbox,
      `project-1`
    )
    expect(getForUser).toHaveBeenCalledWith(`user-1`, { projectId: `project-1` })
  })

  it(`should scope override query to orgId when no projectId`, async () => {
    const getForUser = vi.fn().mockResolvedValue({ data: [] })
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.member } }),
      },
      permissionOverride: { getForUser },
    })
    await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.read,
      EPermResource.sandbox
    )
    expect(getForUser).toHaveBeenCalledWith(`user-1`, { orgId: `org-1` })
  })

  it(`should intersect with API key permissions when provided`, async () => {
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.member } }),
      },
    })
    // member has sandbox:read and sandbox:connect, but API key only grants sandbox:read
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.connect,
      EPermResource.sandbox,
      undefined,
      [`sandbox:read`]
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain(`sandbox:connect`)
  })

  it(`should allow when API key permissions include the requested permission`, async () => {
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.member } }),
      },
    })
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.connect,
      EPermResource.sandbox,
      undefined,
      [`sandbox:read`, `sandbox:connect`]
    )
    expect(result.allowed).toBe(true)
  })

  it(`should deny when apiKeyPermissions is empty array (zero permissions)`, async () => {
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.member } }),
      },
    })
    // Empty array means zero permissions - intersects to empty set
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.connect,
      EPermResource.sandbox,
      undefined,
      []
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain(`sandbox:connect`)
  })

  it(`should not intersect when apiKeyPermissions is undefined (no restrictions)`, async () => {
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.member } }),
      },
    })
    // undefined means no API key restriction, user keeps all permissions
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.connect,
      EPermResource.sandbox,
      undefined,
      undefined
    )
    expect(result.allowed).toBe(true)
  })

  it(`should deny when grant override expands permissions but API key does not include the expanded permission`, async () => {
    const db = buildMockDb({
      role: {
        getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.member } }),
      },
      permissionOverride: {
        getForUser: vi.fn().mockResolvedValue({
          data: [
            {
              permission: `sandbox:manage`,
              effect: `grant`,
            },
          ],
        }),
      },
    })
    // member + grant override gives sandbox:manage, but API key only has sandbox:read
    const result = await checkUserPermission(
      db,
      `user-1`,
      `org-1`,
      EPermAction.manage,
      EPermResource.sandbox,
      undefined,
      [`sandbox:read`]
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain(`sandbox:manage`)
  })
})
