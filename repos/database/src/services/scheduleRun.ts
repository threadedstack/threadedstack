import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBScheduleRunSelect,
  TDBScheduleRunInsert,
} from '@TDB/types'

import { eq, sql } from 'drizzle-orm'
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
      output?: string
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
          output: data.output,
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

  async appendOutput(id: string, chunk: string) {
    try {
      const resp = await this.db
        .update(scheduleRuns)
        .set({
          output: sql`COALESCE(${scheduleRuns.output}, '') || ${chunk}`,
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
}
