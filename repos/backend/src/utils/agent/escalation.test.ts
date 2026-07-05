import { describe, it, expect } from 'vitest'

import { EscalationMaxPerRun } from '@tdsk/domain'
import { parseEscalationBlock, parseEscalationResolutionsBlock } from './escalation'

const fence = (label: string, body: string) => `\`\`\`${label}\n${body}\n\`\`\``

const validEscalation = {
  title: `DB connection pool exhausted`,
  problem: `The backend runs out of DB connections under moderate load`,
  target: `app`,
  evidence: [`https://grafana.example.com/d/abc`, `service restart log`],
  proposedPatch: `Increase pool size from 10 to 25 in db config`,
  dedupeKey: `app:db-pool-exhausted`,
  issueRef: `https://github.com/org/repo/issues/42`,
  meta: { severity: `high`, component: `database` },
}

describe(`parseEscalationBlock`, () => {
  it(`parses a valid tdsk-escalations block`, () => {
    const text = `Some report...\n${fence(`tdsk-escalations`, JSON.stringify([validEscalation]))}`
    const entries = parseEscalationBlock(text)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      title: `DB connection pool exhausted`,
      problem: `The backend runs out of DB connections under moderate load`,
      target: `app`,
    })
  })

  it(`uses the LAST block when two tdsk-escalations blocks are present`, () => {
    const first = fence(
      `tdsk-escalations`,
      JSON.stringify([{ ...validEscalation, title: `first block` }])
    )
    const second = fence(
      `tdsk-escalations`,
      JSON.stringify([{ ...validEscalation, title: `second block` }])
    )
    const entries = parseEscalationBlock(`${first}\n${second}`)
    expect(entries).toHaveLength(1)
    expect(entries[0].title).toBe(`second block`)
  })

  it(`returns [] for malformed JSON`, () => {
    expect(parseEscalationBlock(fence(`tdsk-escalations`, `{not json`))).toEqual([])
  })

  it(`returns [] for a missing block`, () => {
    expect(parseEscalationBlock(`no block here`)).toEqual([])
  })

  it(`drops an entry missing problem`, () => {
    const { problem: _drop, ...rest } = validEscalation
    const text = fence(`tdsk-escalations`, JSON.stringify([rest]))
    expect(parseEscalationBlock(text)).toEqual([])
  })

  it(`drops an entry missing title`, () => {
    const { title: _drop, ...rest } = validEscalation
    const text = fence(`tdsk-escalations`, JSON.stringify([rest]))
    expect(parseEscalationBlock(text)).toEqual([])
  })

  it(`drops an entry with target not in EEscalationTarget values`, () => {
    const text = fence(
      `tdsk-escalations`,
      JSON.stringify([{ ...validEscalation, target: `nonsense` }])
    )
    expect(parseEscalationBlock(text)).toEqual([])
  })

  it(`drops an entry missing target`, () => {
    const { target: _drop, ...rest } = validEscalation
    const text = fence(`tdsk-escalations`, JSON.stringify([rest]))
    expect(parseEscalationBlock(text)).toEqual([])
  })

  it(`keeps an entry with all required fields and parses optional fields correctly`, () => {
    const text = fence(`tdsk-escalations`, JSON.stringify([validEscalation]))
    const entries = parseEscalationBlock(text)
    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry.title).toBe(validEscalation.title)
    expect(entry.problem).toBe(validEscalation.problem)
    expect(entry.target).toBe(validEscalation.target)
    expect(entry.evidence).toEqual(validEscalation.evidence)
    expect(entry.proposedPatch).toBe(validEscalation.proposedPatch)
    expect(entry.dedupeKey).toBe(validEscalation.dedupeKey)
    expect(entry.issueRef).toBe(validEscalation.issueRef)
    expect(entry.meta).toEqual(validEscalation.meta)
  })

  it(`coerces evidence to string[] via stringArray (drops non-strings)`, () => {
    const text = fence(
      `tdsk-escalations`,
      JSON.stringify([
        { ...validEscalation, evidence: [`valid`, 42, null, `also valid`] },
      ])
    )
    const entries = parseEscalationBlock(text)
    expect(entries[0].evidence).toEqual([`valid`, `also valid`])
  })

  it(`sets evidence to [] when evidence field is not an array`, () => {
    const text = fence(
      `tdsk-escalations`,
      JSON.stringify([{ ...validEscalation, evidence: `not an array` }])
    )
    const entries = parseEscalationBlock(text)
    expect(entries[0].evidence).toEqual([])
  })

  it(`omits proposedPatch when empty or missing`, () => {
    const text = fence(
      `tdsk-escalations`,
      JSON.stringify([
        { ...validEscalation, proposedPatch: `` },
        { ...validEscalation, title: `no patch`, proposedPatch: undefined },
      ])
    )
    const entries = parseEscalationBlock(text)
    expect(entries[0].proposedPatch).toBeNull()
    expect(entries[1].proposedPatch).toBeNull()
  })

  it(`omits dedupeKey when empty or missing`, () => {
    const { dedupeKey: _drop, ...rest } = validEscalation
    const text = fence(`tdsk-escalations`, JSON.stringify([rest]))
    const entries = parseEscalationBlock(text)
    expect(`dedupeKey` in entries[0]).toBe(false)
  })

  it(`omits issueRef when empty or missing`, () => {
    const { issueRef: _drop, ...rest } = validEscalation
    const text = fence(`tdsk-escalations`, JSON.stringify([rest]))
    const entries = parseEscalationBlock(text)
    expect(`issueRef` in entries[0]).toBe(false)
  })

  it(`omits meta when not a plain object`, () => {
    const text = fence(
      `tdsk-escalations`,
      JSON.stringify([{ ...validEscalation, meta: `not an object` }])
    )
    const entries = parseEscalationBlock(text)
    expect(`meta` in entries[0]).toBe(false)
  })

  it(`caps the batch at EscalationMaxPerRun (3)`, () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      ...validEscalation,
      title: `escalation ${i}`,
    }))
    const entries = parseEscalationBlock(fence(`tdsk-escalations`, JSON.stringify(many)))
    expect(entries).toHaveLength(EscalationMaxPerRun)
    expect(EscalationMaxPerRun).toBe(3)
  })

  it(`accepts all valid EEscalationTarget values`, () => {
    const targets = [`app`, `ops`, `infra`, `secrets`]
    for (const target of targets) {
      const text = fence(
        `tdsk-escalations`,
        JSON.stringify([{ ...validEscalation, target }])
      )
      const entries = parseEscalationBlock(text)
      expect(entries).toHaveLength(1)
      expect(entries[0].target).toBe(target)
    }
  })
})

