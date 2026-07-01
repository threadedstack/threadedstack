import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const execStreamInSandbox: TEndpointConfig = {
  path: `/:id/exec/stream`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.exec, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { command, args, instanceId } = req.body

    if (!command || typeof command !== `string`)
      throw new Exception(400, `command is required and must be a string`)
    if (command.length > 2048) throw new Exception(400, `command exceeds maximum length`)
    if (!instanceId || typeof instanceId !== `string`)
      throw new Exception(400, `instanceId is required and must be a string`)
    if (args !== undefined) {
      if (!Array.isArray(args)) throw new Exception(400, `args must be an array`)
      if (args.length > 64) throw new Exception(400, `too many args`)
      for (const arg of args) {
        if (typeof arg !== `string`) throw new Exception(400, `each arg must be a string`)
        if (arg.length > 1024 * 1024)
          throw new Exception(400, `arg exceeds maximum length`)
      }
    }

    const sandbox = await resolveSandbox(
      db.services.sandbox,
      id,
      req.params.projectId,
      req.params.orgId
    )

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    await sb.validateInstanceOwnership(instanceId, sandbox.orgId, req.params.projectId)
    const sbInstance = await sb.getSandbox(instanceId)

    if (!sbInstance.execStreaming)
      throw new Exception(501, `Streaming exec not supported for this sandbox type`)

    res.setHeader(`Content-Type`, `text/event-stream`)
    res.setHeader(`Cache-Control`, `no-cache`)
    res.setHeader(`Connection`, `keep-alive`)
    res.flushHeaders()

    let aborted = false
    req.on(`close`, () => {
      aborted = true
    })

    const safeWrite = (data: string) => {
      try {
        if (!aborted) res.write(data)
      } catch (err: any) {
        aborted = true
        const code = err?.code
        if (
          code !== `ERR_STREAM_WRITE_AFTER_END` &&
          code !== `EPIPE` &&
          code !== `ECONNRESET`
        ) {
          logger.warn(
            `[execStream] Unexpected write error for instance ${instanceId}:`,
            err?.message
          )
        }
      }
    }

    const STREAM_TIMEOUT_MS = 5 * 60_000
    const timer = setTimeout(() => {
      logger.warn(
        `[execStream] Execution timed out for instance ${instanceId} after ${STREAM_TIMEOUT_MS / 1000}s`
      )
      safeWrite(
        `data: ${JSON.stringify({ type: `error`, message: `Execution timed out` })}\n\n`
      )
      aborted = true
      if (!res.writableEnded) res.end()
    }, STREAM_TIMEOUT_MS)
    timer.unref()

    try {
      const result = await sbInstance.execStreaming(command, args || [], {
        onStdout: (chunk) =>
          safeWrite(
            `data: ${JSON.stringify({ type: `stdout`, data: chunk.toString() })}\n\n`
          ),
        onStderr: (chunk) =>
          safeWrite(
            `data: ${JSON.stringify({ type: `stderr`, data: chunk.toString() })}\n\n`
          ),
      })

      clearTimeout(timer)
      if (!aborted) {
        safeWrite(
          `data: ${JSON.stringify({ type: `done`, exitCode: result.exitCode, success: result.success })}\n\n`
        )
      } else {
        logger.warn(
          `[execStream] Command for instance ${instanceId} completed after timeout/abort`
        )
      }
    } catch (err: any) {
      clearTimeout(timer)
      logger.error(
        `[execStream] Exec failed for instance ${instanceId}:`,
        err?.message || err
      )
      safeWrite(
        `data: ${JSON.stringify({ type: `error`, message: err?.message || String(err) })}\n\n`
      )
    }

    if (!aborted && !res.writableEnded) res.end()
  },
}
