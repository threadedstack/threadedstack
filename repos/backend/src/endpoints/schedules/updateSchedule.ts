import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { isValidCron, parseNextRun } from '@TBE/services/scheduler/cronParser'
import { Exception, EPermAction, EPermResource, EScheduleType } from '@tdsk/domain'

export const updateSchedule: TEndpointConfig = {
  path: `/:scheduleId`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.schedule)],
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

    const {
      type,
      prompt,
      command,
      enabled,
      agentId,
      sandboxId,
      cronExpression,
      maxConsecutiveErrors,
    } = req.body

    if (sandboxId !== undefined) {
      const { data: sandbox, error: sandboxErr } =
        await db.services.sandbox.get(sandboxId)
      if (sandboxErr) throw new Exception(500, sandboxErr.message)
      if (!sandbox) throw new Exception(404, `Sandbox not found`)
      if (sandbox.orgId !== orgId) throw new Exception(404, `Sandbox not found`)

      const { error: linkErr } = await db.services.sandbox.getProjectConfig(
        sandboxId,
        projectId
      )
      if (linkErr) throw new Exception(404, `Sandbox is not linked to this project`)
    }

    if (agentId !== undefined && agentId !== null) {
      const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
      if (agentErr) throw new Exception(500, agentErr.message)
      if (!agent || agent.orgId !== orgId) throw new Exception(404, `Agent not found`)
    }

    const resolvedType = type ?? existing.type
    if (resolvedType === EScheduleType.shell) {
      const resolvedCommand = command ?? existing.command
      if (!resolvedCommand)
        throw new Exception(400, `command is required for shell schedules`)
    } else {
      const resolvedPrompt = prompt ?? existing.prompt
      if (!resolvedPrompt)
        throw new Exception(400, `prompt is required for prompt schedules`)
    }

    if (cronExpression !== undefined && !isValidCron(cronExpression))
      throw new Exception(400, `Invalid cron expression`)

    const nextRunAt =
      cronExpression !== undefined ? parseNextRun(cronExpression) : undefined

    const { data, error } = await db.services.schedule.update({
      id: scheduleId,
      ...(type !== undefined && { type }),
      ...(prompt !== undefined && { prompt }),
      ...(command !== undefined && { command }),
      ...(enabled !== undefined && { enabled }),
      ...(agentId !== undefined && { agentId }),
      ...(agentId !== undefined && agentId !== existing.agentId && { threadId: null }),
      ...(sandboxId !== undefined && { sandboxId }),
      ...(nextRunAt !== undefined && { nextRunAt }),
      ...(cronExpression !== undefined && { cronExpression }),
      ...(maxConsecutiveErrors !== undefined && { maxConsecutiveErrors }),
    })

    if (error) throw new Exception(500, error.message)

    res.json({ data })
  },
}
