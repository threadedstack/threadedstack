import type { TRequest } from '@TBE/types'
import type { TPermission, PermissionOverride } from '@tdsk/domain'

import { ERoleType } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveEffectivePermissions } from './resolveEffectivePermissions'

const mockGetUserRole = vi.hoisted(() => vi.fn())
const mockFromAuthHeaders = vi.hoisted(() => vi.fn().mockReturnValue({}))

vi.mock(`./checkPermission`, () => ({
  getUserRole: mockGetUserRole,
}))

vi.mock(`@tdsk/domain`, async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tdsk/domain')>()
  return {
    ...actual,
    fromAuthHeaders: mockFromAuthHeaders,
  }
})

// ── HELPERS ──────────────────────────────────────────────────────────

const buildMockReq = (overrides: Record<string, any> = {}): TRequest => {
  return {
    user: { id: `user-1`, email: `test@example.com` },
    app: {
      locals: {
        db: {
          services: {
            permissionOverride: {
              getForUser: vi.fn().mockResolvedValue({ data: [] }),
            },
            apiKey: {
              get: vi.fn().mockResolvedValue({ data: null }),
            },
          },
        },
      },
    },
    params: { orgId: `org-1` },
    query: {},
    body: {},
    header: vi.fn().mockReturnValue(undefined),
    ...overrides,
  } as unknown as TRequest
}

// ── TESTS ────────────────────────────────────────────────────────────

