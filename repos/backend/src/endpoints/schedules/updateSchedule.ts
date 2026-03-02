import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { isValidCron, parseNextRun } from '@TBE/services/scheduler/cronParser'

export const updateSchedule: TEndpointConfig = {
  path: `/:scheduleId`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, scheduleId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!scheduleId) throw new Exception(400, `scheduleId is required`)

    await checkPermission(req, EPermAction.update, EPermResource.schedule, { orgId })

    // Verify schedule exists and belongs to org
    const { data: existing, error: getErr } = await db.services.schedule.get(scheduleId)
    if (getErr || !existing) throw new Exception(404, `Schedule not found`)
    if (existing.orgId !== orgId) throw new Exception(404, `Schedule not found`)

    const {
      cronExpression,
      prompt,
      agentId,
      enabled,
      threadId,
      createThread,
      maxConsecutiveErrors,
    } = req.body

    // Verify agent ownership if agentId is being updated
    if (agentId !== undefined) {
      const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
      if (agentErr || !agent) throw new Exception(404, `Agent not found`)
      if (agent.orgId !== orgId) throw new Exception(404, `Agent not found`)
    }

    // Verify thread ownership if threadId is being updated
    if (threadId !== undefined && threadId) {
      const { data: thread, error: tErr } = await db.services.thread.get(threadId)
      if (tErr || !thread) throw new Exception(404, `Thread not found`)
      if (thread.orgId !== orgId) throw new Exception(404, `Thread not found`)
    }

    // Validate cron expression if being updated
    if (cronExpression !== undefined && !isValidCron(cronExpression))
      throw new Exception(400, `Invalid cron expression`)

    // Recalculate nextRunAt if cron expression changed
    const nextRunAt =
      cronExpression !== undefined ? parseNextRun(cronExpression) : undefined

    const { data, error } = await db.services.schedule.update({
      id: scheduleId,
      ...(cronExpression !== undefined && { cronExpression }),
      ...(prompt !== undefined && { prompt }),
      ...(agentId !== undefined && { agentId }),
      ...(enabled !== undefined && { enabled }),
      ...(threadId !== undefined && { threadId }),
      ...(createThread !== undefined && { createThread }),
      ...(maxConsecutiveErrors !== undefined && { maxConsecutiveErrors }),
      ...(nextRunAt !== undefined && { nextRunAt }),
    })

    if (error) throw new Exception(500, error.message)

    res.json({ data })
  },
}
