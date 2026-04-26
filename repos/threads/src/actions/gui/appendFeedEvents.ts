import type { TFeedEvent } from '@TTH/types'

import { MaxFeedEvents } from '@TTH/constants/values'
import { getGuiFeeds, setGuiFeeds } from '@TTH/state/accessors'

export const appendFeedEvents = (sessionId: string, events: TFeedEvent[]) => {
  const feeds = getGuiFeeds()
  const existing = feeds.get(sessionId) ?? []
  const total = existing.length + events.length

  const merged: TFeedEvent[] =
    total <= MaxFeedEvents
      ? existing.concat(events)
      : existing.concat(events).slice(-MaxFeedEvents)

  const next = new Map(feeds)
  next.set(sessionId, merged)
  setGuiFeeds(next)
}
