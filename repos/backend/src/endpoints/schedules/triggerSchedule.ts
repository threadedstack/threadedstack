import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { parseNextRun } from '@TBE/services/scheduler/cronParser'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const triggerSchedule: TEndpointConfig = {
  path: `/:scheduleId/trigger`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.update, EPermResource.schedule)],
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
