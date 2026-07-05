import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBApiRes,
  TDBApiResType,
  TDBVerificationSelect,
  TDBVerificationInsert,
} from '@TDB/types'
import type { TVerificationStatus } from '@tdsk/domain'

import { eq, and, desc } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { DefaultVerifyProbe } from '@tdsk/domain'
import { verifications } from '@TDB/schemas/verifications'
import { Verification as VerificationModel } from '@tdsk/domain'

export class Verification extends Base<
  typeof verifications,
  TDBVerificationSelect,
  TDBVerificationInsert,
  VerificationModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: verifications })
  }

  model = (data: TDBVerificationSelect) =>
    new VerificationModel(data as Partial<VerificationModel>)

  async get(id: string, opts?: TDBQueryOpts) {
    return super.get(id, opts)
  }

  async list(opts: TDBQueryOpts = {}) {
    return super.list(opts)
  }

  /** Verifications for an org in a given lifecycle status, newest first. */
  async listByStatus(
    orgId: string,
    status: TVerificationStatus
  ): Promise<TDBApiRes<VerificationModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(verifications)
        .where(and(eq(verifications.orgId, orgId), eq(verifications.status, status)))
        .orderBy(desc(verifications.createdAt))

      return { data: rows.map((row) => this.model(row as TDBVerificationSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Look up a single verification row by (orgId, prNumber), or null if none exists.
   * The (org_id, pr_number) pair is unique by schema constraint so at most one row matches.
   */
  async getByPr(
    orgId: string,
    prNumber: number
  ): Promise<TDBApiResType<VerificationModel | null>> {
    try {
      const rows = await this.db
        .select()
        .from(verifications)
        .where(and(eq(verifications.orgId, orgId), eq(verifications.prNumber, prNumber)))
        .orderBy(desc(verifications.createdAt))
        .limit(1)

      return { data: rows[0] ? this.model(rows[0] as TDBVerificationSelect) : null }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Idempotent upsert keyed on (orgId, prNumber).
   * If a verification row already exists for that PR it is updated with `patch`;
   * otherwise a new row is created with the supplied fields plus DefaultVerifyProbe as
   * the probe default (overridable via patch).
   */
  async upsertByPr(
    orgId: string,
    agentId: string,
    prNumber: number,
    patch: Partial<Omit<TDBVerificationInsert, 'id' | 'orgId' | 'agentId' | 'prNumber'>>
  ): Promise<TDBApiResType<VerificationModel>> {
    try {
      const existing = await this.getByPr(orgId, prNumber)
      if (existing.error) return { error: existing.error }

      if (existing.data) {
        const result = await this.update({ id: existing.data.id, ...patch })
        return result as TDBApiResType<VerificationModel>
      }

      const result = await this.create({
        orgId,
        agentId,
        prNumber,
        probe: DefaultVerifyProbe,
        ...patch,
      } as TDBVerificationInsert)
      return result as TDBApiResType<VerificationModel>
    } catch (error: any) {
      return { error }
    }
  }
}
