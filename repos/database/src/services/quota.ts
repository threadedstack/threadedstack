import type { TServiceOpts, TDBQuotaSelect, TDBQuotaInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { quotas } from '@TDB/schemas/quotas'
import { eq, and, sql } from 'drizzle-orm'

type TIncrementKey = keyof Pick<
  TDBQuotaSelect,
  | 'organizations'
  | 'projects'
  | 'members'
  | 'endpoints'
  | 'threads'
  | 'messages'
  | 'functionCalls'
  | 'runtime'
  | 'orgSecrets'
  | 'projectSecrets'
>

export class Quota extends Base<typeof quotas, TDBQuotaSelect, TDBQuotaInsert> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: quotas })
  }

  /**
   * Get quota usage for an organization in a specific period
   */
  async getUsage(orgId: string, period: string) {
    try {
      const [data] = await this.db
        .select()
        .from(this.table)
        .where(and(eq(this.table.orgId, orgId), eq(this.table.period, period)))

      return { data }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  /**
   * Find quota by organization and period
   * Alias for getUsage to match endpoint usage
   */
  async findByOrgAndPeriod(orgId: string, period: string) {
    return this.getUsage(orgId, period)
  }

  /**
   * Increment a usage counter safely using SQL atomic update
   */
  async increment(orgId: string, period: string, key: TIncrementKey, amount = 1) {
    try {
      const column = this.table[key]
      if (!column) throw new Error(`Invalid quota key: ${key}`)

      const [data] = await this.db
        .insert(this.table)
        .values({
          orgId,
          period,
          [key]: amount,
        })
        .onConflictDoUpdate({
          target: [this.table.orgId, this.table.period],
          set: {
            updatedAt: new Date(),
            [key]: sql`${column} + ${amount}`,
          },
        })
        .returning()

      return { data }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  /**
   * Initialize usage tracking for a new period with plan snapshot
   * Records what the user signed up for (price/retention) and starts usage at 0
   */
  async initializePeriod(
    orgId: string,
    period: string,
    price: number,
    retention: number
  ) {
    try {
      const [data] = await this.db
        .insert(this.table)
        .values({
          orgId,
          price,
          period,
          retention,
          members: 0,
          threads: 0,
          runtime: 0,
          messages: 0,
          projects: 0,
          endpoints: 0,
          orgSecrets: 0,
          organizations: 0,
          functionCalls: 0,
          projectSecrets: 0,
        })
        .onConflictDoNothing()
        .returning()

      return { data }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }
}
