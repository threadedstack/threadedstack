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

  it(`derives a scannable summary and keeps full body/input for expansion`, () => {
    const [turn] = toTimeline({
      turns: [
        {
          id: `t1`,
          createdAt: `2026-07-24T10:00:00Z`,
          data: {
            event: `agenda:groom`,
            at: `2026-07-24T10:00:00Z`,
            input: `groom the backlog`,
            output: `**Groom cycle complete.**\nPruned two dead tasks.`,
          },
        },
      ],
      messages: [],
      memories: [],
    })

    expect(turn.title).toBe(`agenda:groom`)
    // summary is the FIRST line only, not the whole multi-line body.
    expect(turn.summary).toBe(`**Groom cycle complete.**`)
    expect(turn.body).toBe(`**Groom cycle complete.**\nPruned two dead tasks.`)
    expect(turn.input).toBe(`groom the backlog`)
  })

  it(`labels message sender and memory importance as meta`, () => {
    const entries = toTimeline({
      turns: [],
      messages: [
        { id: `m1`, createdAt: `2026-07-24T12:00:00Z`, data: { subject: `re: PR`, body: `looks good`, from: `ag_eng0001` } },
      ],
      memories: [
        { id: `y1`, createdAt: `2026-07-24T11:00:00Z`, data: { text: `lease reaper healthy`, importance: 2, at: `2026-07-24T11:00:00Z` } },
      ],
    })

    const msg = entries.find((e) => e.id === `m1`)!
    const mem = entries.find((e) => e.id === `y1`)!
    expect(msg.meta).toBe(`from ag_eng0001`)
    expect(msg.summary).toBe(`looks good`)
    // A memory has no event name, so its first line becomes the title.
    expect(mem.title).toBe(`lease reaper healthy`)
    expect(mem.meta).toBe(`importance 2`)
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
