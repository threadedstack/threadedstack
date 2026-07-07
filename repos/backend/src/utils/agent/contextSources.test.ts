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
    // Only the record documents are rendered (not the row envelope ids).
    expect(out).toContain(`"title": "Ship it"`)
    expect(out).toContain(`"status": "open"`)
    expect(out).not.toContain(`rec_1`)
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

  it(`caps a section at the per-source max`, async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ data: [{ id: `r1`, data: { blob: `x`.repeat(5000) } }] })

    const out = await buildContextSourcesSection(
      buildApp(query),
      schedule({ contextSources: [{ collection: `c`, query: {}, as: `Big`, max: 100 }] })
    )
    expect(out.length).toBe(100)
  })

  it(`caps a section at ContextSourceInjectMaxChars when no max is given`, async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ data: [{ id: `r1`, data: { blob: `x`.repeat(20000) } }] })

    const out = await buildContextSourcesSection(
      buildApp(query),
      schedule({ contextSources: [{ collection: `c`, query: {}, as: `Big` }] })
    )
    expect(out.length).toBe(8000)
  })
})
