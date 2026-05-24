import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const getScheduleRun: TEndpointConfig = {
  path: `/:scheduleId/runs/:runId`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.schedule)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, scheduleId, runId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!scheduleId) throw new Exception(400, `scheduleId is required`)
    if (!runId) throw new Exception(400, `runId is required`)

    const { data: schedule, error: scheduleErr } =
      await db.services.schedule.get(scheduleId)
    if (scheduleErr) throw new Exception(500, scheduleErr.message)
    if (!schedule) throw new Exception(404, `Schedule not found`)
    if (schedule.orgId !== orgId) throw new Exception(404, `Schedule not found`)

    const { data, error } = await db.services.scheduleRun.get(runId)
    if (error) throw new Exception(500, error.message)
    if (!data) throw new Exception(404, `Schedule run not found`)
    if (data.scheduleId !== scheduleId) throw new Exception(404, `Schedule run not found`)

    res.json({ data })
  },
}
