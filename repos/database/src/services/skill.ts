import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBSkillSelect,
  TDBSkillInsert,
} from '@TDB/types'

import { eq, and } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { skills } from '@TDB/schemas/skills'
import { Skill as SkillModel } from '@tdsk/domain'
import { agentSkills } from '@TDB/schemas/agentSkills'

export class Skill extends Base<
  typeof skills,
  TDBSkillSelect,
  TDBSkillInsert,
  SkillModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: skills })
  }

  with = (opts?: TDBWithRecord) =>
    ({
      ...opts,
    }) as TDBWithRecord

  model = (data: TDBSkillSelect) => {
    return new SkillModel(data)
  }

  async get(id: string, opts?: TDBQueryOpts) {
    return super.get(id, { ...opts, with: this.with(opts?.with) })
  }

  async list(opts: TDBQueryOpts = {}) {
    return super.list({ ...opts, with: this.with(opts?.with) })
  }

  async addAgent(skillId: string, agentId: string) {
    try {
      const [result] = await this.db
        .insert(agentSkills)
        .values({ agentId, skillId })
        .onConflictDoNothing()
        .returning()

      return { data: result ?? { agentId, skillId }, error: null }
    } catch (error: any) {
      return { data: null, error }
    }
  }

  async listForAgent(agentId: string) {
    try {
      const rows = await this.db.query.agentSkills.findMany({
        where: eq(agentSkills.agentId, agentId),
        with: { skill: true },
      })
      return { data: rows.map((r: any) => this.model(r.skill)) }
    } catch (error: any) {
      return { data: [], error }
    }
  }

  async removeAgent(skillId: string, agentId: string) {
    try {
      await this.db
        .delete(agentSkills)
        .where(and(eq(agentSkills.agentId, agentId), eq(agentSkills.skillId, skillId)))

      return { data: null, error: null }
    } catch (error: any) {
      return { data: null, error }
    }
  }
}
