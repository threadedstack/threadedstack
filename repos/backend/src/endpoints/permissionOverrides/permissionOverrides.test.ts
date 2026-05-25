import type { Response } from 'express'
import type { TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { listOverrides } from './listOverrides'
import { createOverride } from './createOverride'
import { updateOverride } from './updateOverride'
import { deleteOverride } from './deleteOverride'
import { cleanupOverrides } from './cleanupOverrides'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/middleware/authorize`, () => ({
  authorize: () => vi.fn(),
}))

const mockResolveEffectivePermissions = vi.hoisted(() => vi.fn())
vi.mock(`@TBE/utils/auth/resolveEffectivePermissions`, () => ({
  resolveEffectivePermissions: mockResolveEffectivePermissions,
}))

// ── HELPERS ──────────────────────────────────────────────────────────

const mockOverride = {
  id: `ov-1`,
  userId: `target-user`,
  orgId: `org-1`,
  permission: `sandbox:exec`,
  effect: `grant`,
  grantedBy: `user-1`,
  reason: `Testing`,
}

const buildMockReqRes = () => {
  const mockJson = vi.fn()
  const mockStatus = vi.fn().mockReturnThis()

  const permissionOverrideService = {
    create: vi.fn(),
    update: vi.fn(),
    deleteById: vi.fn(),
    deleteExpired: vi.fn(),
    listForOrg: vi.fn(),
    listForProject: vi.fn(),
    get: vi.fn(),
    getForUser: vi.fn(),
  }

  const roleService = {
    isOrgMember: vi.fn(),
  }

  const projectService = {
    get: vi.fn(),
  }

  const mockRes = {
    status: mockStatus,
    json: mockJson,
  } as unknown as Response

  const mockReq = {
    app: {
      locals: {
        db: {
          services: {
            permissionOverride: permissionOverrideService,
            role: roleService,
            project: projectService,
          },
        },
      },
    } as any,
    user: { id: `user-1`, email: `admin@example.com` } as any,
    params: { orgId: `org-1` },
    query: {},
    body: {},
  } as unknown as TRequest

  return {
    mockReq,
    mockRes,
    mockJson,
    mockStatus,
    permissionOverrideService,
    roleService,
    projectService,
  }
}

// ── ENDPOINT CONFIG ──────────────────────────────────────────────────

describe(`Permission Overrides endpoint configuration`, () => {
  it(`createOverride should have correct path and method`, () => {
    expect(createOverride.path).toBe(`/`)
    expect(createOverride.method).toBe(EPMethod.Post)
  })

  it(`updateOverride should have correct path and method`, () => {
    expect(updateOverride.path).toBe(`/:id`)
    expect(updateOverride.method).toBe(EPMethod.Patch)
  })

  it(`deleteOverride should have correct path and method`, () => {
    expect(deleteOverride.path).toBe(`/:id`)
    expect(deleteOverride.method).toBe(EPMethod.Delete)
  })

  it(`listOverrides should have correct path and method`, () => {
    expect(listOverrides.path).toBe(`/`)
    expect(listOverrides.method).toBe(EPMethod.Get)
  })

  it(`cleanupOverrides should have correct path and method`, () => {
    expect(cleanupOverrides.path).toBe(`/expired`)
    expect(cleanupOverrides.method).toBe(EPMethod.Delete)
  })
})

// ── CREATE OVERRIDE ──────────────────────────────────────────────────

describe(`POST / - createOverride`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let permissionOverrideService: ReturnType<
    typeof buildMockReqRes
  >['permissionOverrideService']
  let roleService: ReturnType<typeof buildMockReqRes>['roleService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    mockStatus = ctx.mockStatus
    permissionOverrideService = ctx.permissionOverrideService
    roleService = ctx.roleService
  })

  it(`should return 400 when orgId is missing`, async () => {
    mockReq.params = {} as any
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `grant`,
    }

    await expect(createOverride.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should return 400 when userId is missing`, async () => {
    mockReq.body = {
      permission: `sandbox:exec`,
      effect: `grant`,
    }

    await expect(createOverride.action(mockReq, mockRes)).rejects.toThrow(
      `userId is required`
    )
  })

  it(`should return 400 when permission is missing`, async () => {
    mockReq.body = {
      userId: `target-user`,
      effect: `grant`,
    }

    await expect(createOverride.action(mockReq, mockRes)).rejects.toThrow(
      `permission is required`
    )
  })

  it(`should return 400 when effect is missing`, async () => {
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
    }

    await expect(createOverride.action(mockReq, mockRes)).rejects.toThrow(
      `effect must be "grant" or "deny"`
    )
  })

  it(`should return 400 when effect is not 'grant' or 'deny'`, async () => {
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `revoke`,
    }

    await expect(createOverride.action(mockReq, mockRes)).rejects.toThrow(
      `effect must be "grant" or "deny"`
    )
  })

  it(`should return 400 when permission format has wrong separator (e.g., "foo:bar")`, async () => {
    mockReq.body = {
      userId: `target-user`,
      permission: `foo:bar`,
      effect: `grant`,
    }

    await expect(createOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Invalid permission format`
    )
  })

  it(`should return 400 when permission format has no colon (e.g., "sandboxexec")`, async () => {
    mockReq.body = {
      userId: `target-user`,
      permission: `sandboxexec`,
      effect: `grant`,
    }

    await expect(createOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Invalid permission format`
    )
  })

  it(`should return 400 when permission is empty string`, async () => {
    mockReq.body = {
      userId: `target-user`,
      permission: ``,
      effect: `grant`,
    }

    await expect(createOverride.action(mockReq, mockRes)).rejects.toThrow(
      `permission is required`
    )
  })

  it(`should return 400 when permission has valid resource but invalid action`, async () => {
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:fly`,
      effect: `grant`,
    }

    await expect(createOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Invalid permission format`
    )
  })

  it(`should return 400 when target user is not an org member`, async () => {
    roleService.isOrgMember.mockResolvedValue({ data: false })
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `grant`,
    }

    await expect(createOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Target user is not a member of this organization`
    )
  })

  it(`should return 500 when DB membership check fails`, async () => {
    roleService.isOrgMember.mockResolvedValue({
      error: { message: `DB connection lost` },
    })
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `grant`,
    }

    await expect(createOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Failed to verify org membership: DB connection lost`
    )
  })

  it(`should return 201 with created override on success`, async () => {
    roleService.isOrgMember.mockResolvedValue({ data: true })
    mockResolveEffectivePermissions.mockResolvedValue(new Set([`sandbox:exec`]))
    permissionOverrideService.create.mockResolvedValue({ data: mockOverride })
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `grant`,
      reason: `Testing`,
    }

    await createOverride.action(mockReq, mockRes)

    expect(mockStatus).toHaveBeenCalledWith(201)
    expect(mockJson).toHaveBeenCalledWith({ data: mockOverride })
    expect(permissionOverrideService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: `target-user`,
        permission: `sandbox:exec`,
        effect: `grant`,
        grantedBy: `user-1`,
        reason: `Testing`,
      })
    )
  })

  it(`should use orgId scope when projectId is not provided`, async () => {
    roleService.isOrgMember.mockResolvedValue({ data: true })
    mockResolveEffectivePermissions.mockResolvedValue(new Set([`sandbox:exec`]))
    permissionOverrideService.create.mockResolvedValue({ data: mockOverride })
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `grant`,
    }

    await createOverride.action(mockReq, mockRes)

    expect(permissionOverrideService.create).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: `org-1` })
    )
  })

  it(`should use projectId scope when projectId is provided`, async () => {
    roleService.isOrgMember.mockResolvedValue({ data: true })
    mockResolveEffectivePermissions.mockResolvedValue(new Set([`sandbox:exec`]))
    permissionOverrideService.create.mockResolvedValue({
      data: { ...mockOverride, projectId: `proj-1` },
    })
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `grant`,
      projectId: `proj-1`,
    }

    await createOverride.action(mockReq, mockRes)

    const createArg = permissionOverrideService.create.mock.calls[0][0]
    expect(createArg.projectId).toBe(`proj-1`)
    // When projectId is provided, orgId should not be on the override data
    expect(createArg).not.toHaveProperty(`orgId`)
  })

  it(`should return 500 when DB create fails`, async () => {
    roleService.isOrgMember.mockResolvedValue({ data: true })
    mockResolveEffectivePermissions.mockResolvedValue(new Set([`sandbox:exec`]))
    permissionOverrideService.create.mockResolvedValue({
      error: { message: `Unique constraint violated` },
    })
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `grant`,
    }

    await expect(createOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Unique constraint violated`
    )
  })

  it(`should prefer req.params.projectId over body projectId`, async () => {
    roleService.isOrgMember.mockResolvedValue({ data: true })
    mockResolveEffectivePermissions.mockResolvedValue(new Set([`sandbox:exec`]))
    permissionOverrideService.create.mockResolvedValue({
      data: { ...mockOverride, orgId: undefined, projectId: `params-proj` },
    })
    mockReq.params = { orgId: `org-1`, projectId: `params-proj` } as any
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `grant`,
      projectId: `body-proj`,
    }

    await createOverride.action(mockReq, mockRes)

    const createArg = permissionOverrideService.create.mock.calls[0][0]
    expect(createArg.projectId).toBe(`params-proj`)
    expect(createArg).not.toHaveProperty(`orgId`)
  })

  it(`should use params.projectId when body has no projectId`, async () => {
    roleService.isOrgMember.mockResolvedValue({ data: true })
    mockResolveEffectivePermissions.mockResolvedValue(new Set([`sandbox:exec`]))
    permissionOverrideService.create.mockResolvedValue({
      data: { ...mockOverride, orgId: undefined, projectId: `params-proj` },
    })
    mockReq.params = { orgId: `org-1`, projectId: `params-proj` } as any
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `grant`,
    }

    await createOverride.action(mockReq, mockRes)

    const createArg = permissionOverrideService.create.mock.calls[0][0]
    expect(createArg.projectId).toBe(`params-proj`)
    expect(createArg).not.toHaveProperty(`orgId`)
  })

  it(`should include expiresAt when provided`, async () => {
    roleService.isOrgMember.mockResolvedValue({ data: true })
    mockResolveEffectivePermissions.mockResolvedValue(new Set([`sandbox:exec`]))
    permissionOverrideService.create.mockResolvedValue({ data: mockOverride })
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `grant`,
      expiresAt: `2030-01-01T00:00:00Z`,
    }

    await createOverride.action(mockReq, mockRes)

    expect(permissionOverrideService.create).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: `2030-01-01T00:00:00Z` })
    )
  })

  it(`should return 403 when granting a permission the caller does not have`, async () => {
    roleService.isOrgMember.mockResolvedValue({ data: true })
    mockResolveEffectivePermissions.mockResolvedValue(new Set([`sandbox:read`]))
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `grant`,
    }

    await expect(createOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Cannot grant a permission you do not have: sandbox:exec`
    )
  })

  it(`should allow granting a permission the caller has`, async () => {
    roleService.isOrgMember.mockResolvedValue({ data: true })
    mockResolveEffectivePermissions.mockResolvedValue(
      new Set([`sandbox:exec`, `sandbox:read`])
    )
    permissionOverrideService.create.mockResolvedValue({ data: mockOverride })
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `grant`,
    }

    await createOverride.action(mockReq, mockRes)

    expect(mockStatus).toHaveBeenCalledWith(201)
    expect(mockJson).toHaveBeenCalledWith({ data: mockOverride })
  })

  it(`should skip caller ceiling check for deny effect`, async () => {
    roleService.isOrgMember.mockResolvedValue({ data: true })
    permissionOverrideService.create.mockResolvedValue({
      data: { ...mockOverride, effect: `deny` },
    })
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `deny`,
    }

    await createOverride.action(mockReq, mockRes)

    expect(mockResolveEffectivePermissions).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(201)
  })

  it(`should allow grant when caller is super admin`, async () => {
    roleService.isOrgMember.mockResolvedValue({ data: true })
    mockResolveEffectivePermissions.mockResolvedValue(`super`)
    permissionOverrideService.create.mockResolvedValue({ data: mockOverride })
    mockReq.body = {
      userId: `target-user`,
      permission: `sandbox:exec`,
      effect: `grant`,
    }

    await createOverride.action(mockReq, mockRes)

    expect(mockStatus).toHaveBeenCalledWith(201)
  })
})

