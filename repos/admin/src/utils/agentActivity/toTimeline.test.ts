import { describe, it, expect } from 'vitest'
import { toTimeline } from './toTimeline'

describe(`toTimeline`, () => {
  it(`merges all three sources newest first`, () => {
    const entries = toTimeline({
      // Messages deliberately carry NO `data.at` — that collection has no such
      // field, so this asserts the `createdAt` fallback actually orders them.
      turns: [
        { id: `t1`, createdAt: `2026-07-24T09:00:00Z`, data: { event: `agenda:groom`, at: `2026-07-24T10:00:00Z` } },
      ],
      messages: [{ id: `m1`, createdAt: `2026-07-24T12:00:00Z`, data: { subject: `hi` } }],
      memories: [
        { id: `y1`, createdAt: `2026-07-24T09:30:00Z`, data: { text: `learned`, at: `2026-07-24T11:00:00Z` } },
      ],
    })

    expect(entries.map((e) => e.id)).toEqual([`m1`, `y1`, `t1`])
    expect(entries.map((e) => e.kind)).toEqual([`message`, `memory`, `turn`])
  })

  it(`treats undefined sources as not-yet-fetched, not empty`, () => {
    expect(toTimeline({ turns: undefined, messages: undefined, memories: undefined }))
      .toEqual([])
  })

  it(`sorts rows with NEITHER 'at' nor createdAt last instead of throwing`, () => {
    const entries = toTimeline({
      turns: [
        { id: `t1`, createdAt: ``, data: { event: `a` } },
        { id: `t2`, createdAt: ``, data: { event: `b`, at: `2026-07-24T10:00:00Z` } },
      ],
      messages: [],
      memories: [],
    })
    expect(entries.map((e) => e.id)).toEqual([`t2`, `t1`])
  })
})
