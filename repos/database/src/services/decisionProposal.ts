import type {
  TDBApiRes,
  TServiceOpts,
  TDBQueryOpts,
  TDBDecisionProposalSelect,
  TDBDecisionProposalInsert,
} from '@TDB/types'

import { eq, and, sql, desc, inArray } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { EDecisionStatus } from '@tdsk/domain'
import { decisionProposals } from '@TDB/schemas/decisionProposals'
import { DecisionProposal as DecisionProposalModel } from '@tdsk/domain'

export class DecisionProposal extends Base<
  typeof decisionProposals,
  TDBDecisionProposalSelect,
  TDBDecisionProposalInsert,
  DecisionProposalModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: decisionProposals })
  }

  model = (data: TDBDecisionProposalSelect) =>
    new DecisionProposalModel(data as Partial<DecisionProposalModel>)

  async get(id: string, opts?: TDBQueryOpts) {
    return super.get(id, opts)
  }

  /** All decision proposals for an org, newest first. */
  async listByOrg(orgId: string): Promise<TDBApiRes<DecisionProposalModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(decisionProposals)
        .where(eq(decisionProposals.orgId, orgId))
        .orderBy(desc(decisionProposals.createdAt))

      return { data: rows.map((row) => this.model(row as TDBDecisionProposalSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Still-open proposals for an org (status open or deliberating), newest first.
   * Committed / tiebroken / rejected / aborted rows are excluded.
   */
  async listOpenByOrg(orgId: string): Promise<TDBApiRes<DecisionProposalModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(decisionProposals)
        .where(
          and(
            eq(decisionProposals.orgId, orgId),
            inArray(decisionProposals.status, [
              EDecisionStatus.open,
              EDecisionStatus.deliberating,
            ])
          )
        )
        .orderBy(desc(decisionProposals.createdAt))

      return { data: rows.map((row) => this.model(row as TDBDecisionProposalSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Advance a proposal to the next deliberation round and mark it deliberating.
   * Returns the updated proposal, or {} when no row matched the id.
   */
  async advanceRound(id: string): Promise<TDBApiRes<DecisionProposalModel>> {
    try {
      const [row] = await this.db
        .update(decisionProposals)
        .set({
          round: sql`${decisionProposals.round} + 1`,
          status: EDecisionStatus.deliberating,
          updatedAt: new Date(),
        })
        .where(eq(decisionProposals.id, id))
        .returning()

      if (!row) return {}

      return { data: this.model(row as TDBDecisionProposalSelect) }
    } catch (error: any) {
      return { error }
    }
  }
}
