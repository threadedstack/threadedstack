import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBApiRes,
  TDBApiResType,
  TDBTaskProposalSelect,
  TDBTaskProposalInsert,
} from '@TDB/types'
import type { TTaskProposalStatus } from '@tdsk/domain'

import { eq, and, desc, asc, inArray } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { ETaskProposalStatus } from '@tdsk/domain'
import { taskProposals } from '@TDB/schemas/taskProposals'
import { TaskProposal as TaskProposalModel } from '@tdsk/domain'

export class TaskProposal extends Base<
  typeof taskProposals,
  TDBTaskProposalSelect,
  TDBTaskProposalInsert,
  TaskProposalModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: taskProposals })
  }

  model = (data: TDBTaskProposalSelect) =>
    new TaskProposalModel(data as Partial<TaskProposalModel>)

  async get(id: string, opts?: TDBQueryOpts) {
    return super.get(id, opts)
  }

  async list(opts: TDBQueryOpts = {}) {
    return super.list(opts)
  }

  /** Proposals for an org in a given lifecycle status, newest first. */
  async listByStatus(
    orgId: string,
    status: TTaskProposalStatus
  ): Promise<TDBApiRes<TaskProposalModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(taskProposals)
        .where(and(eq(taskProposals.orgId, orgId), eq(taskProposals.status, status)))
        .orderBy(desc(taskProposals.createdAt))

      return { data: rows.map((row) => this.model(row as TDBTaskProposalSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Newest still-open proposal for an org matching a dedupe key, or null.
   * Open means pending or scanned — rejected/promoted rows never match, so a
   * repeat sensing can be collapsed onto a live proposal but not a resolved one.
   */
  async findOpenByDedupeKey(
    orgId: string,
    dedupeKey: string
  ): Promise<TDBApiResType<TaskProposalModel | null>> {
    try {
      const rows = await this.db
        .select()
        .from(taskProposals)
        .where(
          and(
            eq(taskProposals.orgId, orgId),
            eq(taskProposals.dedupeKey, dedupeKey),
            inArray(taskProposals.status, [
              ETaskProposalStatus.pending,
              ETaskProposalStatus.scanned,
            ])
          )
        )
        .orderBy(desc(taskProposals.createdAt))
        .limit(1)

      return { data: rows[0] ? this.model(rows[0] as TDBTaskProposalSelect) : null }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * The pickup-ready backlog for an org: scanned proposals ordered by priority
   * (P0 first) then newest, capped at `limit`.
   */
  async listBacklog(
    orgId: string,
    limit: number
  ): Promise<TDBApiRes<TaskProposalModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(taskProposals)
        .where(
          and(
            eq(taskProposals.orgId, orgId),
            eq(taskProposals.status, ETaskProposalStatus.scanned)
          )
        )
        .orderBy(asc(taskProposals.priority), desc(taskProposals.createdAt))
        .limit(limit)

      return { data: rows.map((row) => this.model(row as TDBTaskProposalSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  /** All proposals rolling up into an initiative for an org, oldest first. */
  async listByInitiative(
    orgId: string,
    initiative: string
  ): Promise<TDBApiRes<TaskProposalModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(taskProposals)
        .where(
          and(eq(taskProposals.orgId, orgId), eq(taskProposals.initiative, initiative))
        )
        .orderBy(asc(taskProposals.createdAt))

      return { data: rows.map((row) => this.model(row as TDBTaskProposalSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  /** Child proposals of a parent (task decomposition), oldest first. */
  async listChildren(parentId: string): Promise<TDBApiRes<TaskProposalModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(taskProposals)
        .where(eq(taskProposals.parentId, parentId))
        .orderBy(asc(taskProposals.createdAt))

      return { data: rows.map((row) => this.model(row as TDBTaskProposalSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Atomically claim the "open" dedupe-key slot for an org. Two backend
   * replicas can both pass the (best-effort, check-then-act)
   * `findOpenByDedupeKey` guard for the same dedupeKey before either has
   * inserted — the actual cross-replica guarantee is the partial unique
   * index on `(org_id, dedupe_key) WHERE status IN ('pending', 'scanned')`
   * (see schema): only ONE of two concurrent inserts for the same open
   * dedupeKey can succeed. The loser's `ON CONFLICT DO NOTHING` affects zero
   * rows, surfaced here as `{ conflict: true }` for the caller to treat as
   * "already open elsewhere" — a clean skip, never an error.
   */
  async claimOpen(
    data: TDBTaskProposalInsert
  ): Promise<TDBApiResType<TaskProposalModel> & { conflict?: true }> {
    try {
      const resp = await this.db
        .insert(taskProposals)
        .values(data as any)
        .onConflictDoNothing()
        .returning()

      if (!resp[0]) return { data: null as any, conflict: true }
      return { data: this.model(resp[0] as TDBTaskProposalSelect) }
    } catch (error: any) {
      return { error }
    }
  }
}