// ── UPDATE OVERRIDE ──────────────────────────────────────────────────

describe(`PATCH /:id - updateOverride`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let permissionOverrideService: ReturnType<
    typeof buildMockReqRes
  >['permissionOverrideService']
  let projectService: ReturnType<typeof buildMockReqRes>['projectService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    mockStatus = ctx.mockStatus
    permissionOverrideService = ctx.permissionOverrideService
    projectService = ctx.projectService
    mockReq.params = { orgId: `org-1`, id: `ov-1` } as any
  })

  it(`should return 400 when id is missing`, async () => {
    mockReq.params = { orgId: `org-1` } as any
    mockReq.body = { effect: `deny` }

    await expect(updateOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Override id is required`
    )
  })

  it(`should return 404 when override not found`, async () => {
    permissionOverrideService.get.mockResolvedValue({ data: null })
    mockReq.body = { effect: `deny` }

    await expect(updateOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Permission override not found`
    )
  })

  it(`should return 403 when override belongs to a different org`, async () => {
    permissionOverrideService.get.mockResolvedValue({
      data: { ...mockOverride, orgId: `other-org` },
    })
    mockReq.body = { effect: `deny` }

    try {
      await updateOverride.action(mockReq, mockRes)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      expect(err.message).toBe(`Override does not belong to this organization`)
    }
  })

  it(`should return 403 when project-scoped override belongs to a different org`, async () => {
    permissionOverrideService.get.mockResolvedValue({
      data: { ...mockOverride, orgId: undefined, projectId: `proj-1` },
    })
    projectService.get.mockResolvedValue({
      data: { id: `proj-1`, orgId: `other-org` },
    })
    mockReq.body = { effect: `deny` }

    try {
      await updateOverride.action(mockReq, mockRes)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      expect(err.message).toBe(`Override does not belong to this organization`)
    }
  })

  it(`should return 500 when project lookup fails during ownership check`, async () => {
    permissionOverrideService.get.mockResolvedValue({
      data: { ...mockOverride, orgId: undefined, projectId: `proj-1` },
    })
    projectService.get.mockResolvedValue({
      error: { message: `DB error` },
    })
    mockReq.body = { effect: `deny` }

    await expect(updateOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Failed to verify project ownership: DB error`
    )
  })

  it(`should return 403 when project-scoped override has a deleted project (null data)`, async () => {
    permissionOverrideService.get.mockResolvedValue({
      data: { ...mockOverride, orgId: undefined, projectId: `proj-deleted` },
    })
    projectService.get.mockResolvedValue({ data: null })
    mockReq.body = { effect: `deny` }

    try {
      await updateOverride.action(mockReq, mockRes)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      expect(err.message).toBe(`Override does not belong to this organization`)
    }
  })

  it(`should return 400 when no fields to update`, async () => {
    permissionOverrideService.get.mockResolvedValue({ data: mockOverride })
    mockReq.body = {}

    await expect(updateOverride.action(mockReq, mockRes)).rejects.toThrow(
      `No fields to update`
    )
  })

  it(`should return 400 when effect is invalid`, async () => {
    permissionOverrideService.get.mockResolvedValue({ data: mockOverride })
    mockReq.body = { effect: `revoke` }

    await expect(updateOverride.action(mockReq, mockRes)).rejects.toThrow(
      `effect must be "grant" or "deny"`
    )
  })

  it(`should return 200 with updated override on success`, async () => {
    const updatedOverride = { ...mockOverride, effect: `deny`, reason: `Updated reason` }
    permissionOverrideService.get.mockResolvedValue({ data: mockOverride })
    permissionOverrideService.update.mockResolvedValue({ data: updatedOverride })
    mockReq.body = { effect: `deny`, reason: `Updated reason` }

    await updateOverride.action(mockReq, mockRes)

    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ data: updatedOverride })
    expect(permissionOverrideService.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: `ov-1`,
        effect: `deny`,
        reason: `Updated reason`,
      })
    )
  })

  it(`should update only effect when only effect is provided`, async () => {
    const updatedOverride = { ...mockOverride, effect: `deny` }
    permissionOverrideService.get.mockResolvedValue({ data: mockOverride })
    permissionOverrideService.update.mockResolvedValue({ data: updatedOverride })
    mockReq.body = { effect: `deny` }

    await updateOverride.action(mockReq, mockRes)

    expect(permissionOverrideService.update).toHaveBeenCalledWith({
      id: `ov-1`,
      effect: `deny`,
    })
  })

  it(`should update only reason when only reason is provided`, async () => {
    const updatedOverride = { ...mockOverride, reason: `New reason` }
    permissionOverrideService.get.mockResolvedValue({ data: mockOverride })
    permissionOverrideService.update.mockResolvedValue({ data: updatedOverride })
    mockReq.body = { reason: `New reason` }

    await updateOverride.action(mockReq, mockRes)

    expect(permissionOverrideService.update).toHaveBeenCalledWith({
      id: `ov-1`,
      reason: `New reason`,
    })
  })

  it(`should return 500 when DB update fails`, async () => {
    permissionOverrideService.get.mockResolvedValue({ data: mockOverride })
    permissionOverrideService.update.mockResolvedValue({
      error: { message: `Update constraint error` },
    })
    mockReq.body = { effect: `deny` }

    await expect(updateOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Update constraint error`
    )
  })

  it(`should return 500 when DB get fails`, async () => {
    permissionOverrideService.get.mockResolvedValue({
      error: { message: `Connection timeout` },
    })
    mockReq.body = { effect: `deny` }

    await expect(updateOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Failed to fetch override: Connection timeout`
    )
  })

  it(`should return 403 when updating effect to grant for a permission the caller does not have`, async () => {
    permissionOverrideService.get.mockResolvedValue({
      data: { ...mockOverride, effect: `deny`, permission: `sandbox:delete` },
    })
    mockResolveEffectivePermissions.mockResolvedValue(new Set([`sandbox:read`]))
    mockReq.body = { effect: `grant` }

    try {
      await updateOverride.action(mockReq, mockRes)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      expect(err.message).toBe(
        `Cannot grant a permission you do not have: sandbox:delete`
      )
    }
  })

  it(`should allow updating effect to grant when caller has the permission`, async () => {
    const updatedOverride = { ...mockOverride, effect: `grant` }
    permissionOverrideService.get.mockResolvedValue({
      data: { ...mockOverride, effect: `deny` },
    })
    mockResolveEffectivePermissions.mockResolvedValue(
      new Set([`sandbox:exec`, `sandbox:read`])
    )
    permissionOverrideService.update.mockResolvedValue({ data: updatedOverride })
    mockReq.body = { effect: `grant` }

    await updateOverride.action(mockReq, mockRes)

    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ data: updatedOverride })
  })

  it(`should skip caller ceiling check when updating effect to deny`, async () => {
    const updatedOverride = { ...mockOverride, effect: `deny` }
    permissionOverrideService.get.mockResolvedValue({ data: mockOverride })
    permissionOverrideService.update.mockResolvedValue({ data: updatedOverride })
    mockReq.body = { effect: `deny` }

    await updateOverride.action(mockReq, mockRes)

    expect(mockResolveEffectivePermissions).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(200)
  })

  it(`should allow updating effect to grant when caller is super admin`, async () => {
    const updatedOverride = { ...mockOverride, effect: `grant` }
    permissionOverrideService.get.mockResolvedValue({
      data: { ...mockOverride, effect: `deny` },
    })
    mockResolveEffectivePermissions.mockResolvedValue(`super`)
    permissionOverrideService.update.mockResolvedValue({ data: updatedOverride })
    mockReq.body = { effect: `grant` }

    await updateOverride.action(mockReq, mockRes)

    expect(mockStatus).toHaveBeenCalledWith(200)
  })
})

// ── DELETE OVERRIDE ──────────────────────────────────────────────────

describe(`DELETE /:id - deleteOverride`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let permissionOverrideService: ReturnType<
    typeof buildMockReqRes
  >['permissionOverrideService']
  let projectService: ReturnType<typeof buildMockReqRes>['projectService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    permissionOverrideService = ctx.permissionOverrideService
    projectService = ctx.projectService
    mockReq.params = { orgId: `org-1`, id: `ov-1` } as any
  })

  it(`should return 400 when id is missing`, async () => {
    mockReq.params = { orgId: `org-1` } as any

    await expect(deleteOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Override id is required`
    )
  })

  it(`should return 404 when override not found`, async () => {
    permissionOverrideService.get.mockResolvedValue({ data: null })

    await expect(deleteOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Permission override not found`
    )
  })

  it(`should return 403 when override belongs to a different org (cross-tenant check)`, async () => {
    permissionOverrideService.get.mockResolvedValue({
      data: { ...mockOverride, orgId: `other-org` },
    })

    try {
      await deleteOverride.action(mockReq, mockRes)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      expect(err.message).toBe(`Override does not belong to this organization`)
    }
  })

  it(`should return 500 when project lookup fails during delete ownership check`, async () => {
    permissionOverrideService.get.mockResolvedValue({
      data: { ...mockOverride, orgId: undefined, projectId: `proj-1` },
    })
    projectService.get.mockResolvedValue({
      error: { message: `DB error` },
    })

    await expect(deleteOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Failed to verify project ownership: DB error`
    )
  })

  it(`should return 403 when project-scoped override has a deleted project during delete`, async () => {
    permissionOverrideService.get.mockResolvedValue({
      data: { ...mockOverride, orgId: undefined, projectId: `proj-deleted` },
    })
    projectService.get.mockResolvedValue({ data: null })

    try {
      await deleteOverride.action(mockReq, mockRes)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      expect(err.message).toBe(`Override does not belong to this organization`)
    }
  })

  it(`should return 200 on successful delete`, async () => {
    permissionOverrideService.get.mockResolvedValue({ data: mockOverride })
    permissionOverrideService.deleteById.mockResolvedValue({ data: true })

    await deleteOverride.action(mockReq, mockRes)

    expect(mockJson).toHaveBeenCalledWith({
      data: { success: true, id: `ov-1` },
    })
  })

  it(`should return 500 when DB get fails`, async () => {
    permissionOverrideService.get.mockResolvedValue({
      error: { message: `Connection timeout` },
    })

    await expect(deleteOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Failed to fetch override: Connection timeout`
    )
  })

  it(`should return 500 when DB delete fails`, async () => {
    permissionOverrideService.get.mockResolvedValue({ data: mockOverride })
    permissionOverrideService.deleteById.mockResolvedValue({
      error: { message: `Delete constraint error` },
    })

    await expect(deleteOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Delete constraint error`
    )
  })

  it(`should return 404 when deleteById returns falsy data`, async () => {
    permissionOverrideService.get.mockResolvedValue({ data: mockOverride })
    permissionOverrideService.deleteById.mockResolvedValue({ data: null })

    await expect(deleteOverride.action(mockReq, mockRes)).rejects.toThrow(
      `Permission override not found`
    )
  })
})

