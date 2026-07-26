import { describe, it, expect } from 'vitest'

import { makeFakeApi } from './testUtils'
import { renderContextSources } from './contextSources'

describe(`renderContextSources`, () => {
  it(`returns empty for no sources`, async () => {
    const api = makeFakeApi()
    expect(await renderContextSources(api)).toBe(``)
    expect(await renderContextSources(api, [])).toBe(``)
    expect(api.queries).toHaveLength(0)
  })

  it(`renders each source under its ## <as> heading with record ids (backend format)`, async () => {
    const api = makeFakeApi()
    api.onQuery((collection) =>
      collection === `plans`
        ? {
            ok: true,
            status: 200,
            data: [{ id: `p1`, data: { goal: `growth`, id: `keep-me` } }],
          }
        : { ok: true, status: 200, data: [] }
    )

    const out = await renderContextSources(api, [
      { collection: `plans`, query: {}, as: `Active plans` },
      { collection: `escalations`, query: {}, as: `Open escalations` },
    ])

    expect(out).toContain(`## Active plans`)
    // A data field named `id` wins the spread (data is the document)
    expect(out).toContain(`"id": "keep-me"`)
    expect(out).toContain(`"goal": "growth"`)
    expect(out).toContain(`## Open escalations\n(no records)`)
  })

  it(`omits a document whose own JSON exceeds the source max, rather than truncating it mid-token`, async () => {
    const api = makeFakeApi()
    api.onQuery(() => ({
      ok: true,
      status: 200,
      data: [{ id: `r1`, data: { blob: `x`.repeat(5000) } }],
    }))

    const out = await renderContextSources(api, [
      { collection: `c`, query: {}, as: `Big`, max: 100 },
    ])

    expect(out.length).toBeLessThanOrEqual(100)
    const jsonPart = out.slice(`## Big\n`.length, out.length - `\n\n`.length)
    expect(() => JSON.parse(jsonPart)).not.toThrow()
    expect(JSON.parse(jsonPart)).toEqual([])
  })

  it(`never produces a mid-token cut for a multi-document result that exceeds the cap`, async () => {
    // Regression test for the raw `.slice(0, cap)` bug: the old
    // implementation built the full section then sliced it mid-JSON-token,
    // so the truncated tail abutted the next section's heading with no
    // closing bracket. The shared accumulate-whole-documents-up-to-cap
    // logic must keep only whole documents instead.
    const api = makeFakeApi()
    api.onQuery(() => ({
      ok: true,
      status: 200,
      data: [
        { id: `r1`, data: { blob: `a`.repeat(200) } },
        { id: `r2`, data: { blob: `b`.repeat(200) } },
        { id: `r3`, data: { blob: `c`.repeat(200) } },
      ],
    }))

    const out = await renderContextSources(api, [
      { collection: `c`, query: {}, as: `Docs`, max: 250 },
    ])

    const jsonPart = out.slice(`## Docs\n`.length, out.length - `\n\n`.length)
    expect(() => JSON.parse(jsonPart)).not.toThrow()
    expect(out.endsWith(`\n\n`)).toBe(true)
  })

  it(`skips a failing source without dropping its siblings`, async () => {
    const api = makeFakeApi()
    api.onQuery((collection) =>
      collection === `broken`
        ? { ok: false, status: 500, error: `boom` }
        : { ok: true, status: 200, data: [{ id: `r1`, data: { v: 1 } }] }
    )

    const out = await renderContextSources(api, [
      { collection: `broken`, query: {}, as: `Broken` },
      { collection: `fine`, query: {}, as: `Fine` },
    ])

    expect(out).not.toContain(`## Broken`)
    expect(out).toContain(`## Fine`)
  })
})
