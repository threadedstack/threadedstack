import { describe, it, expect } from 'vitest'

import { renderContextSourceSection } from './renderContextSourceSection'

describe(`renderContextSourceSection`, () => {
  it(`renders "## <as>\\n(no records)\\n\\n" when there are no documents`, () => {
    const out = renderContextSourceSection(`Empty`, [], 8000)

    expect(out).toBe(`## Empty\n(no records)\n\n`)
  })

  it(`renders all documents under the heading when the total fits within the cap`, () => {
    const documents = [
      { id: `r1`, title: `Ship it` },
      { id: `r2`, title: `Fix it` },
    ]

    const out = renderContextSourceSection(`Docs`, documents, 8000)

    expect(out).toContain(`## Docs`)
    expect(out).toContain(`"title": "Ship it"`)
    expect(out).toContain(`"id": "r2"`)
    const jsonPart = out.slice(`## Docs\n`.length, out.length - `\n\n`.length)
    expect(JSON.parse(jsonPart)).toEqual(documents)
  })

  it(`omits a document whose own JSON exceeds the cap, rather than truncating it mid-token`, () => {
    const documents = [{ id: `r1`, blob: `x`.repeat(5000) }]

    const out = renderContextSourceSection(`Big`, documents, 100)

    expect(out.length).toBeLessThanOrEqual(100)
    const jsonPart = out.slice(`## Big\n`.length, out.length - `\n\n`.length)
    expect(() => JSON.parse(jsonPart)).not.toThrow()
    expect(JSON.parse(jsonPart)).toEqual([])
  })

  it(`accumulates whole documents up to the cap, keeping only the ones that fit (valid JSON at the boundary)`, () => {
    const documents = [
      { id: `r1`, blob: `a`.repeat(40) },
      { id: `r2`, blob: `b`.repeat(40) },
      { id: `r3`, blob: `c`.repeat(40) },
    ]

    const heading = `## Docs\n`
    const twoDocs = [documents[0], documents[1]]
    // Cap sized so exactly the first two documents fit and the third does not.
    const cap = (heading + JSON.stringify(twoDocs, null, 2) + `\n\n`).length

    const out = renderContextSourceSection(`Docs`, documents, cap)

    expect(out.length).toBeLessThanOrEqual(cap)
    const jsonPart = out.slice(heading.length, out.length - `\n\n`.length)
    const parsed = JSON.parse(jsonPart)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].id).toBe(`r1`)
    expect(parsed[1].id).toBe(`r2`)
    expect(out).not.toContain(`r3`)
  })

  it(`never produces a mid-token cut for a multi-document result that exceeds the cap`, () => {
    // This is the exact regression the resident's old raw `.slice(0, cap)`
    // line produced: a truncated tail landing mid-JSON-token/mid-word with
    // no closing bracket, corrupting the section for whatever follows it.
    const documents = [
      { id: `r1`, blob: `a`.repeat(200) },
      { id: `r2`, blob: `b`.repeat(200) },
      { id: `r3`, blob: `c`.repeat(200) },
    ]

    const out = renderContextSourceSection(`Docs`, documents, 250)

    const jsonPart = out.slice(`## Docs\n`.length, out.length - `\n\n`.length)
    expect(() => JSON.parse(jsonPart)).not.toThrow()
    expect(out.endsWith(`\n\n`)).toBe(true)
  })
})