describe(`resolveEffectivePermissions`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should throw 401 when userId is missing (no user on request)`, async () => {
    const req = buildMockReq({ user: {} })

    try {
      await resolveEffectivePermissions(req, { orgId: `org-1` })
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(401)
      expect(err.message).toBe(`Authentication required`)
    }
  })

  it(`should throw 401 when user is undefined`, async () => {
    const req = buildMockReq({ user: undefined })

    try {
      await resolveEffectivePermissions(req, { orgId: `org-1` })
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(401)
    }
  })

  it(`should throw 403 'Not a member of this organization' when only orgId scope and user has no role`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(null)

    try {
      await resolveEffectivePermissions(req, { orgId: `org-1` })
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      expect(err.message).toBe(`Not a member of this organization`)
    }
  })

  it(`should throw 403 'Not a member of this project' when only projectId scope and user has no role`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(null)

    try {
      await resolveEffectivePermissions(req, { projectId: `proj-1` })
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      expect(err.message).toBe(`Not a member of this project`)
    }
  })

  it(`should throw 403 with combined message when both org and project scopes set`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(null)

    try {
      await resolveEffectivePermissions(req, {
        orgId: `org-1`,
        projectId: `proj-1`,
      })
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      expect(err.message).toBe(`Not a member of this organization or project`)
    }
  })

  it(`should throw 400 MISSING_SCOPE when neither orgId nor projectId is set`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(null)

    try {
      await resolveEffectivePermissions(req, {})
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(400)
      expect(err.code).toBe(`MISSING_SCOPE`)
    }
  })

  it(`should return 'super' when user role is super`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.super)

    const result = await resolveEffectivePermissions(req, { orgId: `org-1` })

    expect(result).toBe(`super`)
  })

  it(`should return base permissions when no scope ID (no orgId/projectId)`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)

    const result = await resolveEffectivePermissions(req, {})

    expect(result).toBeInstanceOf(Set)
    const permissions = result as Set<TPermission>
    // member has sandbox:read but not sandbox:delete
    expect(permissions.has(`sandbox:read`)).toBe(true)
    expect(permissions.has(`sandbox:delete`)).toBe(false)
  })

  it(`should return base permissions when overrides query returns empty array`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)

    const overrideSvc = req.app.locals.db.services.permissionOverride
    ;(overrideSvc.getForUser as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })

    const result = await resolveEffectivePermissions(req, { orgId: `org-1` })

    expect(result).toBeInstanceOf(Set)
    const permissions = result as Set<TPermission>
    expect(permissions.has(`sandbox:read`)).toBe(true)
    expect(permissions.has(`sandbox:delete`)).toBe(false)
  })

  it(`should return base permissions when overrides query returns null data`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)

    const overrideSvc = req.app.locals.db.services.permissionOverride
    ;(overrideSvc.getForUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
    })

    const result = await resolveEffectivePermissions(req, { orgId: `org-1` })

    expect(result).toBeInstanceOf(Set)
    const permissions = result as Set<TPermission>
    expect(permissions.has(`sandbox:read`)).toBe(true)
  })

  it(`should correctly merge grant overrides (adds permissions not in role template)`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)

    const grantOverride: PermissionOverride = {
      id: `ov-1`,
      userId: `user-1`,
      orgId: `org-1`,
      grantedBy: `admin-1`,
      permission: `sandbox:delete`,
      effect: `grant`,
    }

    const overrideSvc = req.app.locals.db.services.permissionOverride
    ;(overrideSvc.getForUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [grantOverride],
    })

    const result = await resolveEffectivePermissions(req, { orgId: `org-1` })

    const permissions = result as Set<TPermission>
    // member does not normally have sandbox:delete, but the grant override adds it
    expect(permissions.has(`sandbox:delete`)).toBe(true)
    // existing permissions should still be present
    expect(permissions.has(`sandbox:read`)).toBe(true)
  })

  it(`should correctly merge deny overrides (removes permissions from role template)`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)

    const denyOverride: PermissionOverride = {
      id: `ov-2`,
      userId: `user-1`,
      orgId: `org-1`,
      grantedBy: `admin-1`,
      permission: `sandbox:read`,
      effect: `deny`,
    }

    const overrideSvc = req.app.locals.db.services.permissionOverride
    ;(overrideSvc.getForUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [denyOverride],
    })

    const result = await resolveEffectivePermissions(req, { orgId: `org-1` })

    const permissions = result as Set<TPermission>
    // member normally has sandbox:read, but the deny override removes it
    expect(permissions.has(`sandbox:read`)).toBe(false)
    // other permissions should still be present
    expect(permissions.has(`sandbox:connect`)).toBe(true)
  })

  it(`should let deny overrides win over grant overrides for the same permission`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)

    const grantOverride: PermissionOverride = {
      id: `ov-1`,
      userId: `user-1`,
      orgId: `org-1`,
      grantedBy: `admin-1`,
      permission: `sandbox:delete`,
      effect: `grant`,
    }
    const denyOverride: PermissionOverride = {
      id: `ov-2`,
      userId: `user-1`,
      orgId: `org-1`,
      grantedBy: `admin-1`,
      permission: `sandbox:delete`,
      effect: `deny`,
    }

    const overrideSvc = req.app.locals.db.services.permissionOverride
    ;(overrideSvc.getForUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [grantOverride, denyOverride],
    })

    const result = await resolveEffectivePermissions(req, { orgId: `org-1` })

    const permissions = result as Set<TPermission>
    // deny wins: sandbox:delete should not be present
    expect(permissions.has(`sandbox:delete`)).toBe(false)
  })

  it(`should ignore expired overrides`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)

    const expiredOverride: PermissionOverride = {
      id: `ov-1`,
      userId: `user-1`,
      orgId: `org-1`,
      grantedBy: `admin-1`,
      permission: `sandbox:delete`,
      effect: `grant`,
      expiresAt: `2020-01-01T00:00:00Z`, // expired in the past
    }

    const overrideSvc = req.app.locals.db.services.permissionOverride
    ;(overrideSvc.getForUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [expiredOverride],
    })

    const result = await resolveEffectivePermissions(req, { orgId: `org-1` })

    const permissions = result as Set<TPermission>
    // expired grant should be ignored, so sandbox:delete should not be present
    expect(permissions.has(`sandbox:delete`)).toBe(false)
  })

  it(`should use projectId for override lookup when both projectId and orgId are present`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)

    const overrideSvc = req.app.locals.db.services.permissionOverride
    const getForUserMock = overrideSvc.getForUser as ReturnType<typeof vi.fn>
    getForUserMock.mockResolvedValue({ data: [] })

    await resolveEffectivePermissions(req, {
      orgId: `org-1`,
      projectId: `proj-1`,
    })

    expect(getForUserMock).toHaveBeenCalledWith(`user-1`, { projectId: `proj-1` })
  })

  it(`should use orgId for override lookup when only orgId is present`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)

    const overrideSvc = req.app.locals.db.services.permissionOverride
    const getForUserMock = overrideSvc.getForUser as ReturnType<typeof vi.fn>
    getForUserMock.mockResolvedValue({ data: [] })

    await resolveEffectivePermissions(req, { orgId: `org-1` })

    expect(getForUserMock).toHaveBeenCalledWith(`user-1`, { orgId: `org-1` })
  })

  it(`should return admin-level permissions for admin role with no overrides`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.admin)

    const overrideSvc = req.app.locals.db.services.permissionOverride
    ;(overrideSvc.getForUser as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })

    const result = await resolveEffectivePermissions(req, { orgId: `org-1` })

    const permissions = result as Set<TPermission>
    // admin has member perms + admin perms
    expect(permissions.has(`sandbox:read`)).toBe(true) // from member
    expect(permissions.has(`sandbox:delete`)).toBe(true) // from admin
    // owner-only permissions should not be present
    expect(permissions.has(`org:delete`)).toBe(false)
  })

  it(`should intersect with API key permissions when request is via API key`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)
    mockFromAuthHeaders.mockReturnValue({ apiKeyId: `key-1` })

    const apiKeySvc = req.app.locals.db.services.apiKey
    ;(apiKeySvc.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { permissions: [`sandbox:read`] },
    })

    const result = await resolveEffectivePermissions(req, { orgId: `org-1` })

    const permissions = result as Set<TPermission>
    // member has sandbox:read AND sandbox:connect, but API key only grants sandbox:read
    expect(permissions.has(`sandbox:read`)).toBe(true)
    expect(permissions.has(`sandbox:connect`)).toBe(false)
  })

  it(`should intersect to empty set when API key has empty permissions array`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)
    mockFromAuthHeaders.mockReturnValue({ apiKeyId: `key-1` })

    const apiKeySvc = req.app.locals.db.services.apiKey
    ;(apiKeySvc.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { permissions: [] },
    })

    const result = await resolveEffectivePermissions(req, { orgId: `org-1` })

    const permissions = result as Set<TPermission>
    // Empty permissions array means zero permissions - intersects to empty set
    expect(permissions.has(`sandbox:read`)).toBe(false)
    expect(permissions.has(`sandbox:connect`)).toBe(false)
    expect(permissions.size).toBe(0)
  })

  it(`should not intersect when API key permissions is null (no restrictions)`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)
    mockFromAuthHeaders.mockReturnValue({ apiKeyId: `key-1` })

    const apiKeySvc = req.app.locals.db.services.apiKey
    ;(apiKeySvc.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { permissions: null },
    })

    const result = await resolveEffectivePermissions(req, { orgId: `org-1` })

    const permissions = result as Set<TPermission>
    // null permissions means no restriction, user keeps all permissions
    expect(permissions.has(`sandbox:read`)).toBe(true)
    expect(permissions.has(`sandbox:connect`)).toBe(true)
  })

  it(`should throw 500 when API key lookup fails`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)
    mockFromAuthHeaders.mockReturnValue({ apiKeyId: `key-1` })

    const apiKeySvc = req.app.locals.db.services.apiKey
    ;(apiKeySvc.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: new Error(`DB connection lost`),
    })

    try {
      await resolveEffectivePermissions(req, { orgId: `org-1` })
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(500)
      expect(err.message).toContain(`Failed to resolve API key permissions`)
    }
  })

  it(`should skip API key intersection when no apiKeyId in headers`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)
    mockFromAuthHeaders.mockReturnValue({})

    const result = await resolveEffectivePermissions(req, { orgId: `org-1` })

    const permissions = result as Set<TPermission>
    // No API key means no intersection, user keeps all permissions
    expect(permissions.has(`sandbox:read`)).toBe(true)
    expect(permissions.has(`sandbox:connect`)).toBe(true)
    // API key service should not be called
    expect(req.app.locals.db.services.apiKey.get).not.toHaveBeenCalled()
  })

  it(`should filter to project-scope only when API key has projectId set`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.admin)
    mockFromAuthHeaders.mockReturnValue({ apiKeyId: `key-project-scoped` })

    const apiKeySvc = req.app.locals.db.services.apiKey
    ;(apiKeySvc.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      // API key is project-scoped (has a projectId) with full admin permissions listed
      data: {
        projectId: `proj-1`,
        permissions: null, // null means no additional intersection — only scope filtering applies
      },
    })

    const result = await resolveEffectivePermissions(req, { orgId: `org-1` })

    const permissions = result as Set<TPermission>
    // Org-level permissions must be stripped for project-scoped API keys
    expect(permissions.has(`org:delete`)).toBe(false)
    expect(permissions.has(`org:update`)).toBe(false)
    expect(permissions.has(`org:manage`)).toBe(false)
    // Project-scoped permissions should still be present
    expect(permissions.has(`sandbox:exec`)).toBe(true)
    expect(permissions.has(`project:read`)).toBe(true)
  })

  it(`should throw 401 when API key is not found (revoked/deleted)`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)
    mockFromAuthHeaders.mockReturnValue({ apiKeyId: `key-deleted` })

    const apiKeySvc = req.app.locals.db.services.apiKey
    ;(apiKeySvc.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null })

    try {
      await resolveEffectivePermissions(req, { orgId: `org-1` })
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(401)
      expect(err.message).toBe(`API key not found`)
    }
  })

  it(`should skip API key intersection when resolving permissions for a targetUserId`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.admin)
    mockFromAuthHeaders.mockReturnValue({ apiKeyId: `caller-key` })

    const apiKeySvc = req.app.locals.db.services.apiKey
    const apiKeyGet = apiKeySvc.get as ReturnType<typeof vi.fn>
    apiKeyGet.mockResolvedValue({
      data: { permissions: [`sandbox:read`] },
    })

    const result = await resolveEffectivePermissions(
      req,
      { orgId: `org-1` },
      `target-user`
    )

    const permissions = result as Set<TPermission>
    // Caller's key only grants sandbox:read but we're computing the target's
    // full admin permissions, so the caller's key must NOT shrink them.
    expect(permissions.has(`sandbox:read`)).toBe(true)
    expect(permissions.has(`sandbox:delete`)).toBe(true)
    expect(apiKeyGet).not.toHaveBeenCalled()
  })

  it(`should throw 500 when permission override query returns an error`, async () => {
    const req = buildMockReq()
    mockGetUserRole.mockResolvedValue(ERoleType.member)

    const overrideSvc = req.app.locals.db.services.permissionOverride
    ;(overrideSvc.getForUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: new Error(`DB error`),
    })

    try {
      await resolveEffectivePermissions(req, { orgId: `org-1` })
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(500)
      expect(err.message).toContain(`Failed to resolve permission overrides`)
      expect(err.message).toContain(`DB error`)
    }
  })
})
