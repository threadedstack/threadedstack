import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBScheduleSelect,
  TDBScheduleInsert,
} from '@TDB/types'

import { Base } from '@TDB/services/base'
import { eq, and, lte, sql } from 'drizzle-orm'
import { schedules } from '@TDB/schemas/schedules'
import type { EScheduleType } from '@tdsk/domain'
import { Schedule as ScheduleModel } from '@tdsk/domain'

export class Schedule extends Base<
  typeof schedules,
  TDBScheduleSelect,
  TDBScheduleInsert,
  ScheduleModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: schedules })
  }

  with = (opts?: TDBWithRecord) =>
    ({
      ...opts,
    }) as TDBWithRecord

  model = (data: TDBScheduleSelect) => {
    return new ScheduleModel({ ...data, type: data.type as EScheduleType })
  }

  async get(id: string, opts?: TDBQueryOpts) {
    return super.get(id, { ...opts, with: this.with(opts?.with) })
  }

  async list(opts: TDBQueryOpts = {}) {
    return super.list({ ...opts, with: this.with(opts?.with) })
  }

  /**
   * Find all schedules that are due to run (enabled and nextRunAt <= now)
   */
  async listDue() {
    try {
      const now = new Date()
      const found = await this.db.query.schedules.findMany({
        where: and(eq(schedules.enabled, true), lte(schedules.nextRunAt, now)),
        with: this.with(),
      })

      return found?.length ? { data: found.map((row) => this.model(row)) } : { data: [] }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Mark a schedule as having just run, update nextRunAt, reset consecutive errors
   */
  async markRun(id: string, nextRunAt: Date) {
    try {
      const resp = await this.db
        .update(schedules)
        .set({
          lastRunAt: new Date(),
          nextRunAt,
          updatedAt: new Date(),
        })
        .where(eq(schedules.id, id))
        .returning()

      if (!resp[0]) return { error: new Error(`Schedule not found`) }

      return { data: this.model(resp[0]) }
    } catch (error: any) {
      return { error }
    }
  }

  async resetErrors(id: string) {
    try {
      const resp = await this.db
        .update(schedules)
        .set({ consecutiveErrors: 0, updatedAt: new Date() })
        .where(eq(schedules.id, id))
        .returning()

      if (!resp[0]) return { error: new Error(`Schedule not found`) }

      return { data: this.model(resp[0]) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Increment consecutive errors; disable the schedule if >= maxConsecutiveErrors
   */
  async incrementErrors(id: string) {
    try {
      const resp = await this.db
        .update(schedules)
        .set({
          consecutiveErrors: sql`${schedules.consecutiveErrors} + 1`,
          enabled: sql`CASE WHEN ${schedules.consecutiveErrors} + 1 >= ${schedules.maxConsecutiveErrors} THEN false ELSE ${schedules.enabled} END`,
          updatedAt: new Date(),
        })
        .where(eq(schedules.id, id))
        .returning()

      if (!resp[0]) return { error: new Error(`Schedule not found`) }

      return { data: this.model(resp[0]) }
    } catch (error: any) {
      return { error }
    }
  }
}
