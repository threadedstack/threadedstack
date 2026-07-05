import { describe, it, expect } from 'vitest'

import { parseTasksBlock, parseTaskPickupsBlock } from './task'

const fence = (label: string, body: string) => `\`\`\`${label}\n${body}\n\`\`\``

const validTask = {
  title: `Fix flaky CI test`,
  description: `The amd64 build step fails intermittently`,
  evidence: `https://github.com/threadedstack/threadedstack/actions/runs/123`,
  priority: `P1`,
  sourceSignal: `ci`,
}

describe(`parseTasksBlock`, () => {
  it(`parses a valid tdsk-tasks block`, () => {
    const text = `Some report...\n${fence(`tdsk-tasks`, JSON.stringify([validTask]))}`
    const entries = parseTasksBlock(text)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      title: `Fix flaky CI test`,
      description: `The amd64 build step fails intermittently`,
      evidence: `https://github.com/threadedstack/threadedstack/actions/runs/123`,
      priority: `P1`,
      sourceSignal: `ci`,
    })
  })

  it(`drops entries missing title/description/evidence`, () => {
    const text = fence(
      `tdsk-tasks`,
      JSON.stringify([
        { title: `x`, description: `y` }, // no evidence
        { description: `y`, evidence: `z` }, // no title
        { ...validTask, title: `ok` },
      ])
    )
    const entries = parseTasksBlock(text)
    expect(entries).toHaveLength(1)
    expect(entries[0].title).toBe(`ok`)
  })

  it(`returns [] for a missing block`, () => {
    expect(parseTasksBlock(`no block here`)).toEqual([])
  })

  it(`returns [] for malformed JSON`, () => {
    expect(parseTasksBlock(fence(`tdsk-tasks`, `{not json`))).toEqual([])
  })

  it(`returns [] for a non-array payload`, () => {
    expect(parseTasksBlock(fence(`tdsk-tasks`, `{"title":"x"}`))).toEqual([])
  })

  it(`uses the LAST block when multiple are present`, () => {
    const first = fence(`tdsk-tasks`, JSON.stringify([{ ...validTask, title: `a` }]))
    const second = fence(`tdsk-tasks`, JSON.stringify([{ ...validTask, title: `b` }]))
    const entries = parseTasksBlock(`${first}\n${second}`)
    expect(entries).toHaveLength(1)
    expect(entries[0].title).toBe(`b`)
  })

  it(`coerces an invalid/absent priority to P3`, () => {
    const text = fence(
      `tdsk-tasks`,
      JSON.stringify([
        { ...validTask, title: `no priority`, priority: undefined },
        { ...validTask, title: `bad priority`, priority: `not-a-priority` },
      ])
    )
    const entries = parseTasksBlock(text)
    expect(entries).toHaveLength(2)
    expect(entries[0].priority).toBe(`P3`)
    expect(entries[1].priority).toBe(`P3`)
  })

  it(`preserves a valid priority`, () => {
    const entries = parseTasksBlock(
      fence(`tdsk-tasks`, JSON.stringify([{ ...validTask, priority: `P0` }]))
    )
    expect(entries[0].priority).toBe(`P0`)
  })

  it(`coerces an absent sourceSignal to 'other'`, () => {
    const { sourceSignal: _drop, ...rest } = validTask
    const entries = parseTasksBlock(fence(`tdsk-tasks`, JSON.stringify([rest])))
    expect(entries[0].sourceSignal).toBe(`other`)
  })

  it(`preserves a valid sourceSignal`, () => {
    const entries = parseTasksBlock(
      fence(`tdsk-tasks`, JSON.stringify([{ ...validTask, sourceSignal: `ci` }]))
    )
    expect(entries[0].sourceSignal).toBe(`ci`)
  })

  it(`derives a dedupeKey from sourceSignal + slugified title when omitted`, () => {
    const entries = parseTasksBlock(
      fence(
        `tdsk-tasks`,
        JSON.stringify([
          {
            ...validTask,
            title: `Fix Flaky CI Test!!`,
            sourceSignal: `ci`,
            dedupeKey: undefined,
          },
        ])
      )
    )
    expect(entries[0].dedupeKey).toBe(`ci:fix-flaky-ci-test`)
  })

  it(`preserves a provided dedupeKey`, () => {
    const entries = parseTasksBlock(
      fence(`tdsk-tasks`, JSON.stringify([{ ...validTask, dedupeKey: `custom-key` }]))
    )
    expect(entries[0].dedupeKey).toBe(`custom-key`)
  })

  it(`truncates a description longer than the max chars`, () => {
    const longDescription = `x`.repeat(7000)
    const entries = parseTasksBlock(
      fence(
        `tdsk-tasks`,
        JSON.stringify([{ ...validTask, description: longDescription }])
      )
    )
    expect(entries[0].description.length).toBe(6000)
  })

  it(`truncates evidence longer than the max chars`, () => {
    const longEvidence = `y`.repeat(5000)
    const entries = parseTasksBlock(
      fence(`tdsk-tasks`, JSON.stringify([{ ...validTask, evidence: longEvidence }]))
    )
    expect(entries[0].evidence.length).toBe(4000)
  })

  it(`caps the batch at the per-run maximum`, () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      ...validTask,
      title: `task ${i}`,
    }))
    const entries = parseTasksBlock(fence(`tdsk-tasks`, JSON.stringify(many)))
    expect(entries).toHaveLength(5)
  })
})

describe(`parseTaskPickupsBlock`, () => {
  it(`parses a valid pickup with proposalId and prUrl`, () => {
    const text = fence(
      `tdsk-task-picked`,
      JSON.stringify([
        {
          proposalId: `tp_1`,
          prUrl: `https://github.com/org/repo/pull/1`,
          note: `picked it`,
        },
      ])
    )
    const pickups = parseTaskPickupsBlock(text)
    expect(pickups).toEqual([
      {
        proposalId: `tp_1`,
        prUrl: `https://github.com/org/repo/pull/1`,
        note: `picked it`,
      },
    ])
  })

  it(`drops an entry missing proposalId`, () => {
    const text = fence(
      `tdsk-task-picked`,
      JSON.stringify([
        { prUrl: `https://github.com/org/repo/pull/1` },
        { proposalId: `tp_2` },
      ])
    )
    const pickups = parseTaskPickupsBlock(text)
    expect(pickups).toHaveLength(1)
    expect(pickups[0].proposalId).toBe(`tp_2`)
  })

  it(`returns [] for a missing or malformed block`, () => {
    expect(parseTaskPickupsBlock(`nothing`)).toEqual([])
    expect(parseTaskPickupsBlock(fence(`tdsk-task-picked`, `{bad`))).toEqual([])
  })
})
