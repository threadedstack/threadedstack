import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { TFunctionInvokeResult } from '@tdsk/domain'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResource } from '@TBE/utils/auth/requireResource'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'

/**
 * POST /_/functions/:id/invoke - Ad-hoc test-invoke of a Function
 *
 * Runs the function's CURRENTLY PERSISTED code (never arbitrary code from the
 * request body) against an optional JSON `input`, synchronously, and returns
 * the result inline — nothing is persisted. Requires the same read-level
 * permission as getFunction: this is a test-invoke, not a production trigger.
 */
export const invokeFunction: TEndpointConfig = {
  path: `/:id/invoke`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.read, EPermResource.function)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params
    const input = req.body?.input ?? {}

    const func = await requireResource(db.services.function, id, `Function`)

    const startMs = Date.now()
    const result = await FunctionExecutor.execute(func as any, {
      db,
      context: { args: input },
    })
    const durationMs = Date.now() - startMs

    const data: TFunctionInvokeResult = {
      result: result.output,
      logs: result.logs ?? ``,
      durationMs,
      ...(result.error && { error: result.error }),
    }

    res.status(200).json({ data })
  },
}
