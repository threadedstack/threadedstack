import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBScheduleRunSelect,
  TDBScheduleRunInsert,
} from '@TDB/types'

import { eq, and, inArray } from 'drizzle-orm'
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

  /**
   * Persist the pod name on a running row as soon as startPod returns. Without
   * this the row stays instance_id=NULL until `complete()` writes on final,
   * which makes a mid-run backend crash look like a "pre-pod orphan" to the
   * rehydrator even though the pod is up and the runtime is working. Called
   * from the executor's onPodStart hook immediately after startPod succeeds.
   */
  async setInstance(id: string, instanceId: string) {
    try {
      const resp = await this.db
        .update(scheduleRuns)
        .set({ instanceId, updatedAt: new Date() })
        .where(eq(scheduleRuns.id, id))
        .returning({ id: scheduleRuns.id })
      if (!resp[0]) return { error: new Error(`Schedule run not found`) }
      return { data: { id: resp[0].id } }
    } catch (error: any) {
      return { error }
    }
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
   * Return true if the given schedule already has a run in `running` status.
   * Used by the scheduler tick to refuse starting a NEW run for a schedule
   * that has one in flight — the previous incident was two concurrent coding
   * cycles opening PRs for the same task because a manual trigger fired while
   * a natural cron slot was pending. Serializing at the schedule level is the
   * right invariant: one active run per schedule at a time.
   */
  async hasRunning(scheduleId: string) {
    try {
      const resp = await this.db
        .select({ id: scheduleRuns.id })
        .from(scheduleRuns)
        .where(
          and(eq(scheduleRuns.scheduleId, scheduleId), eq(scheduleRuns.status, `running`))
        )
        .limit(1)
      return { data: resp.length > 0 }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * List every schedule_run row still in `running` status. Used by the scheduler
   * at startup to hand each row to the rehydrator: the previous backend died
   * mid-run, but the pod may still exist in K8s and its work may still be alive
   * or already complete. The rehydrator inspects each pod and completes the
   * run honestly (success / error / timeout) rather than blindly marking failed.
   */
  async listRunning() {
    try {
      const resp = await this.db
        .select()
        .from(scheduleRuns)
        .where(eq(scheduleRuns.status, `running`))
      return { data: resp.map((r) => this.model(r)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Mark a specific set of runs as error. Used by the rehydrator when a pod
   * genuinely can't be recovered (no instanceId, pod deleted, or pod in
   * Failed phase). Prefer this over a blanket "mark all running as error"
   * because it never misclassifies in-flight work that just needs re-adopting.
   */
  async markAsError(ids: string[], reason: string) {
    if (!ids.length) return { data: { count: 0, ids: [] } }
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
        .where(inArray(scheduleRuns.id, ids))
        .returning({ id: scheduleRuns.id })

      return { data: { count: resp.length, ids: resp.map((r) => r.id) } }
    } catch (error: any) {
      return { error }
    }
  }
}
