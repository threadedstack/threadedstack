import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const listScheduleRuns: TEndpointConfig = {
  path: `/:scheduleId/runs`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.schedule)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, projectId, scheduleId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!projectId) throw new Exception(400, `projectId is required`)
    if (!scheduleId) throw new Exception(400, `scheduleId is required`)

    const { data: schedule, error: scheduleErr } =
      await db.services.schedule.get(scheduleId)
    if (scheduleErr) throw new Exception(500, scheduleErr.message)
    if (!schedule) throw new Exception(404, `Schedule not found`)
    if (schedule.orgId !== orgId || schedule.projectId !== projectId)
      throw new Exception(404, `Schedule not found`)

    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)
    const offset = Math.max(Number(req.query.offset) || 0, 0)

    const { data, error } = await db.services.scheduleRun.listBySchedule(scheduleId, {
      limit,
      offset,
    })

    if (error) throw new Exception(500, error.message)

    res.json({ data: data || [] })
  },
}
