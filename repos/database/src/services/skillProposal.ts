import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBApiRes,
  TDBSkillProposalSelect,
  TDBSkillProposalInsert,
} from '@TDB/types'
import type { TSkillProposalStatus } from '@tdsk/domain'

import { eq, and, desc } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { skillProposals } from '@TDB/schemas/skillProposals'
import { SkillProposal as SkillProposalModel } from '@tdsk/domain'

export class SkillProposal extends Base<
  typeof skillProposals,
  TDBSkillProposalSelect,
  TDBSkillProposalInsert,
  SkillProposalModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: skillProposals })
  }

  model = (data: TDBSkillProposalSelect) =>
    new SkillProposalModel(data as Partial<SkillProposalModel>)

  async get(id: string, opts?: TDBQueryOpts) {
    return super.get(id, opts)
  }

  async list(opts: TDBQueryOpts = {}) {
    return super.list(opts)
  }

  /** Proposals for an org in a given lifecycle status, newest first. */
  async listByStatus(
    orgId: string,
    status: TSkillProposalStatus
  ): Promise<TDBApiRes<SkillProposalModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(skillProposals)
        .where(and(eq(skillProposals.orgId, orgId), eq(skillProposals.status, status)))
        .orderBy(desc(skillProposals.createdAt))

      return { data: rows.map((row) => this.model(row as TDBSkillProposalSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  /** All proposals authored by a given agent, newest first. */
  async listForAgent(agentId: string): Promise<TDBApiRes<SkillProposalModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(skillProposals)
        .where(eq(skillProposals.agentId, agentId))
        .orderBy(desc(skillProposals.createdAt))

      return { data: rows.map((row) => this.model(row as TDBSkillProposalSelect)) }
    } catch (error: any) {
      return { error }
    }
  }
}
