import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { parseNextRun } from '@TBE/services/scheduler/cronParser'

export const triggerSchedule: TEndpointConfig = {
  path: `/:scheduleId/trigger`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, scheduleId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!scheduleId) throw new Exception(400, `scheduleId is required`)

    await checkPermission(req, EPermAction.update, EPermResource.schedule, { orgId })

    const { data, error } = await db.services.schedule.get(scheduleId)
    if (error || !data) throw new Exception(404, `Schedule not found`)
    if (data.orgId !== orgId) throw new Exception(404, `Schedule not found`)

    // Execute the agent if an executor is configured
    const executeAgent = req.app.locals.scheduleExecutor
    if (executeAgent) {
      try {
        await executeAgent(data)
      } catch (execErr: any) {
        await db.services.schedule.incrementErrors(scheduleId)
        throw new Exception(
          500,
          `Schedule execution failed: ${execErr?.message || execErr}`
        )
      }
    }

    // Compute the real next cron run time (not now — prevents double execution)
    const nextRunAt = parseNextRun(data.cronExpression)
    const { error: markErr } = await db.services.schedule.markRun(scheduleId, nextRunAt)
    if (markErr) throw new Exception(500, `Failed to trigger schedule`)

    res.json({ data: { ...data, lastRunAt: new Date(), nextRunAt, triggered: true } })
  },
}
