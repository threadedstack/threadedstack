import type {
  TDBApiRes,
  TServiceOpts,
  TDBCompanyStrategySelect,
  TDBCompanyStrategyInsert,
} from '@TDB/types'
import type { TActiveInitiative } from '@tdsk/domain'

import { eq } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { EInitiativeStatus } from '@tdsk/domain'
import { companyStrategies } from '@TDB/schemas/companyStrategies'
import { CompanyStrategy as CompanyStrategyModel } from '@tdsk/domain'

/** The mutable fields of a company strategy (org / id / timestamps excluded). */
type TStrategyPatch = Partial<
  Pick<
    TDBCompanyStrategyInsert,
    | `northStar`
    | `segments`
    | `positioning`
    | `backlog`
    | `activeInitiative`
    | `updatedByAgentId`
  >
>

export class CompanyStrategy extends Base<
  typeof companyStrategies,
  TDBCompanyStrategySelect,
  TDBCompanyStrategyInsert,
  CompanyStrategyModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: companyStrategies })
  }

  model = (data: TDBCompanyStrategySelect) =>
    new CompanyStrategyModel(data as Partial<CompanyStrategyModel>)

  /** The org's single strategy row, or {} when none exists yet. */
  async getByOrg(orgId: string): Promise<TDBApiRes<CompanyStrategyModel>> {
    try {
      const [row] = await this.db
        .select()
        .from(companyStrategies)
        .where(eq(companyStrategies.orgId, orgId))
        .limit(1)

      return row ? { data: this.model(row as TDBCompanyStrategySelect) } : {}
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Create-or-update the org's single strategy row. Conflicts on the unique
   * org_id, so the first call inserts and every later call patches the same row.
   */
  async upsertByOrg(
    orgId: string,
    patch: TStrategyPatch
  ): Promise<TDBApiRes<CompanyStrategyModel>> {
    try {
      const [row] = await this.db
        .insert(companyStrategies)
        .values({ orgId, ...patch })
        .onConflictDoUpdate({
          target: companyStrategies.orgId,
          set: { ...patch, updatedAt: new Date() },
        })
        .returning()

      return { data: this.model(row as TDBCompanyStrategySelect) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Freeze an Active Initiative onto the org's strategy. The initiative's scope
   * and definition-of-done are fixed here and do not change while in flight.
   * Returns {} when the org has no strategy row.
   */
  async setActiveInitiative(
    orgId: string,
    initiative: TActiveInitiative
  ): Promise<TDBApiRes<CompanyStrategyModel>> {
    try {
      const [row] = await this.db
        .update(companyStrategies)
        .set({ activeInitiative: initiative, updatedAt: new Date() })
        .where(eq(companyStrategies.orgId, orgId))
        .returning()

      if (!row) return {}

      return { data: this.model(row as TDBCompanyStrategySelect) }
    } catch (error: any) {
      return { error }
    }
  }

  /** Clear the Active Initiative (on completion or abort). {} when no row. */
  async clearActiveInitiative(orgId: string): Promise<TDBApiRes<CompanyStrategyModel>> {
    try {
      const [row] = await this.db
        .update(companyStrategies)
        .set({ activeInitiative: null, updatedAt: new Date() })
        .where(eq(companyStrategies.orgId, orgId))
        .returning()

      if (!row) return {}

      return { data: this.model(row as TDBCompanyStrategySelect) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Promote the top backlog item to the Active Initiative and drop it from the
   * backlog. The backlog item's rationale becomes the initiative's initial
   * definition-of-done; evidence starts empty and status is `active`.
   *   - no strategy row → {}
   *   - empty backlog → the strategy is returned unchanged
   */
  async promoteNextFromBacklog(orgId: string): Promise<TDBApiRes<CompanyStrategyModel>> {
    try {
      const current = await this.getByOrg(orgId)
      if (current.error) return { error: current.error }

      const strategy = current.data
      if (!strategy) return {}

      const backlog = strategy.backlog ?? []
      if (backlog.length === 0) return { data: strategy }

      const [next, ...rest] = backlog
      const initiative: TActiveInitiative = {
        title: next.title,
        definitionOfDone: next.rationale,
        evidence: [],
        status: EInitiativeStatus.active,
        committedAt: new Date(),
      }

      return this.upsertByOrg(orgId, { activeInitiative: initiative, backlog: rest })
    } catch (error: any) {
      return { error }
    }
  }
}
