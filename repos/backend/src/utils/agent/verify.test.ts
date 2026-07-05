import { describe, it, expect } from 'vitest'

import { DefaultVerifyProbe } from '@tdsk/domain'
import { probeFromPrBody, parseVerifyResultsBlock } from './verify'

const fence = (label: string, body: string) => `\`\`\`${label}\n${body}\n\`\`\``

describe(`probeFromPrBody`, () => {
  it(`parses a valid tdsk-verify block with kind and params`, () => {
    const probe = { kind: `health`, params: { url: `/_/health` } }
    const body = `Some PR description\n${fence(`tdsk-verify`, JSON.stringify(probe))}`
    const result = probeFromPrBody(body)
    expect(result).toEqual({ kind: `health`, params: { url: `/_/health` } })
  })

  it(`returns DefaultVerifyProbe when no block is present`, () => {
    const result = probeFromPrBody(`no fenced block here`)
    expect(result).toEqual(DefaultVerifyProbe)
  })

  it(`returns DefaultVerifyProbe when block contains malformed JSON`, () => {
    const body = fence(`tdsk-verify`, `{not valid json`)
    const result = probeFromPrBody(body)
    expect(result).toEqual(DefaultVerifyProbe)
  })

  it(`returns DefaultVerifyProbe when kind is not a valid EVerifyProbeKind value`, () => {
    const probe = { kind: `nonsense`, params: { url: `/_/health` } }
    const body = fence(`tdsk-verify`, JSON.stringify(probe))
    const result = probeFromPrBody(body)
    expect(result).toEqual(DefaultVerifyProbe)
  })

  it(`accepts an array containing one probe object (leniency — uses first element)`, () => {
    const probe = { kind: `ci-green` }
    const body = fence(`tdsk-verify`, JSON.stringify([probe]))
    const result = probeFromPrBody(body)
    expect(result).toEqual({ kind: `ci-green` })
  })

  it(`uses the LAST tdsk-verify block when two blocks are present`, () => {
    const first = fence(
      `tdsk-verify`,
      JSON.stringify({ kind: `health`, params: { url: `/first` } })
    )
    const second = fence(`tdsk-verify`, JSON.stringify({ kind: `marker-advanced` }))
    const body = `${first}\nsome text\n${second}`
    const result = probeFromPrBody(body)
    expect(result).toEqual({ kind: `marker-advanced` })
  })

  it(`returns probe without params when params is absent`, () => {
    const probe = { kind: `ci-green` }
    const body = fence(`tdsk-verify`, JSON.stringify(probe))
    const result = probeFromPrBody(body)
    expect(result).toEqual({ kind: `ci-green` })
    expect(`params` in result).toBe(false)
  })

  it(`accepts all valid EVerifyProbeKind values`, () => {
    const kinds = [`health`, `ci-green`, `marker-advanced`, `assertion`]
    for (const kind of kinds) {
      const body = fence(`tdsk-verify`, JSON.stringify({ kind }))
      const result = probeFromPrBody(body)
      expect(result.kind).toBe(kind)
    }
  })
})

describe(`parseVerifyResultsBlock`, () => {
  it(`parses a valid results array with all entries`, () => {
    const results = [
      {
        prNumber: 42,
        status: `verified`,
        mergeSha: `abc123`,
        detail: `all good`,
        revertPrUrl: `https://github.com/org/repo/pull/43`,
      },
      { prNumber: 7, status: `regressed`, detail: `health check failed` },
    ]
    const text = fence(`tdsk-verify-results`, JSON.stringify(results))
    const parsed = parseVerifyResultsBlock(text)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toEqual({
      prNumber: 42,
      status: `verified`,
      mergeSha: `abc123`,
      detail: `all good`,
      revertPrUrl: `https://github.com/org/repo/pull/43`,
    })
    expect(parsed[1]).toEqual({
      prNumber: 7,
      status: `regressed`,
      detail: `health check failed`,
    })
  })

  it(`drops an entry with missing prNumber`, () => {
    const results = [{ status: `verified` }, { prNumber: 5, status: `verified` }]
    const text = fence(`tdsk-verify-results`, JSON.stringify(results))
    const parsed = parseVerifyResultsBlock(text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].prNumber).toBe(5)
  })

  it(`drops an entry with a status that is not 'verified' or 'regressed'`, () => {
    const results = [
      { prNumber: 1, status: `pending` },
      { prNumber: 2, status: `unknown` },
      { prNumber: 3, status: `verified` },
    ]
    const text = fence(`tdsk-verify-results`, JSON.stringify(results))
    const parsed = parseVerifyResultsBlock(text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].prNumber).toBe(3)
  })

  it(`coerces prNumber from a string of digits via Number() and keeps the entry`, () => {
    const results = [{ prNumber: `99`, status: `regressed` }]
    const text = fence(`tdsk-verify-results`, JSON.stringify(results))
    const parsed = parseVerifyResultsBlock(text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].prNumber).toBe(99)
    expect(typeof parsed[0].prNumber).toBe(`number`)
  })

  it(`returns [] for malformed JSON in the block`, () => {
    const text = fence(`tdsk-verify-results`, `{bad json here`)
    expect(parseVerifyResultsBlock(text)).toEqual([])
  })

  it(`uses the LAST tdsk-verify-results block (last-block-wins)`, () => {
    const first = fence(
      `tdsk-verify-results`,
      JSON.stringify([{ prNumber: 1, status: `verified` }])
    )
    const second = fence(
      `tdsk-verify-results`,
      JSON.stringify([{ prNumber: 2, status: `regressed` }])
    )
    const text = `${first}\nsome text\n${second}`
    const parsed = parseVerifyResultsBlock(text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].prNumber).toBe(2)
    expect(parsed[0].status).toBe(`regressed`)
  })

  it(`returns [] for a missing block`, () => {
    expect(parseVerifyResultsBlock(`no fenced block here`)).toEqual([])
  })

  it(`drops optional fields (mergeSha, detail, revertPrUrl) when empty or missing`, () => {
    const results = [{ prNumber: 10, status: `verified`, mergeSha: ``, detail: `` }]
    const text = fence(`tdsk-verify-results`, JSON.stringify(results))
    const parsed = parseVerifyResultsBlock(text)
    expect(parsed).toHaveLength(1)
    expect(`mergeSha` in parsed[0]).toBe(false)
    expect(`detail` in parsed[0]).toBe(false)
    expect(`revertPrUrl` in parsed[0]).toBe(false)
  })

  it(`drops an entry with prNumber 0 (not a positive integer)`, () => {
    const results = [{ prNumber: 0, status: `verified` }]
    const text = fence(`tdsk-verify-results`, JSON.stringify(results))
    expect(parseVerifyResultsBlock(text)).toEqual([])
  })
})
