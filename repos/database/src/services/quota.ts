import type { TServiceOpts, TDBQuotaSelect, TDBQuotaInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { eq, and, sql } from 'drizzle-orm'
import { quotas } from '@TDB/schemas/quotas'
import { DBError } from '@TDB/utils/error/error'
import { Quota as QuotaModel } from '@tdsk/domain'

type TIncrementKey = keyof Pick<
  TDBQuotaSelect,
  | 'members'
  | 'threads'
  | 'runtime'
  | 'messages'
  | 'projects'
  | 'endpoints'
  | 'orgSecrets'
  | 'organizations'
  | 'functionCalls'
  | 'projectSecrets'
>

export class Quota extends Base<typeof quotas, TDBQuotaSelect, TDBQuotaInsert> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: quotas })
  }

  model = (data: TDBQuotaSelect) => {
    return new QuotaModel(data as Partial<QuotaModel>)
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

      if (!data) return { error: new DBError(`Quota not found`) }

      return { data: this.model(data as TDBQuotaSelect) }
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
      if (amount <= 0) throw new DBError(`Quota increment amount must be positive`)

      const column = this.table[key]
      if (!column) throw new DBError(`Invalid quota key: ${key}`)

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

      return { data: this.model(data as TDBQuotaSelect) }
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

      if (!data) return this.getUsage(orgId, period)

      return { data: this.model(data as TDBQuotaSelect) }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }
}
