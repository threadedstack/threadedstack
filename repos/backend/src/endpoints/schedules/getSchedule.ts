import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const getSchedule: TEndpointConfig = {
  path: `/:scheduleId`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, scheduleId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!scheduleId) throw new Exception(400, `scheduleId is required`)

    await checkPermission(req, EPermAction.read, EPermResource.schedule, { orgId })

    const { data, error } = await db.services.schedule.get(scheduleId)
    if (error || !data) throw new Exception(404, `Schedule not found`)
    if (data.orgId !== orgId) throw new Exception(404, `Schedule not found`)

    res.json({ data })
  },
}
