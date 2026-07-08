import type { TApp } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { TAgentAction } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'

export type TInvokeResult = { ok: boolean; data?: unknown; error?: string }

/**
 * The single dispatch core for the effect surface. Resolves a project-scoped
 * Function by name against an allowlist and runs it via FunctionExecutor with a
 * db handle (so the ① `records` capability is injected). Never throws — any
 * failure is returned as `{ ok:false, error }` so one action can't abort the run
 * or its siblings. Both the deferred `tdsk-actions` block and the live `invoke`
 * tool call this.
 */
export const invokeAction = async (
  _app: TApp,
  db: TDatabase,
  projectId: string,
  action: TAgentAction,
  allowlist: string[]
): Promise<TInvokeResult> => {
  try {
    if (!allowlist.includes(action.function))
      return { ok: false, error: `function not allowed: ${action.function}` }

    const { data: funcs, error } = await db.services.function.list({
      where: { projectId, name: action.function },
    })
    if (error) return { ok: false, error: error.message }
    const func = funcs?.[0]
    if (!func) return { ok: false, error: `function not found: ${action.function}` }

    const res = await FunctionExecutor.execute(func, {
      db,
      context: { args: action.args },
    })
    return res.success
      ? { ok: true, data: res.output }
      : { ok: false, error: res.error ?? `function failed` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`invokeAction failed for ${action.function}: ${message}`)
    return { ok: false, error: message }
  }
}
