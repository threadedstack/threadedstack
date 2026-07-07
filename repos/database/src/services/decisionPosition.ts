import type {
  TDBApiRes,
  TServiceOpts,
  TDBDecisionPositionSelect,
  TDBDecisionPositionInsert,
} from '@TDB/types'

import { eq, asc } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { decisionPositions } from '@TDB/schemas/decisionPositions'
import { DecisionPosition as DecisionPositionModel } from '@tdsk/domain'

export class DecisionPosition extends Base<
  typeof decisionPositions,
  TDBDecisionPositionSelect,
  TDBDecisionPositionInsert,
  DecisionPositionModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: decisionPositions })
  }

  model = (data: TDBDecisionPositionSelect) =>
    new DecisionPositionModel(data as Partial<DecisionPositionModel>)

  /** All positions on a proposal, oldest round first. */
  async listByProposal(proposalId: string): Promise<TDBApiRes<DecisionPositionModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(decisionPositions)
        .where(eq(decisionPositions.proposalId, proposalId))
        .orderBy(asc(decisionPositions.round), asc(decisionPositions.createdAt))

      return { data: rows.map((row) => this.model(row as TDBDecisionPositionSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * The latest position per agent on a proposal — one row per agent at their
   * highest round. Rows are read in ascending round order so the last write per
   * agent wins.
   */
  async latestByProposal(
    proposalId: string
  ): Promise<TDBApiRes<DecisionPositionModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(decisionPositions)
        .where(eq(decisionPositions.proposalId, proposalId))
        .orderBy(asc(decisionPositions.round), asc(decisionPositions.createdAt))

      const latestByAgent = new Map<string, TDBDecisionPositionSelect>()
      for (const row of rows as TDBDecisionPositionSelect[]) {
        latestByAgent.set(row.agentId, row)
      }

      return { data: [...latestByAgent.values()].map((row) => this.model(row)) }
    } catch (error: any) {
      return { error }
    }
  }
}
