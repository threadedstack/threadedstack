import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const deleteSchedule: TEndpointConfig = {
  path: `/:scheduleId`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, scheduleId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!scheduleId) throw new Exception(400, `scheduleId is required`)

    await checkPermission(req, EPermAction.delete, EPermResource.schedule, { orgId })

    // Verify schedule exists and belongs to org
    const { data: existing, error: getErr } = await db.services.schedule.get(scheduleId)
    if (getErr || !existing) throw new Exception(404, `Schedule not found`)
    if (existing.orgId !== orgId) throw new Exception(404, `Schedule not found`)

    const { error } = await db.services.schedule.delete(scheduleId)
    if (error) throw new Exception(500, error.message)

    res.json({ data: { id: scheduleId } })
  },
}
