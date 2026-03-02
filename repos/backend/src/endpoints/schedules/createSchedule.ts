import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Schedule } from '@tdsk/domain'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { isValidCron, parseNextRun } from '@TBE/services/scheduler/cronParser'

export const createSchedule: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)

    await checkPermission(req, EPermAction.create, EPermResource.schedule, { orgId })

    const {
      cronExpression,
      prompt,
      agentId,
      enabled,
      threadId,
      createThread,
      maxConsecutiveErrors,
    } = req.body

    if (!cronExpression) throw new Exception(400, `cronExpression is required`)
    if (!prompt) throw new Exception(400, `prompt is required`)
    if (!agentId) throw new Exception(400, `agentId is required`)

    // Verify the agent exists and belongs to this org
    const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
    if (agentErr || !agent) throw new Exception(404, `Agent not found`)
    if (agent.orgId !== orgId) throw new Exception(404, `Agent not found`)

    if (!isValidCron(cronExpression)) throw new Exception(400, `Invalid cron expression`)

    const nextRunAt = parseNextRun(cronExpression)

    const schedule = new Schedule({
      orgId,
      agentId,
      cronExpression,
      prompt,
      enabled: enabled !== undefined ? enabled : true,
      threadId: threadId || undefined,
      createThread: createThread !== undefined ? createThread : true,
      maxConsecutiveErrors: maxConsecutiveErrors !== undefined ? maxConsecutiveErrors : 5,
      nextRunAt,
    })

    const { data, error } = await db.services.schedule.create(schedule)
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
