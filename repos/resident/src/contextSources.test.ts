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

  it(`caps a section at the source max`, async () => {
    const api = makeFakeApi()
    api.onQuery(() => ({
      ok: true,
      status: 200,
      data: [{ id: `r1`, data: { blob: `x`.repeat(5000) } }],
    }))

    const out = await renderContextSources(api, [
      { collection: `c`, query: {}, as: `Big`, max: 100 },
    ])
    expect(out.length).toBe(100)
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
