import type { TServiceOpts, TDBQuotaSelect, TDBQuotaInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { eq, and, sql } from 'drizzle-orm'
import { quotas } from '@TDB/schemas/quotas'
import { DBError } from '@TDB/utils/error/error'
import { Quota as QuotaModel } from '@tdsk/domain'

type TIncrementKey = keyof Pick<
  TDBQuotaSelect,
  'projects' | 'compute' | 'threads' | 'messages' | 'endpoints' | 'secrets'
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

      if (!data) return { data: null }

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
   * Atomically increment a counter only if the result stays at or below the limit.
   * Returns { quotaExceeded: true } when the counter would exceed the limit.
   */
  async incrementIfUnderLimit(
    orgId: string,
    period: string,
    key: TIncrementKey,
    limit: number,
    amount = 1
  ) {
    try {
      if (amount <= 0) throw new DBError(`Quota increment amount must be positive`)

      const column = this.table[key]
      if (!column) throw new DBError(`Invalid quota key: ${key}`)

      await this.db
        .insert(this.table)
        .values({ orgId, period, [key]: 0 })
        .onConflictDoNothing()

      const [row] = await this.db
        .update(this.table)
        .set({
          updatedAt: new Date(),
          [key]: sql`${column} + ${amount}`,
        })
        .where(
          and(
            eq(this.table.orgId, orgId),
            eq(this.table.period, period),
            sql`${column} + ${amount} <= ${limit}`
          )
        )
        .returning()

      if (!row) return { data: null, quotaExceeded: true as const }

      return { data: this.model(row as TDBQuotaSelect) }
    } catch (err: unknown) {
      return { data: null, error: err as Error }
    }
  }

  /**
   * Decrement a usage counter safely using SQL atomic update
   * Uses GREATEST to ensure the value never goes below 0
   */
  async decrement(orgId: string, period: string, key: TIncrementKey, amount = 1) {
    try {
      if (amount <= 0) throw new DBError(`Quota decrement amount must be positive`)

      const column = this.table[key]
      if (!column) throw new DBError(`Invalid quota key: ${key}`)

      const [data] = await this.db
        .update(this.table)
        .set({
          updatedAt: new Date(),
          [key]: sql`GREATEST(${column} - ${amount}, 0)`,
        })
        .where(and(eq(this.table.orgId, orgId), eq(this.table.period, period)))
        .returning()

      if (!data) return { data: null }

      return { data: this.model(data as TDBQuotaSelect) }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  /**
   * Initialize usage tracking for a new period.
   * Stock-based counters (projects, endpoints, secrets) can be carried forward
   * from the previous period via the optional `stockCounters` parameter.
   * Consumption-based counters (compute, threads, messages) always start at 0.
   */
  async initializePeriod(
    orgId: string,
    period: string,
    stockCounters?: { projects?: number; endpoints?: number; secrets?: number }
  ) {
    try {
      const [data] = await this.db
        .insert(this.table)
        .values({
          orgId,
          period,
          projects: stockCounters?.projects ?? 0,
          compute: 0,
          threads: 0,
          messages: 0,
          endpoints: stockCounters?.endpoints ?? 0,
          secrets: stockCounters?.secrets ?? 0,
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
