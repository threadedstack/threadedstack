import type {
  TDBApiRes,
  TServiceOpts,
  TDBApiResType,
  TDBInvitationSelect,
  TDBInvitationInsert,
} from '@TDB/types'

import { eq, and, lt } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { DBError } from '@TDB/utils/error/error'
import { invitations } from '@TDB/schemas/invitations'
import { EInviteStatus, Invitation as InvitationModel } from '@tdsk/domain'

export class Invitation extends Base<
  typeof invitations,
  TDBInvitationSelect,
  TDBInvitationInsert,
  InvitationModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: invitations })
  }

  model = (data: TDBInvitationSelect) => new InvitationModel(data)

  /**
   * Get invitation by token
   */
  async getByToken(token: string): Promise<TDBApiRes<InvitationModel>> {
    try {
      const result = await this.db
        .select()
        .from(invitations)
        .where(eq(invitations.token, token))
        .limit(1)

      return { data: result[0] ? this.model(result[0]) : null }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get invitation by email and orgId
   */
  async getByEmailAndOrg(
    email: string,
    orgId: string
  ): Promise<TDBApiRes<InvitationModel>> {
    try {
      const result = await this.db
        .select()
        .from(invitations)
        .where(and(eq(invitations.email, email), eq(invitations.orgId, orgId)))
        .limit(1)

      return { data: result[0] ? this.model(result[0]) : null }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get all pending invitations for an org
   */
  async getPendingByOrg(
    orgId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<TDBApiRes<InvitationModel[]>> {
    try {
      let query = this.db
        .select()
        .from(invitations)
        .where(
          and(eq(invitations.orgId, orgId), eq(invitations.status, EInviteStatus.pending))
        )
      if (opts?.limit) query = query.limit(opts.limit) as typeof query
      if (opts?.offset) query = query.offset(opts.offset) as typeof query
      const result = await query

      return { data: result.map((item) => this.model(item)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get all invitations for an org, optionally narrowed to a single status.
   * Status filtering happens in the DB query so limit/offset paginate the
   * already-narrowed set (rather than filtering a paginated slice in memory).
   */
  async getAllByOrg(
    orgId: string,
    opts?: { limit?: number; offset?: number; status?: EInviteStatus }
  ): Promise<TDBApiRes<InvitationModel[]>> {
    try {
      const where = opts?.status
        ? and(eq(invitations.orgId, orgId), eq(invitations.status, opts.status))
        : eq(invitations.orgId, orgId)
      let query = this.db.select().from(invitations).where(where)
      if (opts?.limit) query = query.limit(opts.limit) as typeof query
      if (opts?.offset) query = query.offset(opts.offset) as typeof query
      const result = await query

      return { data: result.map((item) => this.model(item)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get pending invitations for a user by email
   */
  async getPendingByEmail(email: string): Promise<TDBApiRes<InvitationModel[]>> {
    try {
      const result = await this.db
        .select()
        .from(invitations)
        .where(
          and(eq(invitations.email, email), eq(invitations.status, EInviteStatus.pending))
        )

      return { data: result.map((item) => this.model(item)) }
    } catch (error: any) {
      return { error }
    }
  }

  async #requirePending(invitationId: string) {
    const [existing] = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1)

    if (!existing) return { error: new DBError(`Invitation not found`) }
    if (existing.status !== EInviteStatus.pending)
      return { error: new DBError(`Invitation is not pending`) }

    return { data: existing }
  }

  /**
   * Accept an invitation
   */
  async accept(
    invitationId: string,
    userId: string
  ): Promise<TDBApiRes<InvitationModel>> {
    try {
      const pending = await this.#requirePending(invitationId)
      if (pending.error) return pending as TDBApiRes<InvitationModel>

      const result = await this.db
        .update(invitations)
        .set({
          userId,
          updatedAt: new Date(),
          status: EInviteStatus.accepted,
          acceptedAt: new Date().toISOString(),
        })
        .where(eq(invitations.id, invitationId))
        .returning()

      const item = result?.[0]

      return { data: item ? this.model(item) : undefined }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Revoke an invitation
   */
  async revoke(
    invitationId: string,
    revokedBy: string
  ): Promise<TDBApiRes<InvitationModel>> {
    try {
      const pending = await this.#requirePending(invitationId)
      if (pending.error) return pending as TDBApiRes<InvitationModel>

      const result = await this.db
        .update(invitations)
        .set({
          revokedBy,
          status: EInviteStatus.revoked,
          revokedAt: new Date().toISOString(),
          updatedAt: new Date(),
        })
        .where(eq(invitations.id, invitationId))
        .returning()

      const item = result?.[0]

      return { data: item ? this.model(item) : undefined }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Mark expired invitations as expired (cron job helper)
   */
  async markExpired(): Promise<TDBApiResType<number>> {
    try {
      const now = new Date().toISOString()
      const result = await this.db
        .update(invitations)
        .set({
          updatedAt: new Date(),
          status: EInviteStatus.expired,
        })
        .where(
          and(
            eq(invitations.status, EInviteStatus.pending),
            lt(invitations.expiresAt, now)
          )
        )
        .returning()

      return { data: result.length }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Check if an invitation is still valid (pending and not expired)
   */
  async isValid(invitationId: string): Promise<TDBApiResType<boolean>> {
    try {
      const result = await this.db
        .select()
        .from(invitations)
        .where(eq(invitations.id, invitationId))
        .limit(1)

      if (!result[0]) {
        return { data: false }
      }

      const invitation = result[0]
      const now = new Date()
      const expiresAt = new Date(invitation.expiresAt)

      const isValid = invitation.status === EInviteStatus.pending && expiresAt > now

      return { data: isValid }
    } catch (error: any) {
      return { error }
    }
  }
}
