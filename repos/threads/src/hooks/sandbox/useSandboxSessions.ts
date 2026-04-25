import type { TOpenSession } from '@TTH/types'

import { useMemo } from 'react'
import { useOpenSessions } from '@TTH/state/selectors'

export const useSandboxSessions = (sandboxId: string): TOpenSession[] => {
  const [sessions] = useOpenSessions()
  return useMemo(() => {
    const result: TOpenSession[] = []
    for (const session of sessions.values()) {
      if (session.sandboxId === sandboxId) result.push(session)
    }
    return result
  }, [sessions, sandboxId])
}
