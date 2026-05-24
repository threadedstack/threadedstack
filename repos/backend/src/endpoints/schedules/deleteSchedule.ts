import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const deleteSchedule: TEndpointConfig = {
  path: `/:scheduleId`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.schedule)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, projectId, scheduleId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!projectId) throw new Exception(400, `projectId is required`)
    if (!scheduleId) throw new Exception(400, `scheduleId is required`)

    const { data: existing, error: getErr } = await db.services.schedule.get(scheduleId)
    if (getErr) throw new Exception(500, getErr.message)
    if (!existing) throw new Exception(404, `Schedule not found`)
    if (existing.orgId !== orgId || existing.projectId !== projectId)
      throw new Exception(404, `Schedule not found`)

    const { error } = await db.services.schedule.delete(scheduleId)
    if (error) throw new Exception(500, error.message)

    res.json({ data: { id: scheduleId } })
  },
}
