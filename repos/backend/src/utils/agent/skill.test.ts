import { describe, it, expect } from 'vitest'

import { parseSkillBlock, parseSkillReviewsBlock } from './skill'

const fence = (label: string, body: string) => `\`\`\`${label}\n${body}\n\`\`\``

describe(`parseSkillBlock`, () => {
  it(`parses a valid tdsk-skills block`, () => {
    const text = `Some report...\n${fence(
      `tdsk-skills`,
      JSON.stringify([
        {
          name: `Deploy check`,
          description: `Runs deploy checks`,
          instructions: `Run tests then build`,
          tools: [`shellExec`],
          triggerKeywords: [`deploy`],
          alwaysActive: true,
        },
      ])
    )}`
    const entries = parseSkillBlock(text)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      name: `Deploy check`,
      description: `Runs deploy checks`,
      instructions: `Run tests then build`,
      tools: [`shellExec`],
      triggerKeywords: [`deploy`],
      alwaysActive: true,
    })
  })

  it(`drops entries missing name/description/instructions`, () => {
    const text = fence(
      `tdsk-skills`,
      JSON.stringify([
        { name: `x`, description: `y` }, // no instructions
        { description: `y`, instructions: `z` }, // no name
        { name: `ok`, description: `d`, instructions: `i` },
      ])
    )
    const entries = parseSkillBlock(text)
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe(`ok`)
  })

  it(`returns [] for a missing block`, () => {
    expect(parseSkillBlock(`no block here`)).toEqual([])
  })

  it(`returns [] for malformed JSON`, () => {
    expect(parseSkillBlock(fence(`tdsk-skills`, `{not json`))).toEqual([])
  })

  it(`returns [] for a non-array payload`, () => {
    expect(parseSkillBlock(fence(`tdsk-skills`, `{"name":"x"}`))).toEqual([])
  })

  it(`uses the LAST block when multiple are present`, () => {
    const first = fence(
      `tdsk-skills`,
      JSON.stringify([{ name: `a`, description: `d`, instructions: `i` }])
    )
    const second = fence(
      `tdsk-skills`,
      JSON.stringify([{ name: `b`, description: `d`, instructions: `i` }])
    )
    const entries = parseSkillBlock(`${first}\n${second}`)
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe(`b`)
  })

  it(`caps the batch at the per-run maximum`, () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      name: `s${i}`,
      description: `d`,
      instructions: `i`,
    }))
    const entries = parseSkillBlock(fence(`tdsk-skills`, JSON.stringify(many)))
    expect(entries.length).toBeLessThanOrEqual(3)
  })
})

describe(`parseSkillReviewsBlock`, () => {
  it(`parses valid review decisions`, () => {
    const text = fence(
      `tdsk-skill-reviews`,
      JSON.stringify([
        { proposalId: `pr_1`, approve: true, reason: `looks good` },
        { proposalId: `pr_2`, approve: false },
      ])
    )
    const reviews = parseSkillReviewsBlock(text)
    expect(reviews).toEqual([
      { proposalId: `pr_1`, approve: true, reason: `looks good` },
      { proposalId: `pr_2`, approve: false, reason: undefined },
    ])
  })

  it(`drops entries missing proposalId or a boolean approve`, () => {
    const text = fence(
      `tdsk-skill-reviews`,
      JSON.stringify([
        { approve: true }, // no proposalId
        { proposalId: `pr_1`, approve: `yes` }, // non-boolean
        { proposalId: `pr_2`, approve: true },
      ])
    )
    const reviews = parseSkillReviewsBlock(text)
    expect(reviews).toHaveLength(1)
    expect(reviews[0].proposalId).toBe(`pr_2`)
  })

  it(`returns [] for a missing or malformed block`, () => {
    expect(parseSkillReviewsBlock(`nothing`)).toEqual([])
    expect(parseSkillReviewsBlock(fence(`tdsk-skill-reviews`, `{bad`))).toEqual([])
  })
})
