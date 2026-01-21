import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { base } from '@TDB/utils/schema/base'
import { EInviteStatus } from '@tdsk/domain'
import { uuid, text, timestamp, pgTable } from 'drizzle-orm/pg-core'

/**
 * Organization Invitations Table
 *
 * Tracks invitations sent to users (existing or new) to join an organization.
 * - For existing users: invitation is immediately accepted and role is created
 * - For new users: invitation is pending until they sign up and accept
 *
 * Status flow:
 * - revoked: Admin cancelled the invitation
 * - accepted: User accepted and joined the org
 * - pending: Invitation sent, awaiting acceptance
 * - expired: Invitation passed expiration date (7 days default)
 */
export const invitations = pgTable(`invitations`, {
  ...base,

  // Who is being invited (email is required, userId is null for new users)
  email: text(`email`).notNull(),
  userId: uuid(`user_id`).references(() => users.id, { onDelete: `cascade` }),

  // Which org and what role
  // 'viewer', 'member', 'admin', etc.
  roleType: text(`role_type`).notNull(),
  orgId: uuid(`org_id`)
    .references(() => orgs.id, { onDelete: `cascade` })
    .notNull(),

  // Who sent the invitation
  invitedBy: uuid(`invited_by`).references(() => users.id, { onDelete: `set null` }),

  // Unique token for accepting invitation
  token: text(`token`).notNull().unique(),
  // pending, accepted, expired, revoked
  revokedAt: timestamp(`revoked_at`, { mode: `string` }),
  acceptedAt: timestamp(`accepted_at`, { mode: `string` }),
  expiresAt: timestamp(`expires_at`, { mode: `string` }).notNull(),
  status: text(`status`).notNull().default(EInviteStatus.pending),
  revokedBy: uuid(`revoked_by`).references(() => users.id, { onDelete: `set null` }),
})

export const invitationsRelations = relations(invitations, ({ one }) => ({
  org: one(orgs, { fields: [invitations.orgId], references: [orgs.id] }),
  user: one(users, { fields: [invitations.userId], references: [users.id] }),
  inviter: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
  revoker: one(users, {
    fields: [invitations.revokedBy],
    references: [users.id],
  }),
}))
