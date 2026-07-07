import { describe, it, expect } from 'vitest'

import {
  DecisionsBlockFence,
  StrategyBlockFence,
  parseStrategyBlock,
  parseDecisionsBlock,
  DecisionPositionsBlockFence,
  InitiativeCompleteBlockFence,
  parseDecisionPositionsBlock,
  parseInitiativeCompleteBlock,
} from './board'

const fence = (label: string, body: string) => `\`\`\`${label}\n${body}\n\`\`\``

// ─── parseDecisionsBlock ──────────────────────────────────────────────────────

const validDecision = {
  title: `Move upmarket to mid-market teams`,
  axis: `segment`,
  description: `Signups skew toward teams of 10-50; refocus positioning there`,
  evidence: [`https://metrics.example.com/signups`, `churn cohort export`],
}

describe(`parseDecisionsBlock`, () => {
  it(`parses a valid ${DecisionsBlockFence} block`, () => {
    const text = `Board note...\n${fence(DecisionsBlockFence, JSON.stringify([validDecision]))}`
    const entries = parseDecisionsBlock(text)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      title: `Move upmarket to mid-market teams`,
      axis: `segment`,
      description: `Signups skew toward teams of 10-50; refocus positioning there`,
      evidence: [`https://metrics.example.com/signups`, `churn cohort export`],
    })
  })

  it(`reads only the LAST block when two are present`, () => {
    const first = fence(
      DecisionsBlockFence,
      JSON.stringify([{ ...validDecision, title: `first` }])
    )
    const second = fence(
      DecisionsBlockFence,
      JSON.stringify([{ ...validDecision, title: `second` }])
    )
    const entries = parseDecisionsBlock(`${first}\n${second}`)
    expect(entries).toHaveLength(1)
    expect(entries[0].title).toBe(`second`)
  })

  it(`returns [] for malformed JSON`, () => {
    expect(parseDecisionsBlock(fence(DecisionsBlockFence, `{not json`))).toEqual([])
  })

  it(`returns [] for a missing block`, () => {
    expect(parseDecisionsBlock(`no block here`)).toEqual([])
  })

  it(`drops an entry missing description`, () => {
    const { description: _drop, ...rest } = validDecision
    expect(
      parseDecisionsBlock(fence(DecisionsBlockFence, JSON.stringify([rest])))
    ).toEqual([])
  })

  it(`drops an entry with an axis not in EDecisionAxis`, () => {
    const text = fence(
      DecisionsBlockFence,
      JSON.stringify([{ ...validDecision, axis: `nonsense` }])
    )
    expect(parseDecisionsBlock(text)).toEqual([])
  })

  it(`omits evidence when absent`, () => {
    const { evidence: _drop, ...rest } = validDecision
    const entries = parseDecisionsBlock(
      fence(DecisionsBlockFence, JSON.stringify([rest]))
    )
    expect(entries).toHaveLength(1)
    expect(entries[0].evidence).toBeUndefined()
  })
})

// ─── parseDecisionPositionsBlock ──────────────────────────────────────────────

const validPosition = {
  proposalId: `dp_abc1234`,
  stance: `endorse`,
  reasoning: `Feasible in one initiative; UX cost is low`,
}

describe(`parseDecisionPositionsBlock`, () => {
  it(`parses a valid ${DecisionPositionsBlockFence} block`, () => {
    const entries = parseDecisionPositionsBlock(
      fence(DecisionPositionsBlockFence, JSON.stringify([validPosition]))
    )
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual({
      proposalId: `dp_abc1234`,
      stance: `endorse`,
      reasoning: `Feasible in one initiative; UX cost is low`,
    })
  })

  it(`reads only the LAST block when two are present`, () => {
    const first = fence(
      DecisionPositionsBlockFence,
      JSON.stringify([{ ...validPosition, reasoning: `first` }])
    )
    const second = fence(
      DecisionPositionsBlockFence,
      JSON.stringify([{ ...validPosition, reasoning: `second` }])
    )
    const entries = parseDecisionPositionsBlock(`${first}\n${second}`)
    expect(entries).toHaveLength(1)
    expect(entries[0].reasoning).toBe(`second`)
  })

  it(`returns [] for malformed JSON`, () => {
    expect(
      parseDecisionPositionsBlock(fence(DecisionPositionsBlockFence, `[oops`))
    ).toEqual([])
  })

  it(`drops an entry with a stance not in EStance`, () => {
    const text = fence(
      DecisionPositionsBlockFence,
      JSON.stringify([{ ...validPosition, stance: `veto` }])
    )
    expect(parseDecisionPositionsBlock(text)).toEqual([])
  })

  it(`drops an entry missing proposalId`, () => {
    const { proposalId: _drop, ...rest } = validPosition
    expect(
      parseDecisionPositionsBlock(
        fence(DecisionPositionsBlockFence, JSON.stringify([rest]))
      )
    ).toEqual([])
  })
})