describe(`parseEscalationResolutionsBlock`, () => {
  it(`parses a valid resolved entry with id`, () => {
    const text = fence(
      `tdsk-escalation-resolutions`,
      JSON.stringify([
        {
          id: `esc_abc123`,
          status: `resolved`,
          resolvedRef: `https://github.com/org/repo/pull/99`,
          reason: `PR merged`,
        },
      ])
    )
    const resolutions = parseEscalationResolutionsBlock(text)
    expect(resolutions).toHaveLength(1)
    expect(resolutions[0]).toEqual({
      id: `esc_abc123`,
      status: `resolved`,
      resolvedRef: `https://github.com/org/repo/pull/99`,
      reason: `PR merged`,
    })
  })

  it(`drops an entry missing status`, () => {
    const text = fence(
      `tdsk-escalation-resolutions`,
      JSON.stringify([{ id: `esc_abc`, dedupeKey: `app:foo` }])
    )
    expect(parseEscalationResolutionsBlock(text)).toEqual([])
  })

  it(`drops an entry with status 'promoted' (not resolved or rejected)`, () => {
    const text = fence(
      `tdsk-escalation-resolutions`,
      JSON.stringify([{ id: `esc_abc`, status: `promoted` }])
    )
    expect(parseEscalationResolutionsBlock(text)).toEqual([])
  })

  it(`keeps an entry with id but no dedupeKey`, () => {
    const text = fence(
      `tdsk-escalation-resolutions`,
      JSON.stringify([{ id: `esc_only_id`, status: `rejected` }])
    )
    const resolutions = parseEscalationResolutionsBlock(text)
    expect(resolutions).toHaveLength(1)
    expect(resolutions[0].id).toBe(`esc_only_id`)
    expect(`dedupeKey` in resolutions[0]).toBe(false)
  })

  it(`keeps an entry with dedupeKey but no id`, () => {
    const text = fence(
      `tdsk-escalation-resolutions`,
      JSON.stringify([{ dedupeKey: `app:db-pool-exhausted`, status: `resolved` }])
    )
    const resolutions = parseEscalationResolutionsBlock(text)
    expect(resolutions).toHaveLength(1)
    expect(resolutions[0].dedupeKey).toBe(`app:db-pool-exhausted`)
    expect(`id` in resolutions[0]).toBe(false)
  })

  it(`drops an entry with NEITHER id nor dedupeKey`, () => {
    const text = fence(
      `tdsk-escalation-resolutions`,
      JSON.stringify([{ status: `resolved`, resolvedRef: `https://example.com/pr/1` }])
    )
    expect(parseEscalationResolutionsBlock(text)).toEqual([])
  })

  it(`returns [] for malformed JSON`, () => {
    expect(
      parseEscalationResolutionsBlock(fence(`tdsk-escalation-resolutions`, `{bad json`))
    ).toEqual([])
  })

  it(`returns [] for a missing block`, () => {
    expect(parseEscalationResolutionsBlock(`no fenced block`)).toEqual([])
  })

  it(`omits resolvedRef and reason when empty or missing`, () => {
    const text = fence(
      `tdsk-escalation-resolutions`,
      JSON.stringify([{ id: `esc_xyz`, status: `rejected`, resolvedRef: ``, reason: `` }])
    )
    const resolutions = parseEscalationResolutionsBlock(text)
    expect(resolutions).toHaveLength(1)
    expect(`resolvedRef` in resolutions[0]).toBe(false)
    expect(`reason` in resolutions[0]).toBe(false)
  })

  it(`accepts both 'resolved' and 'rejected' statuses`, () => {
    const text = fence(
      `tdsk-escalation-resolutions`,
      JSON.stringify([
        { id: `esc_1`, status: `resolved` },
        { id: `esc_2`, status: `rejected` },
      ])
    )
    const resolutions = parseEscalationResolutionsBlock(text)
    expect(resolutions).toHaveLength(2)
    expect(resolutions[0].status).toBe(`resolved`)
    expect(resolutions[1].status).toBe(`rejected`)
  })
})
