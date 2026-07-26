import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { buildContextSourcesSection } from './contextSources'

const buildApp = (query: any) =>
  ({ locals: { db: { services: { record: { query } } } } }) as any

const schedule = (overrides: Record<string, unknown> = {}) =>
  ({
    id: `sd_1`,
    orgId: `org-1`,
    projectId: `pj_1`,
    prompt: `hello`,
    ...overrides,
  }) as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe(`buildContextSourcesSection`, () => {
  it(`injects a "## <as>" section built from the records query, scoped to the schedule project`, async () => {
    const query = vi.fn().mockResolvedValue({
      data: [
        { id: `rec_1`, data: { title: `Ship it`, status: `open` } },
        { id: `rec_2`, data: { title: `Fix it`, status: `open` } },
      ],
    })

    const out = await buildContextSourcesSection(
      buildApp(query),
      schedule({
        contextSources: [
          {
            collection: `proposals`,
            query: { where: [{ field: `status`, op: `eq`, value: `open` }], limit: 5 },
            as: `Open proposals`,
          },
        ],
      })
    )

    // The query runs scoped to the schedule's project + the named collection.
    expect(query).toHaveBeenCalledWith(`pj_1`, `proposals`, {
      where: [{ field: `status`, op: `eq`, value: `open` }],
      limit: 5,
    })
    expect(out).toContain(`## Open proposals`)
    // The document is rendered WITH its record id, so consumers (e.g. board
    // prompts) can reference records by id in follow-up effects.
    expect(out).toContain(`"title": "Ship it"`)
    expect(out).toContain(`"status": "open"`)
    expect(out).toContain(`"id": "rec_1"`)
    expect(out).toContain(`"id": "rec_2"`)
  })

  it(`lets a data field named id win over the record id (data is the document)`, async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ data: [{ id: `rec_9`, data: { id: `custom-id`, a: 1 } }] })

    const out = await buildContextSourcesSection(
      buildApp(query),
      schedule({
        contextSources: [{ collection: `c`, query: {}, as: `Docs` }],
      })
    )

    expect(out).toContain(`"id": "custom-id"`)
    expect(out).not.toContain(`rec_9`)
  })

  it(`renders each of multiple sources under its own heading`, async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: `r1`, data: { a: 1 } }] })
      .mockResolvedValueOnce({ data: [{ id: `r2`, data: { b: 2 } }] })

    const out = await buildContextSourcesSection(
      buildApp(query),
      schedule({
        contextSources: [
          { collection: `alpha`, query: {}, as: `Alpha` },
          { collection: `beta`, query: {}, as: `Beta` },
        ],
      })
    )

    expect(query).toHaveBeenCalledTimes(2)
    expect(out).toContain(`## Alpha`)
    expect(out).toContain(`## Beta`)
  })

  it(`renders "(no records)" when a source query returns an empty result`, async () => {
    const query = vi.fn().mockResolvedValue({ data: [] })
    const out = await buildContextSourcesSection(
      buildApp(query),
      schedule({ contextSources: [{ collection: `c`, query: {}, as: `Empty` }] })
    )
    expect(out).toContain(`## Empty`)
    expect(out).toContain(`(no records)`)
  })

  it(`returns '' and runs NO query when the schedule has no contextSources`, async () => {
    const query = vi.fn()
    expect(await buildContextSourcesSection(buildApp(query), schedule())).toBe(``)
    expect(
      await buildContextSourcesSection(buildApp(query), schedule({ contextSources: [] }))
    ).toBe(``)
    expect(
      await buildContextSourcesSection(
        buildApp(query),
        schedule({ contextSources: null })
      )
    ).toBe(``)
    expect(query).not.toHaveBeenCalled()
  })

  it(`degrades a failing source to an omitted section without throwing, keeping the others`, async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce(new Error(`db down`))
      .mockResolvedValueOnce({ data: [{ id: `r1`, data: { ok: true } }] })

    const out = await buildContextSourcesSection(
      buildApp(query),
      schedule({
        contextSources: [
          { collection: `broken`, query: {}, as: `Broken` },
          { collection: `good`, query: {}, as: `Good` },
        ],
      })
    )

    // The failing source contributes nothing; the healthy one still renders.
    expect(out).not.toContain(`## Broken`)
    expect(out).toContain(`## Good`)
    expect(out).toContain(`"ok": true`)
  })

  it(`omits a document whose own JSON exceeds the per-source max, rather than truncating it mid-token`, async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ data: [{ id: `r1`, data: { blob: `x`.repeat(5000) } }] })

    const out = await buildContextSourcesSection(
      buildApp(query),
      schedule({ contextSources: [{ collection: `c`, query: {}, as: `Big`, max: 100 }] })
    )

    expect(out.length).toBeLessThanOrEqual(100)
    const jsonPart = out.slice(`## Big\n`.length, out.length - `\n\n`.length)
    expect(() => JSON.parse(jsonPart)).not.toThrow()
    expect(JSON.parse(jsonPart)).toEqual([])
  })

  it(`omits a document whose own JSON exceeds the default ContextSourceInjectMaxChars cap`, async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ data: [{ id: `r1`, data: { blob: `x`.repeat(20000) } }] })

    const out = await buildContextSourcesSection(
      buildApp(query),
      schedule({ contextSources: [{ collection: `c`, query: {}, as: `Big` }] })
    )

    expect(out.length).toBeLessThanOrEqual(8000)
    const jsonPart = out.slice(`## Big\n`.length, out.length - `\n\n`.length)
    expect(JSON.parse(jsonPart)).toEqual([])
  })

  it(`accumulates whole documents up to the cap, keeping only the ones that fit (valid JSON at the boundary)`, async () => {
    const query = vi.fn().mockResolvedValue({
      data: [
        { id: `r1`, data: { blob: `a`.repeat(40) } },
        { id: `r2`, data: { blob: `b`.repeat(40) } },
        { id: `r3`, data: { blob: `c`.repeat(40) } },
      ],
    })

    const heading = `## Docs\n`
    const twoDocs = [
      { id: `r1`, blob: `a`.repeat(40) },
      { id: `r2`, blob: `b`.repeat(40) },
    ]
    // Cap sized so exactly the first two documents fit and the third does not.
    const cap = (heading + JSON.stringify(twoDocs, null, 2) + `\n\n`).length

    const out = await buildContextSourcesSection(
      buildApp(query),
      schedule({ contextSources: [{ collection: `c`, query: {}, as: `Docs`, max: cap }] })
    )

    expect(out.length).toBeLessThanOrEqual(cap)
    const jsonPart = out.slice(heading.length, out.length - `\n\n`.length)
    const parsed = JSON.parse(jsonPart)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].id).toBe(`r1`)
    expect(parsed[1].id).toBe(`r2`)
    expect(out).not.toContain(`r3`)
  })
})
