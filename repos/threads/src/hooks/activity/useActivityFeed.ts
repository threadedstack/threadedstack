import type { TFeedEvent, TViewportMode } from '@TTH/types/ast.types'

import { useGuiFeed, useGuiModes } from '@TTH/state/selectors'

export function useActivityFeed(sessionId: string): {
  events: TFeedEvent[]
  mode: TViewportMode
} {
  const [feeds] = useGuiFeed()
  const [modes] = useGuiModes()

  return {
    events: feeds.get(sessionId) ?? [],
    mode: modes.get(sessionId) ?? `interactive`,
  }
}
