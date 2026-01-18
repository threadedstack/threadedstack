import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBQuotaSelect, TDBQuotaInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { quotas } from '@TDB/schemas/quotas'
import { eq, and, sql } from 'drizzle-orm'

export type TQuotaOpts = {
  db: NodePgDatabase
}

export class Quota extends Base<typeof quotas, TDBQuotaSelect, TDBQuotaInsert> {
  constructor(opts: TQuotaOpts) {
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
   * Increment a usage counter safely using SQL atomic update
   */
  async increment(
    orgId: string,
    period: string,
    key: keyof Pick<
      TDBQuotaSelect,
      'functionCalls' | 'functionDurationMs' | 'threads' | 'messages' | 'storageBytes'
    >,
    amount = 1
  ) {
    try {
      // Need to cast the key for safe SQL interpolation/column selection if dynamic
      // But since we know the schema, we can try to use the column object if we can map string key to column
      // However, Base class uses TTableSchema which is generic.
      // Drizzle doesn't easily support dynamic column updates via variable key without some mapping.
      // For now, let's use the explicit column from the imported schema 'quotas' to be safe,
      // OR use the one from this.table if we trust the type.

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
}
