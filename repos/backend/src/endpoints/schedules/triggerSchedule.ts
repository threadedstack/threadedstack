import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, parseNextRun, EPermAction, EPermResource } from '@tdsk/domain'

export const triggerSchedule: TEndpointConfig = {
  path: `/:scheduleId/trigger`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.exec, EPermResource.schedule)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, projectId, scheduleId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!projectId) throw new Exception(400, `projectId is required`)
    if (!scheduleId) throw new Exception(400, `scheduleId is required`)

    const { data, error } = await db.services.schedule.get(scheduleId)
    if (error) throw new Exception(500, error.message)
    if (!data) throw new Exception(404, `Schedule not found`)
    if (data.orgId !== orgId || data.projectId !== projectId)
      throw new Exception(404, `Schedule not found`)

    // Same guard as the cron path (scheduler.ts#processSchedule): refuse a
    // manual trigger while a run is already in flight. Without this, a manual
    // trigger during a slow executor could race the natural cron slot (or a
    // second manual trigger) into a concurrent run of the same schedule.
    const { data: hasRunning, error: hasRunningErr } =
      await db.services.scheduleRun.hasRunning(scheduleId)
    if (hasRunningErr) throw new Exception(500, hasRunningErr.message)
    if (hasRunning)
      throw new Exception(409, `A run for this schedule is already in progress`)

    // Execute the agent if an executor is configured
    const executeAgent = req.app.locals.scheduleExecutor
    if (executeAgent) {
      try {
        await executeAgent(data)
      } catch (execErr: any) {
        try {
          await db.services.schedule.incrementErrors(scheduleId)
        } catch (incErr: any) {
          logger.error(
            `[triggerSchedule] Failed to increment errors for schedule ${scheduleId}:`,
            incErr?.message || incErr
          )
        }
        throw new Exception(
          500,
          `Schedule execution failed: ${execErr?.message || execErr}`
        )
      }
    }

    // Compute the real next cron run time (not now — prevents double execution)
    const nextRunAt = parseNextRun(data.cronExpression)
    const { error: markErr } = await db.services.schedule.markRun(scheduleId, nextRunAt)
    if (markErr)
      throw new Exception(500, `Failed to trigger schedule: ${markErr.message}`)

    res.json({ data: { ...data, lastRunAt: new Date(), nextRunAt, triggered: true } })
  },
}
