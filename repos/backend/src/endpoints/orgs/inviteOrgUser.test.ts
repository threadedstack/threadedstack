import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ERoleType, ESubscriptionTier } from '@tdsk/domain'
import { inviteOrgUser } from './inviteOrgUser'
import { config } from '@TBE/configs/backend.config'

const mockGetUserRole = vi.hoisted(() => vi.fn())
const mockResolveEffectivePermissions = vi.hoisted(() => vi.fn())
const mockInvited = vi.hoisted(() => vi.fn())
const mockIsMember = vi.hoisted(() => vi.fn())
const mockExisting = vi.hoisted(() => vi.fn())
const mockCreate = vi.hoisted(() => vi.fn())
const mockInviteServiceCtor = vi.hoisted(() => vi.fn())

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  getUserRole: mockGetUserRole,
}))

vi.mock(`@TBE/utils/auth/resolveEffectivePermissions`, () => ({
  resolveEffectivePermissions: mockResolveEffectivePermissions,
}))

vi.mock(`@TBE/services/invite`, () => ({
  InviteService: mockInviteServiceCtor.mockImplementation(() => ({
    invited: mockInvited,
    isMember: mockIsMember,
    existing: mockExisting,
    create: mockCreate,
  })),
}))

describe(`POST /:orgId/users/invite - Invite org user`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const buildApp = () =>
    ({
      locals: {
        config,
        email: { sendMemberNotification: vi.fn(), invitation: vi.fn() },
        db: {
          services: {
            org: {
              get: vi.fn().mockResolvedValue({
                data: { id: `org-1`, name: `Test Org`, ownerId: null },
              }),
            },
            user: {
              byEmail: vi.fn().mockResolvedValue({ data: null }),
            },
            project: {
              get: vi.fn(),
            },
            subscription: {
              findByUser: vi.fn(),
            },
            role: {
              getOrgMembers: vi.fn(),
            },
          },
        },
      },
    }) as unknown as TApp

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserRole.mockResolvedValue(ERoleType.owner)
    mockInvited.mockResolvedValue(undefined)
    mockIsMember.mockResolvedValue(undefined)
    mockCreate.mockResolvedValue({ invite: { id: `inv-default` }, warnings: [] })

    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: buildApp(),
      user: { id: `inviter-1`, email: `inviter@example.com` } as any,
      params: { orgId: `org-1` },
      body: { email: `newuser@example.com`, roleType: ERoleType.member },
      query: {},
    }
  })

  it(`should have correct endpoint configuration`, () => {
    expect(inviteOrgUser.path).toBe(`/:orgId/users/invite`)
    expect(inviteOrgUser.method).toBe(`post`)
    expect(typeof inviteOrgUser.action).toBe(`function`)
  })

  it(`should throw 400 when email is missing`, async () => {
    mockReq.body = { roleType: ERoleType.member }

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Email is required`)
  })

  it(`should throw 400 when roleType is missing`, async () => {
    mockReq.body = { email: `newuser@example.com` }

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Role type is required`)
  })

  it(`should throw 400 when roleType is invalid`, async () => {
    mockReq.body = { email: `newuser@example.com`, roleType: `superadmin` }

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Invalid role type`)
  })

  it(`should throw 403 when caller cannot manage the target role`, async () => {
    mockGetUserRole.mockResolvedValue(ERoleType.admin)
    mockReq.body = { email: `newuser@example.com`, roleType: ERoleType.admin }

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`You cannot invite a user with a role equal to or above your own`)
  })

  it(`should throw 400 when expiresInDays is below 1`, async () => {
    mockReq.body = {
      email: `newuser@example.com`,
      roleType: ERoleType.member,
      expiresInDays: 0,
    }

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`expiresInDays must be between 1 and 30`)
  })

  it(`should throw 400 when expiresInDays is above 30`, async () => {
    mockReq.body = {
      email: `newuser@example.com`,
      roleType: ERoleType.member,
      expiresInDays: 31,
    }

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`expiresInDays must be between 1 and 30`)
  })

  it(`should throw 400 when a projectRoles entry has an invalid roleType`, async () => {
    mockReq.body = {
      email: `newuser@example.com`,
      roleType: ERoleType.member,
      projectRoles: [{ projectId: `proj-1`, roleType: `superadmin` }],
    }

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Invalid project role type: superadmin`)
  })

  it(`should throw 500 when verifying a projectRoles project fails`, async () => {
    const projectGet = mockReq.app?.locals.db.services.project.get as ReturnType<
      typeof vi.fn
    >
    projectGet.mockResolvedValue({ error: new Error(`db down`) })
    mockReq.body = {
      email: `newuser@example.com`,
      roleType: ERoleType.member,
      projectRoles: [{ projectId: `proj-1`, roleType: ERoleType.member }],
    }

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Failed to verify project: db down`)
  })

  it(`should throw 400 when a projectRoles project does not exist`, async () => {
    const projectGet = mockReq.app?.locals.db.services.project.get as ReturnType<
      typeof vi.fn
    >
    projectGet.mockResolvedValue({ data: null })
    mockReq.body = {
      email: `newuser@example.com`,
      roleType: ERoleType.member,
      projectRoles: [{ projectId: `proj-1`, roleType: ERoleType.member }],
    }

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Project not found: proj-1`)
  })

  it(`should throw 400 when a projectRoles project belongs to a different org`, async () => {
    const projectGet = mockReq.app?.locals.db.services.project.get as ReturnType<
      typeof vi.fn
    >
    projectGet.mockResolvedValue({ data: { id: `proj-1`, orgId: `org-other` } })
    mockReq.body = {
      email: `newuser@example.com`,
      roleType: ERoleType.member,
      projectRoles: [{ projectId: `proj-1`, roleType: ERoleType.member }],
    }

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Project proj-1 does not belong to this organization`)
  })

  it(`should throw 400 when a permissionOverride has an invalid permission`, async () => {
    mockReq.body = {
      email: `newuser@example.com`,
      roleType: ERoleType.member,
      permissionOverrides: [{ permission: `not-a-permission`, effect: `deny` }],
    }

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Invalid permission: not-a-permission`)
  })

  it(`should throw 400 when a permissionOverride has an invalid effect`, async () => {
    mockReq.body = {
      email: `newuser@example.com`,
      roleType: ERoleType.member,
      permissionOverrides: [{ permission: `secret:read`, effect: `allow` }],
    }

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Invalid effect: allow. Must be 'grant' or 'deny'`)
  })

  it(`should allow a grant override when caller has super permissions`, async () => {
    mockResolveEffectivePermissions.mockResolvedValue(`super`)
    mockReq.body = {
      email: `newuser@example.com`,
      roleType: ERoleType.member,
      permissionOverrides: [{ permission: `secret:read`, effect: `grant` }],
    }

    await inviteOrgUser.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(201)
  })

  it(`should throw 403 on a grant override the caller does not hold`, async () => {
    mockResolveEffectivePermissions.mockResolvedValue(new Set([`endpoint:read`]))
    mockReq.body = {
      email: `newuser@example.com`,
      roleType: ERoleType.member,
      permissionOverrides: [{ permission: `secret:read`, effect: `grant` }],
    }

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Cannot grant a permission you do not have: secret:read`)
  })

  it(`should allow a grant override the caller holds`, async () => {
    mockResolveEffectivePermissions.mockResolvedValue(new Set([`secret:read`]))
    mockReq.body = {
      email: `newuser@example.com`,
      roleType: ERoleType.member,
      permissionOverrides: [{ permission: `secret:read`, effect: `grant` }],
    }

    await inviteOrgUser.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(201)
  })

  it(`should not resolve caller permissions for deny-only overrides`, async () => {
    mockReq.body = {
      email: `newuser@example.com`,
      roleType: ERoleType.member,
      permissionOverrides: [{ permission: `secret:read`, effect: `deny` }],
    }

    await inviteOrgUser.action(mockReq as TRequest, mockRes as Response)

    expect(mockResolveEffectivePermissions).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(201)
  })

  it(`should throw 500 when the org lookup errors`, async () => {
    const orgGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
    orgGet.mockResolvedValue({ error: new Error(`org db error`) })

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`org db error`)
  })

  it(`should throw 404 when the org does not exist`, async () => {
    const orgGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
    orgGet.mockResolvedValue({ data: null })

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Organization not found`)
  })

  it(`should throw 500 when the owner's subscription lookup errors`, async () => {
    const orgGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
    orgGet.mockResolvedValue({
      data: { id: `org-1`, name: `Test Org`, ownerId: `owner-1` },
    })
    const subFind = mockReq.app?.locals.db.services.subscription.findByUser as ReturnType<
      typeof vi.fn
    >
    subFind.mockResolvedValue({ error: new Error(`sub db error`) })

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Failed to verify subscription status: sub db error`)
  })

  it(`should throw 403 when the free tier does not allow additional members`, async () => {
    const orgGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
    orgGet.mockResolvedValue({
      data: { id: `org-1`, name: `Test Org`, ownerId: `owner-1` },
    })
    const subFind = mockReq.app?.locals.db.services.subscription.findByUser as ReturnType<
      typeof vi.fn
    >
    subFind.mockResolvedValue({ data: { tier: ESubscriptionTier.free } })

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(
      `Your plan does not allow inviting additional members. Upgrade to a Pro or Team plan.`
    )
  })

  it(`should default to the free tier when there is no subscription`, async () => {
    const orgGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
    orgGet.mockResolvedValue({
      data: { id: `org-1`, name: `Test Org`, ownerId: `owner-1` },
    })
    const subFind = mockReq.app?.locals.db.services.subscription.findByUser as ReturnType<
      typeof vi.fn
    >
    subFind.mockResolvedValue({ data: null })

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Your plan does not allow inviting additional members`)
  })

  it(`should throw 500 when counting current org members fails`, async () => {
    const orgGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
    orgGet.mockResolvedValue({
      data: { id: `org-1`, name: `Test Org`, ownerId: `owner-1` },
    })
    const subFind = mockReq.app?.locals.db.services.subscription.findByUser as ReturnType<
      typeof vi.fn
    >
    subFind.mockResolvedValue({ data: { tier: ESubscriptionTier.pro } })
    const getOrgMembers = mockReq.app?.locals.db.services.role
      .getOrgMembers as ReturnType<typeof vi.fn>
    getOrgMembers.mockResolvedValue({ error: new Error(`members db error`) })

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Failed to verify seat capacity: members db error`)
  })

  it(`should throw 403 when the seat limit has been reached`, async () => {
    const orgGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
    orgGet.mockResolvedValue({
      data: { id: `org-1`, name: `Test Org`, ownerId: `owner-1` },
    })
    const subFind = mockReq.app?.locals.db.services.subscription.findByUser as ReturnType<
      typeof vi.fn
    >
    subFind.mockResolvedValue({ data: { tier: ESubscriptionTier.pro } })
    const getOrgMembers = mockReq.app?.locals.db.services.role
      .getOrgMembers as ReturnType<typeof vi.fn>
    getOrgMembers.mockResolvedValue({ data: [{}, {}, {}] })

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Seat limit reached (3/3)`)
  })

  it(`should allow inviting under the seat limit on a paid tier`, async () => {
    const orgGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
    orgGet.mockResolvedValue({
      data: { id: `org-1`, name: `Test Org`, ownerId: `owner-1` },
    })
    const subFind = mockReq.app?.locals.db.services.subscription.findByUser as ReturnType<
      typeof vi.fn
    >
    subFind.mockResolvedValue({ data: { tier: ESubscriptionTier.pro } })
    const getOrgMembers = mockReq.app?.locals.db.services.role
      .getOrgMembers as ReturnType<typeof vi.fn>
    getOrgMembers.mockResolvedValue({ data: [{}] })

    await inviteOrgUser.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(201)
  })

  it(`should skip the subscription/seat check entirely when the org has no owner`, async () => {
    await inviteOrgUser.action(mockReq as TRequest, mockRes as Response)

    expect(mockReq.app?.locals.db.services.subscription.findByUser).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(201)
  })

  it(`should allow inviting on the team tier when under its seat limit`, async () => {
    const orgGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
    orgGet.mockResolvedValue({
      data: { id: `org-1`, name: `Test Org`, ownerId: `owner-1` },
    })
    const subFind = mockReq.app?.locals.db.services.subscription.findByUser as ReturnType<
      typeof vi.fn
    >
    subFind.mockResolvedValue({ data: { tier: ESubscriptionTier.team } })
    const getOrgMembers = mockReq.app?.locals.db.services.role
      .getOrgMembers as ReturnType<typeof vi.fn>
    getOrgMembers.mockResolvedValue({ data: Array.from({ length: 9 }) })

    await inviteOrgUser.action(mockReq as TRequest, mockRes as Response)

    expect(mockReq.app?.locals.db.services.role.getOrgMembers).toHaveBeenCalledWith(
      `org-1`
    )
    expect(mockStatus).toHaveBeenCalledWith(201)
  })

  it(`should throw 500 when the user-by-email lookup errors`, async () => {
    const userByEmail = mockReq.app?.locals.db.services.user.byEmail as ReturnType<
      typeof vi.fn
    >
    userByEmail.mockResolvedValue({ error: new Error(`user db error`) })

    await expect(
      inviteOrgUser.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`user db error`)
  })

  it(`CASE 1: should add an existing user immediately and return 201`, async () => {
    const existingUser = { id: `user-2`, email: `newuser@example.com` }
    const userByEmail = mockReq.app?.locals.db.services.user.byEmail as ReturnType<
      typeof vi.fn
    >
    userByEmail.mockResolvedValue({ data: existingUser })
    const newRole = {
      id: `role-1`,
      orgId: `org-1`,
      userId: `user-2`,
      type: ERoleType.member,
    }
    mockExisting.mockResolvedValue({ role: newRole, warnings: [] })

    await inviteOrgUser.action(mockReq as TRequest, mockRes as Response)

    expect(mockInvited).toHaveBeenCalledWith({
      org: { id: `org-1`, name: `Test Org`, ownerId: null },
      email: `newuser@example.com`,
    })
    expect(mockIsMember).toHaveBeenCalledWith({
      user: existingUser,
      org: { id: `org-1`, name: `Test Org`, ownerId: null },
    })
    expect(mockExisting).toHaveBeenCalledWith(
      expect.objectContaining({ user: existingUser, roleType: ERoleType.member })
    )
    expect(mockStatus).toHaveBeenCalledWith(201)
    expect(mockJson).toHaveBeenCalledWith({
      data: newRole,
      message: `User newuser@example.com has been added to the organization`,
    })
  })

  it(`CASE 1: should include warnings in the response when present`, async () => {
    const existingUser = { id: `user-2`, email: `newuser@example.com` }
    const userByEmail = mockReq.app?.locals.db.services.user.byEmail as ReturnType<
      typeof vi.fn
    >
    userByEmail.mockResolvedValue({ data: existingUser })
    const newRole = {
      id: `role-1`,
      orgId: `org-1`,
      userId: `user-2`,
      type: ERoleType.member,
    }
    mockExisting.mockResolvedValue({
      role: newRole,
      warnings: [`notification email failed`],
    })

    await inviteOrgUser.action(mockReq as TRequest, mockRes as Response)

    expect(mockJson).toHaveBeenCalledWith({
      data: newRole,
      message: `User newuser@example.com has been added to the organization`,
      warnings: [`notification email failed`],
    })
  })

  it(`CASE 2: should create an invitation for a non-existent user and return 201`, async () => {
    const invite = { id: `inv-1`, email: `newuser@example.com`, status: `pending` }
    mockCreate.mockResolvedValue({ invite, warnings: [] })

    await inviteOrgUser.action(mockReq as TRequest, mockRes as Response)

    expect(mockIsMember).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: `newuser@example.com`,
        roleType: ERoleType.member,
        expiresInDays: 7,
        adminUrl: config.urls.admin,
        threadsUrl: config.urls.threads,
      })
    )
    expect(mockStatus).toHaveBeenCalledWith(201)
    expect(mockJson).toHaveBeenCalledWith({
      data: invite,
      message: `Invitation sent to newuser@example.com`,
    })
  })

  it(`CASE 2: should include warnings in the response when present`, async () => {
    const invite = { id: `inv-1`, email: `newuser@example.com`, status: `pending` }
    mockCreate.mockResolvedValue({ invite, warnings: [`invitation email failed`] })

    await inviteOrgUser.action(mockReq as TRequest, mockRes as Response)

    expect(mockJson).toHaveBeenCalledWith({
      data: invite,
      message: `Invitation sent to newuser@example.com`,
      warnings: [`invitation email failed`],
    })
  })

  it(`should default expiresInDays to 7 when not provided`, async () => {
    const invite = { id: `inv-1`, email: `newuser@example.com` }
    mockCreate.mockResolvedValue({ invite, warnings: [] })

    await inviteOrgUser.action(mockReq as TRequest, mockRes as Response)

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ expiresInDays: 7 }))
  })

  it(`should pass a custom expiresInDays through to invitation creation`, async () => {
    const invite = { id: `inv-1`, email: `newuser@example.com` }
    mockCreate.mockResolvedValue({ invite, warnings: [] })
    mockReq.body = {
      email: `newuser@example.com`,
      roleType: ERoleType.member,
      expiresInDays: 14,
    }

    await inviteOrgUser.action(mockReq as TRequest, mockRes as Response)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInDays: 14 })
    )
  })
})
