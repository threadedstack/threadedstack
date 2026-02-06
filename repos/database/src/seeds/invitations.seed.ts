import type { TDBInvitationInsert } from '@TDB/types'

import { OrgIds } from '@TDB/seeds/orgs.seed'
import { UserIds } from '@TDB/seeds/users.seed'
import { EInviteStatus, Invitation } from '@tdsk/domain'
/**
 * Invitations Seed Data
 * Organization invitation management
 */

export const InvitationIds = {
  pending: `f0000000-0000-0000-0000-000000000001`,
  accepted: `f0000000-0000-0000-0000-000000000002`,
  startup: `f0000000-0000-0000-0000-000000000003`,
  expired: `f0000000-0000-0000-0000-000000000004`,
  revoked: `f0000000-0000-0000-0000-000000000005`,
} as const

export const invitationsSeeds: TDBInvitationInsert[] = [
  new Invitation({
    userId: undefined,
    orgId: OrgIds.acme,
    roleType: `member`,
    revokedAt: undefined,
    revokedBy: undefined,
    acceptedAt: undefined,
    invitedBy: UserIds.owner,
    id: InvitationIds.pending,
    email: `newuser@example.com`,
    status: EInviteStatus.pending,
    token: `invite_token_abc123xyz`,
    expiresAt: new Date(`2024-02-15T00:00:00Z`).toISOString(),
  }),
  new Invitation({
    orgId: OrgIds.acme,
    roleType: `member`,
    revokedAt: undefined,
    revokedBy: undefined,
    userId: UserIds.member,
    invitedBy: UserIds.owner,
    id: InvitationIds.accepted,
    email: `member@example.com`,
    token: `invite_token_def456uvw`,
    status: EInviteStatus.accepted,
    expiresAt: new Date(`2024-01-20T00:00:00Z`).toISOString(),
    acceptedAt: new Date(`2024-01-18T15:30:00Z`).toISOString(),
  }),
  new Invitation({
    userId: undefined,
    roleType: `admin`,
    revokedAt: undefined,
    revokedBy: undefined,
    acceptedAt: undefined,
    orgId: OrgIds.startup,
    invitedBy: UserIds.owner,
    id: InvitationIds.startup,
    status: EInviteStatus.pending,
    email: `developer@example.com`,
    token: `invite_token_ghi789rst`,
    expiresAt: new Date(`2024-02-10T00:00:00Z`).toISOString(),
  }),
  new Invitation({
    userId: undefined,
    roleType: `viewer`,
    revokedAt: undefined,
    revokedBy: undefined,
    acceptedAt: undefined,
    orgId: OrgIds.personal,
    invitedBy: UserIds.admin,
    id: InvitationIds.expired,
    email: `expired@example.com`,
    status: EInviteStatus.expired,
    token: `invite_token_jkl012mno`,
    expiresAt: new Date(`2024-01-01T00:00:00Z`).toISOString(),
  }),
  new Invitation({
    userId: undefined,
    roleType: `member`,
    orgId: OrgIds.acme,
    acceptedAt: undefined,
    invitedBy: UserIds.owner,
    revokedBy: UserIds.owner,
    id: InvitationIds.revoked,
    email: `revoked@example.com`,
    status: EInviteStatus.revoked,
    token: `invite_token_pqr345stu`,
    expiresAt: new Date(`2024-02-20T00:00:00Z`).toISOString(),
    revokedAt: new Date(`2024-01-25T10:00:00Z`).toISOString(),
  }),
]
