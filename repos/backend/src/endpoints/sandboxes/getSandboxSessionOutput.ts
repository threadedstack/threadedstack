import type { Readable } from 'stream'
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const getSandboxSessionOutput: TEndpointConfig = {
  path: `/:id/history/:sessionRecordId/output`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, s3 } = req.app.locals
    const { orgId, id: sandboxId, sessionRecordId } = req.params
    const stream = (req.query.stream as string) || `stdout`

    if (!s3.active) throw new Exception(503, `S3 not configured`)
    if (!orgId) throw new Exception(400, `orgId parameter required`)
    if (!sandboxId) throw new Exception(400, `sandboxId parameter required`)
    if (!sessionRecordId) throw new Exception(400, `sessionRecordId parameter required`)
    if (stream !== `stdout` && stream !== `stderr`)
      throw new Exception(400, `stream must be "stdout" or "stderr"`)

    const { data: session, error } = await db.services.sandboxSession.get(sessionRecordId)

    if (error)
      throw new Exception(500, error instanceof Error ? error.message : String(error))

    if (!session) throw new Exception(404, `Session not found`)
    if (session.orgId !== orgId) throw new Exception(404, `Session not found`)
    if (session.sandboxId !== sandboxId) throw new Exception(404, `Session not found`)

    const key = stream === `stderr` ? session.stderrKey : session.stdoutKey
    if (!key) throw new Exception(404, `No ${stream} output recorded for this session`)

    let readable: Readable
    try {
      readable = await s3.getObject(key)
    } catch (err: any) {
      if (err?.name === `NoSuchKey` || err?.$metadata?.httpStatusCode === 404) {
        throw new Exception(404, `Session output is no longer available`)
      }
      logger.error(`[SessionOutput] S3 getObject failed for key ${key}:`, err.message)
      throw new Exception(502, `Failed to retrieve session output`)
    }

    readable.on(`error`, (err) => {
      logger.error(`[SessionOutput] Stream error for key ${key}:`, err.message)
      if (!res.headersSent)
        res.status(502).json({ error: `Failed to stream session output` })
      else res.destroy()
    })

    res.setHeader(`Content-Type`, `application/octet-stream`)
    readable.pipe(res)
  },
}
