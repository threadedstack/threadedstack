import type { TSandboxActionOpts } from '@TTH/types'

import { toast } from 'sonner'
import { openSession } from '@TTH/actions/sessions'
import { getSessionsForSandbox } from '@TTH/state/accessors'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'

type TRestartResult = { opened: number; total: number }

export const restartSandbox = async (
  opts: TSandboxActionOpts
): Promise<TRestartResult> => {
  const { sandboxId, orgId, projectId, instanceId } = opts
  const sessions = getSessionsForSandbox(sandboxId)
  const total = Math.max(sessions.length, 1)

  await stopSandbox({ sandboxId, orgId, projectId, instanceId, force: true })

  const { cols, rows } = estimateTerminalDimensions()
  let opened = 0
  for (let i = 0; i < total; i++) {
    try {
      await openSession({
        cols,
        rows,
        orgId,
        projectId,
        sandboxId,
        instanceId,
        sessionId: null,
      })
      opened++
    } catch (err) {
      toast.error(
        total > 1
          ? `Reopened ${opened} of ${total} sessions`
          : `Failed to reopen session after restart`,
        {
          description:
            err instanceof Error ? err.message : `An unexpected error occurred`,
        }
      )
      break
    }
  }

  return { opened, total }
}
