import type { TApp } from '@TBE/types'
import type { Schedule } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { parseActionsBlock } from '@tdsk/domain'
import { invokeAction } from '@TBE/utils/agent/invokeAction'

/**
 * Generic post-run effect dispatch (generalization ②). Parses a ```tdsk-actions```
 * block from the run's stdout and invokes each listed Function through the
 * `invokeAction` core, scoped to the schedule's project and gated by the
 * schedule's opt-in allowlist. A no-op when the schedule sets no `actions`, so the
 * live loop (which sets none) is untouched. Each action is isolated — a failure is
 * logged and skipped; the Function itself owns any persistence via `records`.
 */
export const dispatchActions = async (
  app: TApp,
  schedule: Schedule,
  agentId: string,
  stdoutText: string
): Promise<void> => {
  const allowlist = schedule.actions?.functions
  if (!allowlist?.length) return

  const actions = parseActionsBlock(stdoutText)
  if (!actions.length) return

  for (const action of actions) {
    try {
      const res = await invokeAction(
        app,
        app.locals.db,
        schedule.projectId,
        action,
        allowlist,
        { agentId, scheduleId: schedule.id }
      )
      if (res.ok)
        logger.info(
          `[actions] ${schedule.id} invoked ${action.function} (agent ${agentId})`
        )
      else
        logger.warn(
          `[actions] ${schedule.id} action ${action.function} skipped: ${res.error}`
        )
    } catch (err) {
      logger.error(
        `[actions] ${schedule.id} action ${action.function} threw: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }
}
