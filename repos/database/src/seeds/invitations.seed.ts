import type { TDBInvitationInsert } from '@TDB/types'

import { EInviteStatus } from '@tdsk/domain'
import { OrgIds } from '@TDB/seeds/orgs.seed'
import { UserIds } from '@TDB/seeds/users.seed'
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
  {
    id: InvitationIds.pending,
    orgId: OrgIds.acme,
    email: `newuser@example.com`,
    userId: null,
    roleType: `member`,
    invitedBy: UserIds.owner,
    token: `invite_token_abc123xyz`,
    status: EInviteStatus.pending,
    expiresAt: new Date(`2024-02-15T00:00:00Z`).toISOString(),
    acceptedAt: null,
    revokedAt: null,
    revokedBy: null,
  },
  {
    id: InvitationIds.accepted,
    orgId: OrgIds.acme,
    email: `member@example.com`,
    userId: UserIds.member,
    roleType: `member`,
    invitedBy: UserIds.owner,
    token: `invite_token_def456uvw`,
    status: EInviteStatus.accepted,
    expiresAt: new Date(`2024-01-20T00:00:00Z`).toISOString(),
    acceptedAt: new Date(`2024-01-18T15:30:00Z`).toISOString(),
    revokedAt: null,
    revokedBy: null,
  },
  {
    id: InvitationIds.startup,
    orgId: OrgIds.startup,
    email: `developer@example.com`,
    userId: null,
    roleType: `admin`,
    invitedBy: UserIds.owner,
    token: `invite_token_ghi789rst`,
    status: EInviteStatus.pending,
    expiresAt: new Date(`2024-02-10T00:00:00Z`).toISOString(),
    acceptedAt: null,
    revokedAt: null,
    revokedBy: null,
  },
  {
    id: InvitationIds.expired,
    orgId: OrgIds.personal,
    email: `expired@example.com`,
    userId: null,
    roleType: `viewer`,
    invitedBy: UserIds.admin,
    token: `invite_token_jkl012mno`,
    status: EInviteStatus.expired,
    expiresAt: new Date(`2024-01-01T00:00:00Z`).toISOString(),
    acceptedAt: null,
    revokedAt: null,
    revokedBy: null,
  },
  {
    id: InvitationIds.revoked,
    orgId: OrgIds.acme,
    email: `revoked@example.com`,
    userId: null,
    roleType: `member`,
    invitedBy: UserIds.owner,
    token: `invite_token_pqr345stu`,
    status: EInviteStatus.revoked,
    expiresAt: new Date(`2024-02-20T00:00:00Z`).toISOString(),
    acceptedAt: null,
    revokedAt: new Date(`2024-01-25T10:00:00Z`).toISOString(),
    revokedBy: UserIds.owner,
  },
]
