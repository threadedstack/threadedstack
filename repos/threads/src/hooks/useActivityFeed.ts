import type { TFeedEvent, TViewportMode } from '@TTH/types/ast.types'

import { useAtomValue } from 'jotai'
import { sessionFeedState, sessionModeState } from '@TTH/state/gui'

export function useActivityFeed(sessionId: string): {
  events: TFeedEvent[]
  mode: TViewportMode
} {
  const feeds = useAtomValue(sessionFeedState)
  const modes = useAtomValue(sessionModeState)
  return {
    events: feeds.get(sessionId) ?? [],
    mode: modes.get(sessionId) ?? `interactive`,
  }
}
