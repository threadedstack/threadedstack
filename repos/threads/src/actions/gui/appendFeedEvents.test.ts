import type { TFeedEvent } from '@TTH/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetGuiFeeds = vi.fn()

let feeds = new Map<string, TFeedEvent[]>()

vi.mock(`@TTH/state/accessors`, () => ({
  getGuiFeeds: () => feeds,
  setGuiFeeds: (...args: any[]) => mockSetGuiFeeds(...args),
}))

import { appendFeedEvents } from './appendFeedEvents'

const buildEvent = (id: string): TFeedEvent => ({
  kind: `action`,
  id,
  status: `done`,
  action: `test`,
  target: `test`,
})

describe(`appendFeedEvents`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    feeds = new Map()
  })

  it(`defaults to an empty existing array for a new session and commits the events as-is via a NEW Map`, () => {
    const events = [buildEvent(`e1`), buildEvent(`e2`)]

    appendFeedEvents(`session-1`, events)

    expect(mockSetGuiFeeds).toHaveBeenCalledTimes(1)
    const committed = mockSetGuiFeeds.mock.calls[0][0] as Map<string, TFeedEvent[]>
    expect(committed).not.toBe(feeds)
    expect(committed.get(`session-1`)).toEqual(events)
  })

  it(`concatenates fully when existing + new length is <= MaxFeedEvents`, () => {
    const existing = Array.from({ length: 5 }, (_, i) => buildEvent(`existing-${i}`))
    feeds = new Map([[`session-1`, existing]])
    const events = [buildEvent(`new-1`)]

    appendFeedEvents(`session-1`, events)

    const committed = mockSetGuiFeeds.mock.calls[0][0] as Map<string, TFeedEvent[]>
    expect(committed.get(`session-1`)).toEqual([...existing, ...events])
  })

  it(`truncates to the LAST MaxFeedEvents entries when the combined length exceeds the cap, dropping the oldest`, () => {
    const existing = Array.from({ length: 1999 }, (_, i) => buildEvent(`existing-${i}`))
    feeds = new Map([[`session-1`, existing]])
    const events = [buildEvent(`new-1`), buildEvent(`new-2`)]

    appendFeedEvents(`session-1`, events)

    const committed = mockSetGuiFeeds.mock.calls[0][0] as Map<string, TFeedEvent[]>
    const merged = committed.get(`session-1`)!
    expect(merged.length).toBe(2000)
    // existing-0 (the oldest) must be the one dropped.
    expect(merged.find((e) => e.id === `existing-0`)).toBeUndefined()
    expect(merged[merged.length - 1]!.id).toBe(`new-2`)
    expect(merged[merged.length - 2]!.id).toBe(`new-1`)
  })

  it(`takes the no-truncation branch at the exact MaxFeedEvents boundary (<=, not <)`, () => {
    const existing = Array.from({ length: 1998 }, (_, i) => buildEvent(`existing-${i}`))
    feeds = new Map([[`session-1`, existing]])
    const events = [buildEvent(`new-1`), buildEvent(`new-2`)]

    appendFeedEvents(`session-1`, events)

    const committed = mockSetGuiFeeds.mock.calls[0][0] as Map<string, TFeedEvent[]>
    const merged = committed.get(`session-1`)!
    expect(merged.length).toBe(2000)
    // the full concat ran (not slice) -- the oldest existing entry survives.
    expect(merged[0]!.id).toBe(`existing-0`)
  })

  it(`commits a NEW Map preserving all other existing session entries unchanged`, () => {
    const otherEvents = [buildEvent(`other-1`)]
    feeds = new Map([[`session-other`, otherEvents]])

    appendFeedEvents(`session-1`, [buildEvent(`e1`)])

    const committed = mockSetGuiFeeds.mock.calls[0][0] as Map<string, TFeedEvent[]>
    expect(committed).not.toBe(feeds)
    expect(committed.get(`session-other`)).toBe(otherEvents)
  })
})
