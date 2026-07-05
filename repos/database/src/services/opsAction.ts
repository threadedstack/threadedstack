import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBApiRes,
  TDBOpsActionSelect,
  TDBOpsActionInsert,
} from '@TDB/types'
import type { TOpsActionStatus } from '@tdsk/domain'

import { eq, and, desc } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { EOpsActionStatus } from '@tdsk/domain'
import { opsActions } from '@TDB/schemas/opsActions'
import { OpsAction as OpsActionModel } from '@tdsk/domain'

export class OpsAction extends Base<
  typeof opsActions,
  TDBOpsActionSelect,
  TDBOpsActionInsert,
  OpsActionModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: opsActions })
  }

  model = (data: TDBOpsActionSelect) =>
    new OpsActionModel(data as Partial<OpsActionModel>)

  async get(id: string, opts?: TDBQueryOpts) {
    return super.get(id, opts)
  }

  async list(opts: TDBQueryOpts = {}) {
    return super.list(opts)
  }

  /** Ops actions for an org in a given lifecycle status, newest first. */
  async listByStatus(
    orgId: string,
    status: TOpsActionStatus
  ): Promise<TDBApiRes<OpsActionModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(opsActions)
        .where(and(eq(opsActions.orgId, orgId), eq(opsActions.status, status)))
        .orderBy(desc(opsActions.createdAt))

      return { data: rows.map((row) => this.model(row as TDBOpsActionSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  /** Most recent N ops actions for an org, newest first. */
  async listRecent(orgId: string, limit: number): Promise<TDBApiRes<OpsActionModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(opsActions)
        .where(eq(opsActions.orgId, orgId))
        .orderBy(desc(opsActions.createdAt))
        .limit(limit)

      return { data: rows.map((row) => this.model(row as TDBOpsActionSelect)) }
    } catch (error: any) {
      return { error }
    }
  }
}
