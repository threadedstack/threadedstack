import type { TFeedEvent } from '@TTH/types'

import { getGuiFeeds, setGuiFeeds } from '@TTH/state/accessors'

export const appendFeedEvents = (sessionId: string, events: TFeedEvent[]) => {
  const next = new Map(getGuiFeeds())
  const existing = next.get(sessionId) ?? []
  next.set(sessionId, [...existing, ...events])
  setGuiFeeds(next)
}