// ── LIST OVERRIDES ───────────────────────────────────────────────────

describe(`GET / - listOverrides`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let permissionOverrideService: ReturnType<
    typeof buildMockReqRes
  >['permissionOverrideService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    permissionOverrideService = ctx.permissionOverrideService
  })

  it(`should return 400 when orgId is missing`, async () => {
    mockReq.params = {} as any

    await expect(listOverrides.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should return 200 with array of overrides`, async () => {
    permissionOverrideService.listForOrg.mockResolvedValue({
      data: [mockOverride],
    })

    await listOverrides.action(mockReq, mockRes)

    expect(mockJson).toHaveBeenCalledWith({ data: [mockOverride] })
    expect(permissionOverrideService.listForOrg).toHaveBeenCalledWith(`org-1`)
  })

  it(`should return 200 with empty array when no overrides`, async () => {
    permissionOverrideService.listForOrg.mockResolvedValue({ data: null })

    await listOverrides.action(mockReq, mockRes)

    expect(mockJson).toHaveBeenCalledWith({ data: [] })
  })

  it(`should return 200 with empty array when data is empty array`, async () => {
    permissionOverrideService.listForOrg.mockResolvedValue({ data: [] })

    await listOverrides.action(mockReq, mockRes)

    expect(mockJson).toHaveBeenCalledWith({ data: [] })
  })

  it(`should return 500 when DB query fails`, async () => {
    permissionOverrideService.listForOrg.mockResolvedValue({
      error: { message: `Table not found` },
    })

    await expect(listOverrides.action(mockReq, mockRes)).rejects.toThrow(
      `Table not found`
    )
  })

  it(`should return project-scoped overrides when projectId is present`, async () => {
    const projectOverride = { ...mockOverride, orgId: undefined, projectId: `proj-1` }
    mockReq.params = { orgId: `org-1`, projectId: `proj-1` } as any
    permissionOverrideService.listForProject.mockResolvedValue({
      data: [projectOverride],
    })

    await listOverrides.action(mockReq, mockRes)

    expect(mockJson).toHaveBeenCalledWith({ data: [projectOverride] })
    expect(permissionOverrideService.listForProject).toHaveBeenCalledWith(`proj-1`)
    expect(permissionOverrideService.listForOrg).not.toHaveBeenCalled()
  })

  it(`should use listForOrg when no projectId is present`, async () => {
    permissionOverrideService.listForOrg.mockResolvedValue({
      data: [mockOverride],
    })

    await listOverrides.action(mockReq, mockRes)

    expect(permissionOverrideService.listForOrg).toHaveBeenCalledWith(`org-1`)
    expect(permissionOverrideService.listForProject).not.toHaveBeenCalled()
  })

  it(`should return 500 when project-scoped DB query fails`, async () => {
    mockReq.params = { orgId: `org-1`, projectId: `proj-1` } as any
    permissionOverrideService.listForProject.mockResolvedValue({
      error: { message: `Project table not found` },
    })

    await expect(listOverrides.action(mockReq, mockRes)).rejects.toThrow(
      `Project table not found`
    )
  })

  it(`should return empty array when project has no overrides`, async () => {
    mockReq.params = { orgId: `org-1`, projectId: `proj-1` } as any
    permissionOverrideService.listForProject.mockResolvedValue({ data: null })

    await listOverrides.action(mockReq, mockRes)

    expect(mockJson).toHaveBeenCalledWith({ data: [] })
  })
})

// ── CLEANUP OVERRIDES ───────────────────────────────────────────────

describe(`DELETE /expired - cleanupOverrides`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let permissionOverrideService: ReturnType<
    typeof buildMockReqRes
  >['permissionOverrideService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    mockStatus = ctx.mockStatus
    permissionOverrideService = ctx.permissionOverrideService
  })

  it(`should return 400 when orgId is missing`, async () => {
    mockReq.params = {} as any

    await expect(cleanupOverrides.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should pass orgId to deleteExpired and return 200 with deleted count on success`, async () => {
    permissionOverrideService.deleteExpired.mockResolvedValue({ data: 5 })

    await cleanupOverrides.action(mockReq, mockRes)

    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ data: { deletedCount: 5 } })
    expect(permissionOverrideService.deleteExpired).toHaveBeenCalledWith(`org-1`)
  })

  it(`should return 200 with deletedCount 0 when no expired overrides`, async () => {
    permissionOverrideService.deleteExpired.mockResolvedValue({ data: 0 })

    await cleanupOverrides.action(mockReq, mockRes)

    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ data: { deletedCount: 0 } })
  })

  it(`should default deletedCount to 0 when data is nullish`, async () => {
    permissionOverrideService.deleteExpired.mockResolvedValue({ data: null })

    await cleanupOverrides.action(mockReq, mockRes)

    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ data: { deletedCount: 0 } })
  })

  it(`should return 500 when DB cleanup fails`, async () => {
    permissionOverrideService.deleteExpired.mockResolvedValue({
      error: { message: `Cleanup query failed` },
    })

    await expect(cleanupOverrides.action(mockReq, mockRes)).rejects.toThrow(
      `Cleanup query failed`
    )
  })
})
