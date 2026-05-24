import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { isValidCron, parseNextRun } from '@TBE/services/scheduler/cronParser'
import {
  Schedule,
  Exception,
  EPermAction,
  EPermResource,
  EScheduleType,
} from '@tdsk/domain'

export const createSchedule: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.schedule)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)

    const {
      prompt,
      command,
      enabled,
      threadId,
      sandboxId,
      createThread,
      cronExpression,
      maxConsecutiveErrors,
      type = EScheduleType.prompt,
    } = req.body

    if (!req.user?.id) throw new Exception(401, `Authentication required`)
    if (!cronExpression) throw new Exception(400, `cronExpression is required`)
    if (!sandboxId) throw new Exception(400, `sandboxId is required`)
    if (type && !Object.values(EScheduleType).includes(type))
      throw new Exception(400, `Invalid schedule type: ${type}`)

    const { data: sandbox, error: sandboxErr } = await db.services.sandbox.get(sandboxId)
    if (sandboxErr) throw new Exception(500, sandboxErr.message)
    if (!sandbox) throw new Exception(404, `Sandbox not found`)
    if (sandbox.orgId !== orgId) throw new Exception(404, `Sandbox not found`)

    if (type === EScheduleType.shell) {
      if (!command) throw new Exception(400, `command is required for shell schedules`)
    } else {
      if (!prompt) throw new Exception(400, `prompt is required for prompt schedules`)
    }

    if (!isValidCron(cronExpression)) throw new Exception(400, `Invalid cron expression`)

    const nextRunAt = parseNextRun(cronExpression)

    const schedule = new Schedule({
      orgId,
      type,
      prompt,
      command,
      nextRunAt,
      sandboxId,
      cronExpression,
      userId: req.user?.id,
      enabled: enabled ?? true,
      threadId: threadId || undefined,
      createThread: createThread ?? true,
      maxConsecutiveErrors: maxConsecutiveErrors ?? 5,
    })

    const { data, error } = await db.services.schedule.create(schedule)
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
