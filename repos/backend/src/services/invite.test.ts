import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EInviteStatus } from '@tdsk/domain'
import { InviteService } from '@TBE/services/invite'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/utils/auth/generateInvitationToken`, () => ({
  generateInvitationToken: vi.fn(() => `tok_generated123`),
  getInvitationExpiration: vi.fn(() => `2026-08-01T00:00:00.000Z`),
}))

const org = { id: `og_org00001`, name: `Acme Org` } as any
const user = { id: `us_user00001`, email: `member@acme.test` } as any
const inviter = {
  id: `us_inviter001`,
  name: `Inviter Name`,
  email: `inviter@acme.test`,
} as any

const createMockDb = () => ({
  services: {
    role: {
      create: vi.fn().mockResolvedValue({ data: { id: `rl_role00001` }, error: null }),
      getOrgRole: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    permissionOverride: {
      create: vi.fn().mockResolvedValue({ data: { id: `po_override001` }, error: null }),
    },
    invitation: {
      create: vi.fn().mockResolvedValue({ data: { id: `in_invite00001` }, error: null }),
      getByEmailAndOrg: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
})

const createMockEmail = () => ({
  sendMemberNotification: vi.fn().mockResolvedValue(true),
  invitation: vi.fn().mockResolvedValue(true),
})

const config = { urls: { admin: `https://admin.local.test` } } as any

