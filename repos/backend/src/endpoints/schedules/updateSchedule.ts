import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { isValidCron, parseNextRun } from '@TBE/services/scheduler/cronParser'

export const updateSchedule: TEndpointConfig = {
  path: `/:scheduleId`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.schedule)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, scheduleId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!scheduleId) throw new Exception(400, `scheduleId is required`)

    // Verify schedule exists and belongs to org
    const { data: existing, error: getErr } = await db.services.schedule.get(scheduleId)
    if (getErr || !existing) throw new Exception(404, `Schedule not found`)
    if (existing.orgId !== orgId) throw new Exception(404, `Schedule not found`)

    const {
      prompt,
      agentId,
      enabled,
      threadId,
      createThread,
      cronExpression,
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
      ...(prompt !== undefined && { prompt }),
      ...(agentId !== undefined && { agentId }),
      ...(enabled !== undefined && { enabled }),
      ...(threadId !== undefined && { threadId }),
      ...(nextRunAt !== undefined && { nextRunAt }),
      ...(createThread !== undefined && { createThread }),
      ...(cronExpression !== undefined && { cronExpression }),
      ...(maxConsecutiveErrors !== undefined && { maxConsecutiveErrors }),
    })

    if (error) throw new Exception(500, error.message)

    res.json({ data })
  },
}
