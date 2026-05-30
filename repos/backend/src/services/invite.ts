import type { TBEConfig } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { EmailService } from '@TBE/services/email'
import type {
  User,
  TRoleType,
  Organization,
  TInvitationProjectRole,
  TInvitationPermOverride,
} from '@tdsk/domain'

import { Exception } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { EInviteStatus } from '@tdsk/domain'
import {
  generateInvitationToken,
  getInvitationExpiration,
} from '@TBE/utils/auth/generateInvitationToken'

export type TInviteService = {
  db: TDatabase
  config: TBEConfig
  email: EmailService
}

type TExistingUser = {
  user: User
  email: string
  inviter: User
  org: Organization
  roleType: TRoleType
  projectRoles?: TInvitationProjectRole[]
  permissionOverrides?: TInvitationPermOverride[]
}

type TIsMember = {
  user: User
  org: Organization
}

type TInvited = {
  email: string
  org: Organization
}

type TNewUser = {
  inviter: User
  email: string
  org: Organization
  roleType: TRoleType
  adminUrl: string
  threadsUrl: string
  expiresInDays: number
  projectRoles?: TInvitationProjectRole[]
  permissionOverrides?: TInvitationPermOverride[]
}

export class InviteService {
  db: TDatabase
  config: TBEConfig
  email: EmailService

  constructor(opts: TInviteService) {
    this.db = opts.db
    this.email = opts.email
    this.config = opts.config
  }

  existing = async (opts: TExistingUser) => {
    const { org, user, email, inviter, roleType, projectRoles, permissionOverrides } =
      opts

    const { data: newRole, error: createError } = await this.db.services.role.create({
      orgId: org.id,
      type: roleType,
      userId: user.id,
    })

    if (createError) throw new Exception(500, createError.message)

    const failures: string[] = []

    if (projectRoles?.length) {
      for (const pr of projectRoles) {
        const { error: prErr } = await this.db.services.role.create({
          projectId: pr.projectId,
          userId: user.id,
          type: pr.roleType,
        })
        if (prErr) {
          logger.error(`Failed to create project role for ${pr.projectId}:`, prErr)
          failures.push(`project role for ${pr.projectId}`)
        }
      }
    }

    if (permissionOverrides?.length) {
      for (const po of permissionOverrides) {
        const { error: poErr } = await this.db.services.permissionOverride.create({
          userId: user.id,
          effect: po.effect,
          reason: po.reason,
          grantedBy: inviter?.id,
          expiresAt: po.expiresAt,
          permission: po.permission,
          ...(po.projectId ? { projectId: po.projectId } : { orgId: org.id }),
        })
        if (poErr) {
          logger.error(`Failed to create permission override:`, poErr)
          failures.push(`permission override ${po.permission}`)
        }
      }
    }

    if (this.email) {
      const emailSent = await this.email.sendMemberNotification({
        email,
        roleType,
        orgName: org.name,
        orgUrl: `${this.config.urls.admin}/orgs/${org.id}`,
        inviterName: inviter?.name || inviter?.email || `A team member`,
      })

      if (!emailSent) {
        logger.error(`Failed to send notification email to ${email}`)
        failures.push(`notification email to ${email}`)
      }
    }

    return { role: newRole, warnings: failures }
  }

  create = async (opts: TNewUser) => {
    const {
      org,
      email,
      inviter,
      adminUrl,
      roleType,
      expiresInDays,
      projectRoles,
      permissionOverrides,
    } = opts

    const token = generateInvitationToken()
    const expiresAt = getInvitationExpiration(expiresInDays)

    const { data: invite, error: invitationError } =
      await this.db.services.invitation.create({
        email,
        token,
        roleType,
        expiresAt,
        orgId: org.id,
        invitedBy: inviter?.id,
        status: EInviteStatus.pending,
        ...(projectRoles?.length && { projectRoles }),
        ...(permissionOverrides?.length && { permissionOverrides }),
      })

    if (invitationError) throw new Exception(500, invitationError.message)

    // Send invitation email using EmailService
    const warnings: string[] = []

    if (this.email) {
      const emailSent = await this.email.invitation({
        email,
        roleType,
        expiresInDays,
        orgName: org.name,
        inviterName: inviter?.name || inviter?.email || `A team member`,
        invitationUrl: `${adminUrl}/invitations/accept?token=${token}`,
      })

      if (!emailSent) {
        logger.error(`Failed to send invitation email to ${email}`)
        warnings.push(`invitation email to ${email}`)
      }
    }

    return { invite, warnings }
  }

  isMember = async (params: TIsMember) => {
    const { org, user } = params

    const { data: exRole, error: roleError } = await this.db.services.role.getOrgRole(
      user.id,
      org.id
    )

    if (roleError) throw new Exception(500, roleError.message)

    if (exRole)
      throw new Exception(
        409,
        `User ${user.email} is already a member of this organization`
      )
  }

  invited = async (params: TInvited) => {
    const { org, email } = params

    // Check for existing pending invitation based on email
    const { error: inError, data: exInvitation } =
      await this.db.services.invitation.getByEmailAndOrg(email, org.id)

    if (inError) throw new Exception(500, inError.message)

    if (exInvitation?.isPending())
      throw new Exception(
        400,
        `An invitation has already been sent to ${email}. Please revoke the existing invitation first.`
      )
  }
}