// ─── parseStrategyBlock ───────────────────────────────────────────────────────

const validStrategy = {
  northStar: `The nervous system between AI models and the world`,
  segments: [`AI-native startups`, `platform teams`],
  positioning: `Unified auth + compute + secure proxy for agents`,
  backlog: [
    { title: `Sandbox marketplace`, rationale: `Distribution wedge`, priority: 1 },
    { title: `Usage-based pricing`, rationale: `Aligns cost to value`, priority: 2 },
  ],
}

describe(`parseStrategyBlock`, () => {
  it(`parses a valid ${StrategyBlockFence} block`, () => {
    const entries = parseStrategyBlock(
      fence(StrategyBlockFence, JSON.stringify([validStrategy]))
    )
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual(validStrategy)
  })

  it(`reads only the LAST block when two are present`, () => {
    const first = fence(StrategyBlockFence, JSON.stringify([{ northStar: `first` }]))
    const second = fence(StrategyBlockFence, JSON.stringify([{ northStar: `second` }]))
    const entries = parseStrategyBlock(`${first}\n${second}`)
    expect(entries).toHaveLength(1)
    expect(entries[0].northStar).toBe(`second`)
  })

  it(`returns [] for malformed JSON`, () => {
    expect(parseStrategyBlock(fence(StrategyBlockFence, `nope`))).toEqual([])
  })

  it(`drops an entry carrying none of the recognized fields`, () => {
    const text = fence(StrategyBlockFence, JSON.stringify([{ unrelated: true }]))
    expect(parseStrategyBlock(text)).toEqual([])
  })

  it(`drops malformed backlog items individually but keeps the entry`, () => {
    const text = fence(
      StrategyBlockFence,
      JSON.stringify([
        {
          northStar: `x`,
          backlog: [
            { title: `keep`, rationale: `ok`, priority: 1 },
            { title: `no priority`, rationale: `ok` },
            { rationale: `no title`, priority: 3 },
          ],
        },
      ])
    )
    const entries = parseStrategyBlock(text)
    expect(entries).toHaveLength(1)
    expect(entries[0].backlog).toEqual([{ title: `keep`, rationale: `ok`, priority: 1 }])
  })
})

// ─── parseInitiativeCompleteBlock ─────────────────────────────────────────────

const validComplete = {
  initiativeTitle: `Ship sandbox marketplace v1`,
  evidenceRefs: [`https://github.com/org/repo/pull/101`, `deploy marker sha-abc123`],
}

describe(`parseInitiativeCompleteBlock`, () => {
  it(`parses a valid ${InitiativeCompleteBlockFence} block`, () => {
    const entries = parseInitiativeCompleteBlock(
      fence(InitiativeCompleteBlockFence, JSON.stringify([validComplete]))
    )
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual(validComplete)
  })

  it(`reads only the LAST block when two are present`, () => {
    const first = fence(
      InitiativeCompleteBlockFence,
      JSON.stringify([{ ...validComplete, initiativeTitle: `first` }])
    )
    const second = fence(
      InitiativeCompleteBlockFence,
      JSON.stringify([{ ...validComplete, initiativeTitle: `second` }])
    )
    const entries = parseInitiativeCompleteBlock(`${first}\n${second}`)
    expect(entries).toHaveLength(1)
    expect(entries[0].initiativeTitle).toBe(`second`)
  })

  it(`returns [] for malformed JSON`, () => {
    expect(
      parseInitiativeCompleteBlock(fence(InitiativeCompleteBlockFence, `{bad`))
    ).toEqual([])
  })

  it(`drops an entry missing initiativeTitle`, () => {
    const { initiativeTitle: _drop, ...rest } = validComplete
    expect(
      parseInitiativeCompleteBlock(
        fence(InitiativeCompleteBlockFence, JSON.stringify([rest]))
      )
    ).toEqual([])
  })

  it(`drops an entry missing evidenceRefs`, () => {
    const { evidenceRefs: _drop, ...rest } = validComplete
    expect(
      parseInitiativeCompleteBlock(
        fence(InitiativeCompleteBlockFence, JSON.stringify([rest]))
      )
    ).toEqual([])
  })
})
