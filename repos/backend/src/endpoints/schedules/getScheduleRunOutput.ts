import type { Readable } from 'stream'
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const getScheduleRunOutput: TEndpointConfig = {
  path: `/:scheduleId/runs/:runId/output`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.schedule)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, s3 } = req.app.locals
    const { orgId, projectId, scheduleId, runId } = req.params
    const stream = (req.query.stream as string) || `stdout`

    if (!orgId) throw new Exception(400, `orgId parameter required`)
    if (!projectId) throw new Exception(400, `projectId parameter required`)
    if (!scheduleId) throw new Exception(400, `scheduleId parameter required`)
    if (!runId) throw new Exception(400, `runId parameter required`)
    if (!s3.active) throw new Exception(503, `S3 not configured`)
    if (stream !== `stdout` && stream !== `stderr`)
      throw new Exception(400, `stream must be "stdout" or "stderr"`)

    const { data: schedule, error: scheduleErr } =
      await db.services.schedule.get(scheduleId)

    if (scheduleErr) throw new Exception(500, scheduleErr.message)
    if (!schedule) throw new Exception(404, `Schedule not found`)
    if (schedule.orgId !== orgId || schedule.projectId !== projectId)
      throw new Exception(404, `Schedule not found`)

    const { data: run, error } = await db.services.scheduleRun.get(runId)

    if (error)
      throw new Exception(500, error instanceof Error ? error.message : String(error))

    if (!run) throw new Exception(404, `Schedule run not found`)
    if (run.scheduleId !== scheduleId) throw new Exception(404, `Schedule run not found`)

    const key = stream === `stderr` ? run.stderrKey : run.stdoutKey
    if (!key) throw new Exception(404, `No ${stream} output recorded for this run`)

    let readable: Readable
    try {
      readable = await s3.getObject(key)
    } catch (err: any) {
      if (err?.name === `NoSuchKey` || err?.$metadata?.httpStatusCode === 404) {
        throw new Exception(404, `Run output is no longer available`)
      }
      logger.error(`[ScheduleRunOutput] S3 getObject failed for key ${key}:`, err.message)
      throw new Exception(502, `Failed to retrieve run output`)
    }

    readable.on(`error`, (err) => {
      logger.error(`[ScheduleRunOutput] Stream error for key ${key}:`, err.message)
      if (!res.headersSent) res.status(502).json({ error: `Failed to stream run output` })
      else res.destroy()
    })

    res.setHeader(`Content-Type`, `application/octet-stream`)
    readable.pipe(res)
  },
}
