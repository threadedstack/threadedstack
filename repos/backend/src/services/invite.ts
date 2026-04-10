import type { TBEConfig } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { User, Organization } from '@tdsk/domain'
import type { EmailService } from '@TBE/services/email'

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
  roleType: string
  org: Organization
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
  roleType: string
  inviter: User
  email: string
  org: Organization
  frontendUrl: string
  expiresInDays: number
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
    const { org, user, roleType, email, inviter } = opts

    const { data: newRole, error: createError } = await this.db.services.role.create({
      orgId: org.id,
      type: roleType,
      userId: user.id,
    })

    if (createError) throw new Exception(500, createError.message)

    // Send notification email using EmailService
    if (this.email) {
      const emailSent = await this.email.sendMemberNotification({
        email,
        roleType,
        orgName: org.name,
        orgUrl: `${this.config.frontendUrl}/orgs/${org.id}`,
        inviterName: inviter?.name || inviter?.email || `A team member`,
      })

      !emailSent && logger.warn(`Failed to send notification email to ${email}`)
    }

    return newRole
  }

  create = async (opts: TNewUser) => {
    const { org, email, inviter, roleType, frontendUrl, expiresInDays } = opts

    const token = generateInvitationToken()
    const expiresAt = getInvitationExpiration(expiresInDays)

    const { data: invite, error: invitationError } =
      await this.db.services.invitation.create({
        email,
        token,
        expiresAt,
        orgId: org.id,
        roleType,
        invitedBy: inviter?.id,
        status: EInviteStatus.pending,
      })

    if (invitationError) throw new Exception(500, invitationError.message)

    // Send invitation email using EmailService
    if (this.email) {
      const emailSent = await this.email.invitation({
        email,
        roleType,
        expiresInDays,
        orgName: org.name,
        inviterName: inviter?.name || inviter?.email || `A team member`,
        invitationUrl: `${frontendUrl}/invitations/accept?token=${token}`,
      })

      !emailSent && logger.warn(`Failed to send invitation email to ${email}`)
    }

    return invite
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
