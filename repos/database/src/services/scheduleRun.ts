import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBScheduleRunSelect,
  TDBScheduleRunInsert,
} from '@TDB/types'

import { eq } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { scheduleRuns } from '@TDB/schemas/scheduleRuns'
import type { TScheduleRunStatus } from '@tdsk/domain'
import { ScheduleRun as ScheduleRunModel } from '@tdsk/domain'

export class ScheduleRun extends Base<
  typeof scheduleRuns,
  TDBScheduleRunSelect,
  TDBScheduleRunInsert,
  ScheduleRunModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: scheduleRuns })
  }

  with = (opts?: TDBWithRecord) =>
    ({
      ...opts,
    }) as TDBWithRecord

  model = (data: TDBScheduleRunSelect) => {
    return new ScheduleRunModel({ ...data, status: data.status as TScheduleRunStatus })
  }

  async get(id: string, opts?: TDBQueryOpts) {
    return super.get(id, { ...opts, with: this.with(opts?.with) })
  }

  async list(opts: TDBQueryOpts = {}) {
    return super.list({ ...opts, with: this.with(opts?.with) })
  }

  async listBySchedule(scheduleId: string, opts: TDBQueryOpts = {}) {
    return this.list({
      ...opts,
      where: { ...opts.where, scheduleId },
      orderBy: opts.orderBy ?? { column: `startedAt`, direction: `desc` },
    })
  }

  async listByOrg(orgId: string, opts: TDBQueryOpts = {}) {
    return this.list({
      ...opts,
      where: { ...opts.where, orgId },
      orderBy: opts.orderBy ?? { column: `startedAt`, direction: `desc` },
    })
  }

  async complete(
    id: string,
    data: {
      error?: string
      stdoutKey?: string
      stderrKey?: string
      completedAt?: Date
      durationMs?: number
      instanceId?: string
      status: TScheduleRunStatus
    }
  ) {
    try {
      const resp = await this.db
        .update(scheduleRuns)
        .set({
          error: data.error,
          status: data.status,
          stdoutKey: data.stdoutKey,
          stderrKey: data.stderrKey,
          durationMs: data.durationMs,
          instanceId: data.instanceId,
          completedAt: data.completedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(scheduleRuns.id, id))
        .returning()

      if (!resp[0]) return { error: new Error(`Schedule run not found`) }

      return { data: this.model(resp[0]) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Mark every run still in `running` as failed. Called at scheduler startup:
   * a run executes in-process on the (single-replica) backend, so any row still
   * `running` at boot was orphaned by the previous process dying — e.g. a deploy
   * restart mid-run — and its executor can never complete it or enforce its
   * timeout. Reaping keeps the table honest and stops stuck rows accumulating.
   * Returns how many rows were reaped.
   */
  async failOrphaned(reason: string) {
    try {
      const now = new Date()
      const resp = await this.db
        .update(scheduleRuns)
        .set({
          status: `error`,
          error: reason,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(scheduleRuns.status, `running`))
        .returning({ id: scheduleRuns.id })

      return { data: { count: resp.length, ids: resp.map((r) => r.id) } }
    } catch (error: any) {
      return { error }
    }
  }
}
