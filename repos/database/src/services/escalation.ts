import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBApiRes,
  TDBApiResType,
  TDBEscalationSelect,
  TDBEscalationInsert,
} from '@TDB/types'
import type { TEscalationStatus } from '@tdsk/domain'

import { eq, and, desc, inArray } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { EEscalationStatus } from '@tdsk/domain'
import { escalations } from '@TDB/schemas/escalations'
import { Escalation as EscalationModel } from '@tdsk/domain'

export class Escalation extends Base<
  typeof escalations,
  TDBEscalationSelect,
  TDBEscalationInsert,
  EscalationModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: escalations })
  }

  model = (data: TDBEscalationSelect) =>
    new EscalationModel(data as Partial<EscalationModel>)

  async get(id: string, opts?: TDBQueryOpts) {
    return super.get(id, opts)
  }

  async list(opts: TDBQueryOpts = {}) {
    return super.list(opts)
  }

  /** Escalations for an org in a given lifecycle status, newest first. */
  async listByStatus(
    orgId: string,
    status: TEscalationStatus
  ): Promise<TDBApiRes<EscalationModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(escalations)
        .where(and(eq(escalations.orgId, orgId), eq(escalations.status, status)))
        .orderBy(desc(escalations.createdAt))

      return { data: rows.map((row) => this.model(row as TDBEscalationSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Newest still-open escalation for an org matching a dedupe key, or null.
   * Open means status open or routed — resolved/rejected rows never match, so a
   * repeat sensing can be collapsed onto a live escalation but not a closed one.
   */
  async openByDedupeKey(
    orgId: string,
    dedupeKey: string
  ): Promise<TDBApiResType<EscalationModel | null>> {
    try {
      const rows = await this.db
        .select()
        .from(escalations)
        .where(
          and(
            eq(escalations.orgId, orgId),
            eq(escalations.dedupeKey, dedupeKey),
            inArray(escalations.status, [
              EEscalationStatus.open,
              EEscalationStatus.routed,
            ])
          )
        )
        .orderBy(desc(escalations.createdAt))
        .limit(1)

      return { data: rows[0] ? this.model(rows[0] as TDBEscalationSelect) : null }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Atomically claim the "open" dedupe-key slot for an org. Two backend
   * replicas can both pass the (best-effort, check-then-act) `openByDedupeKey`
   * guard for the same dedupeKey before either has inserted — the actual
   * cross-replica guarantee is the partial unique index on
   * `(org_id, dedupe_key) WHERE status IN ('open', 'routed')` (see schema):
   * only ONE of two concurrent inserts for the same open dedupeKey can
   * succeed. The loser's `ON CONFLICT DO NOTHING` affects zero rows, surfaced
   * here as `{ conflict: true }` for the caller to treat as "already open
   * elsewhere" — a clean skip, never an error.
   */
  async claimOpen(
    data: TDBEscalationInsert
  ): Promise<TDBApiResType<EscalationModel> & { conflict?: true }> {
    try {
      const resp = await this.db
        .insert(escalations)
        .values(data as any)
        .onConflictDoNothing()
        .returning()

      if (!resp[0]) return { data: null as any, conflict: true }
      return { data: this.model(resp[0] as TDBEscalationSelect) }
    } catch (error: any) {
      return { error }
    }
  }
}
