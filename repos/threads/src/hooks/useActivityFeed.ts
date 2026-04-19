import { useAtomValue } from 'jotai'
import { sessionFeedAtom, sessionModeAtom } from '@TTH/state/gui'
import type { TFeedEvent, TViewportMode } from '@TTH/ast'

export function useActivityFeed(sessionId: string): {
  events: TFeedEvent[]
  mode: TViewportMode
} {
  const feeds = useAtomValue(sessionFeedAtom)
  const modes = useAtomValue(sessionModeAtom)
  return {
    events: feeds.get(sessionId) ?? [],
    mode: modes.get(sessionId) ?? 'interactive',
  }
}
