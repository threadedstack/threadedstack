import type { TViewportMode } from '@TTH/types'

import { ESandboxMode } from '@TTH/types'
import { useGuiModes } from '@TTH/state/selectors'
import { useSandboxSessions } from '@TTH/hooks/sandbox/useSandboxSessions'

export const useSandboxMode = (sandboxId: string): TViewportMode => {
  const sessions = useSandboxSessions(sandboxId)
  const [modeMap] = useGuiModes()
  for (const session of sessions) {
    const mode = modeMap.get(session.sessionId)
    if (mode && mode !== ESandboxMode.idle) return mode
  }
  return ESandboxMode.idle
}