describe(`InviteService`, () => {
  let db: ReturnType<typeof createMockDb>
  let email: ReturnType<typeof createMockEmail>
  let service: InviteService

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
    email = createMockEmail()
    service = new InviteService({ db: db as any, config, email: email as any })
  })

  describe(`existing`, () => {
    it(`creates a role and sends a notification email with no warnings`, async () => {
      const result = await service.existing({
        org,
        user,
        inviter,
        email: user.email,
        roleType: `member` as any,
      })

      expect(db.services.role.create).toHaveBeenCalledWith({
        orgId: org.id,
        type: `member`,
        userId: user.id,
      })
      expect(email.sendMemberNotification).toHaveBeenCalledWith({
        email: user.email,
        roleType: `member`,
        orgName: org.name,
        orgUrl: `${config.urls.admin}/orgs/${org.id}`,
        inviterName: inviter.name,
      })
      expect(result.role).toEqual({ id: `rl_role00001` })
      expect(result.warnings).toEqual([])
    })

    it(`throws when the base role creation fails`, async () => {
      db.services.role.create.mockResolvedValueOnce({
        data: null,
        error: { message: `role create failed` },
      })

      await expect(
        service.existing({
          org,
          user,
          inviter,
          email: user.email,
          roleType: `member` as any,
        })
      ).rejects.toMatchObject({ status: 500, message: `role create failed` })
    })

    it(`collects a warning per failed project role without throwing`, async () => {
      db.services.role.create
        .mockResolvedValueOnce({ data: { id: `rl_role00001` }, error: null }) // base role
        .mockResolvedValueOnce({ data: null, error: { message: `project role failed` } })

      const result = await service.existing({
        org,
        user,
        inviter,
        email: user.email,
        roleType: `member` as any,
        projectRoles: [{ projectId: `pj_proj00001`, roleType: `viewer` as any }],
      })

      expect(result.warnings).toEqual([`project role for pj_proj00001`])
    })

    it(`collects a warning per failed permission override without throwing`, async () => {
      db.services.permissionOverride.create.mockResolvedValueOnce({
        data: null,
        error: { message: `override failed` },
      })

      const result = await service.existing({
        org,
        user,
        inviter,
        email: user.email,
        roleType: `member` as any,
        permissionOverrides: [
          {
            permission: `secret:update`,
            effect: `grant`,
            reason: `test`,
            projectId: undefined,
          },
        ],
      })

      expect(result.warnings).toEqual([`permission override secret:update`])
    })

    it(`scopes a permission override to orgId when no projectId is given`, async () => {
      await service.existing({
        org,
        user,
        inviter,
        email: user.email,
        roleType: `member` as any,
        permissionOverrides: [
          { permission: `secret:update`, effect: `grant`, reason: `test` },
        ],
      })

      expect(db.services.permissionOverride.create).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: org.id })
      )
      expect(db.services.permissionOverride.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ projectId: expect.anything() })
      )
    })

    it(`scopes a permission override to projectId when one is given`, async () => {
      await service.existing({
        org,
        user,
        inviter,
        email: user.email,
        roleType: `member` as any,
        permissionOverrides: [
          {
            permission: `secret:update`,
            effect: `grant`,
            reason: `test`,
            projectId: `pj_proj00001`,
          },
        ],
      })

      expect(db.services.permissionOverride.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: `pj_proj00001` })
      )
    })

    it(`collects a warning when the notification email fails to send`, async () => {
      email.sendMemberNotification.mockResolvedValueOnce(false)

      const result = await service.existing({
        org,
        user,
        inviter,
        email: user.email,
        roleType: `member` as any,
      })

      expect(result.warnings).toEqual([`notification email to ${user.email}`])
    })

    it(`skips sending an email when no email service is configured`, async () => {
      service = new InviteService({ db: db as any, config, email: undefined as any })

      const result = await service.existing({
        org,
        user,
        inviter,
        email: user.email,
        roleType: `member` as any,
      })

      expect(result.warnings).toEqual([])
    })
  })

  describe(`create`, () => {
    const newUserOpts = {
      org,
      inviter,
      email: `newuser@acme.test`,
      roleType: `member` as any,
      adminUrl: `https://admin.local.test`,
      threadsUrl: `https://threads.local.test`,
      expiresInDays: 7,
    }

    it(`creates a pending invitation and sends the invitation email`, async () => {
      const result = await service.create(newUserOpts)

      expect(db.services.invitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: newUserOpts.email,
          orgId: org.id,
          roleType: `member`,
          status: EInviteStatus.pending,
          invitedBy: inviter.id,
          token: `tok_generated123`,
          expiresAt: `2026-08-01T00:00:00.000Z`,
        })
      )
      expect(email.invitation).toHaveBeenCalledWith(
        expect.objectContaining({
          email: newUserOpts.email,
          invitationUrl: `${newUserOpts.adminUrl}/invitations/accept?token=tok_generated123`,
        })
      )
      expect(result.invite).toEqual({ id: `in_invite00001` })
      expect(result.warnings).toEqual([])
    })

    it(`throws when invitation creation fails`, async () => {
      db.services.invitation.create.mockResolvedValueOnce({
        data: null,
        error: { message: `invite create failed` },
      })

      await expect(service.create(newUserOpts)).rejects.toMatchObject({
        status: 500,
        message: `invite create failed`,
      })
    })

    it(`collects a warning when the invitation email fails to send`, async () => {
      email.invitation.mockResolvedValueOnce(false)

      const result = await service.create(newUserOpts)

      expect(result.warnings).toEqual([`invitation email to ${newUserOpts.email}`])
    })

    it(`omits projectRoles/permissionOverrides from the payload when not given`, async () => {
      await service.create(newUserOpts)

      const payload = db.services.invitation.create.mock.calls[0][0]
      expect(payload).not.toHaveProperty(`projectRoles`)
      expect(payload).not.toHaveProperty(`permissionOverrides`)
    })

    it(`includes projectRoles/permissionOverrides in the payload when given`, async () => {
      const projectRoles = [{ projectId: `pj_proj00001`, roleType: `viewer` as any }]
      const permissionOverrides = [
        { permission: `secret:update` as any, effect: `grant` as any, reason: `test` },
      ]

      await service.create({ ...newUserOpts, projectRoles, permissionOverrides })

      const payload = db.services.invitation.create.mock.calls[0][0]
      expect(payload.projectRoles).toEqual(projectRoles)
      expect(payload.permissionOverrides).toEqual(permissionOverrides)
    })
  })

  describe(`isMember`, () => {
    it(`resolves without throwing when the user has no existing role`, async () => {
      await expect(service.isMember({ org, user })).resolves.toBeUndefined()
    })

    it(`throws a 409 when the user already has a role in the org`, async () => {
      db.services.role.getOrgRole.mockResolvedValueOnce({
        data: { id: `rl_role00001` },
        error: null,
      })

      await expect(service.isMember({ org, user })).rejects.toMatchObject({
        status: 409,
        message: `User ${user.email} is already a member of this organization`,
      })
    })

    it(`throws a 500 when the role lookup fails`, async () => {
      db.services.role.getOrgRole.mockResolvedValueOnce({
        data: null,
        error: { message: `lookup failed` },
      })

      await expect(service.isMember({ org, user })).rejects.toMatchObject({
        status: 500,
        message: `lookup failed`,
      })
    })
  })

  describe(`invited`, () => {
    it(`resolves without throwing when there is no existing pending invitation`, async () => {
      await expect(
        service.invited({ org, email: `new@acme.test` })
      ).resolves.toBeUndefined()
    })

    it(`throws a 400 when a pending invitation already exists`, async () => {
      db.services.invitation.getByEmailAndOrg.mockResolvedValueOnce({
        data: { isPending: () => true },
        error: null,
      })

      await expect(
        service.invited({ org, email: `new@acme.test` })
      ).rejects.toMatchObject({
        status: 400,
        message: `An invitation has already been sent to new@acme.test. Please revoke the existing invitation first.`,
      })
    })

    it(`resolves without throwing when an existing invitation is not pending`, async () => {
      db.services.invitation.getByEmailAndOrg.mockResolvedValueOnce({
        data: { isPending: () => false },
        error: null,
      })

      await expect(
        service.invited({ org, email: `new@acme.test` })
      ).resolves.toBeUndefined()
    })

    it(`throws a 500 when the invitation lookup fails`, async () => {
      db.services.invitation.getByEmailAndOrg.mockResolvedValueOnce({
        data: null,
        error: { message: `lookup failed` },
      })

      await expect(
        service.invited({ org, email: `new@acme.test` })
      ).rejects.toMatchObject({
        status: 500,
        message: `lookup failed`,
      })
    })
  })
})
