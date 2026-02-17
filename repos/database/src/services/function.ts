import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBFunctionSelect,
  TDBFunctionInsert,
} from '@TDB/types'

import { eq, and } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { functions } from '@TDB/schemas/functions'
import { Function as FunctionModel } from '@tdsk/domain'
import { agentFunctions } from '@TDB/schemas/agentFunctions'

export class Function extends Base<
  typeof functions,
  TDBFunctionSelect,
  TDBFunctionInsert,
  FunctionModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: functions })
  }

  with = (opts?: TDBWithRecord) =>
    ({
      agents: true,
      ...opts,
    }) as TDBWithRecord

  model = (data: TDBFunctionSelect) => {
    const fn = new FunctionModel(data)

    // Map junction table records to agentIds array if present
    const agents = (data as any).agents
    if (agents && Array.isArray(agents))
      fn.agentIds = agents.map((link: any) => link.agentId)

    return fn
  }

  async get(id: string, opts?: TDBQueryOpts) {
    return super.get(id, { ...opts, with: this.with(opts?.with) })
  }

  async list(opts: TDBQueryOpts = {}) {
    return super.list({ ...opts, with: this.with(opts?.with) })
  }

  /**
   * List functions associated with a specific agent via the junction table
   */
  async listByAgent(agentId: string) {
    try {
      const links = await this.db.query.agentFunctions.findMany({
        where: eq(agentFunctions.agentId, agentId),
        with: { function: true },
      })

      const fns = links
        .filter((link) => link.function)
        .map((link) => this.model(link.function as TDBFunctionSelect))

      return { data: fns }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Set agent associations for a function (replaces existing associations)
   */
  async setAgents(functionId: string, agentIds: string[]) {
    try {
      // Remove existing associations
      await this.db
        .delete(agentFunctions)
        .where(eq(agentFunctions.functionId, functionId))

      // Create new associations
      if (agentIds.length > 0) {
        await this.db
          .insert(agentFunctions)
          .values(agentIds.map((aid) => ({ agentId: aid, functionId })))
          .onConflictDoNothing()
      }

      return { data: null, error: null }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Add a single agent association to a function
   */
  async addAgent(functionId: string, agentId: string) {
    try {
      await this.db
        .insert(agentFunctions)
        .values({ agentId, functionId })
        .onConflictDoNothing()

      return { data: null, error: null }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Remove a single agent association from a function
   */
  async removeAgent(functionId: string, agentId: string) {
    try {
      await this.db
        .delete(agentFunctions)
        .where(
          and(
            eq(agentFunctions.functionId, functionId),
            eq(agentFunctions.agentId, agentId)
          )
        )

      return { data: null, error: null }
    } catch (error: any) {
      return { error }
    }
  }
}
