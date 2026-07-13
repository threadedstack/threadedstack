import { describe, it, expect } from 'vitest'

import { ActionsBlockFence } from '@TDM/constants/actions'
import {
  parseActionsBlock,
  extractLastFencedBlock,
  parseActionsBlockWithMeta,
} from './parseActionsBlock'

const fence = (json: string) => `\`\`\`${ActionsBlockFence}\n${json}\n\`\`\``

describe(`extractLastFencedBlock`, () => {
  it(`returns undefined for an empty string`, () => {
    expect(extractLastFencedBlock(``, ActionsBlockFence)).toBeUndefined()
  })

  it(`returns undefined when no block with the fence exists`, () => {
    expect(extractLastFencedBlock(`plain text`, ActionsBlockFence)).toBeUndefined()
  })

  it(`extracts the block body for the given fence`, () => {
    expect(extractLastFencedBlock(fence(`[1,2]`), ActionsBlockFence)).toBe(`[1,2]\n`)
  })

  it(`returns the LAST block when multiple are present`, () => {
    const text = `${fence(`first`)}\nmiddle\n${fence(`second`)}`
    expect(extractLastFencedBlock(text, ActionsBlockFence)).toBe(`second\n`)
  })

  it(`does not match a different fence label`, () => {
    expect(extractLastFencedBlock(fence(`[1]`), `tdsk-memories`)).toBeUndefined()
  })
})

describe(`parseActionsBlock`, () => {
  it(`returns [] for an empty string`, () => {
    expect(parseActionsBlock(``)).toEqual([])
  })

  it(`returns [] when there is no block`, () => {
    expect(parseActionsBlock(`just some output`)).toEqual([])
  })

  it(`returns [] when the block JSON is malformed`, () => {
    expect(parseActionsBlock(fence(`[ { not json ]`))).toEqual([])
  })

  it(`parses a valid { "actions": [...] } object payload`, () => {
    const out = parseActionsBlock(
      fence(`{"actions":[{"function":"recordProposal","args":{"x":1}}]}`)
    )
    expect(out).toEqual([{ function: `recordProposal`, args: { x: 1 } }])
  })

  it(`parses a bare array payload`, () => {
    const out = parseActionsBlock(fence(`[{"function":"f","args":{"a":true}}]`))
    expect(out).toEqual([{ function: `f`, args: { a: true } }])
  })

  it(`uses the LAST block when multiple are present`, () => {
    const text = `${fence(`[{"function":"first","args":{}}]`)}\nchatter\n${fence(
      `[{"function":"second","args":{}}]`
    )}`
    expect(parseActionsBlock(text)).toEqual([{ function: `second`, args: {} }])
  })

  it(`returns [] when the payload is neither an array nor an { actions } object`, () => {
    expect(parseActionsBlock(fence(`{"function":"f"}`))).toEqual([])
  })

  it(`drops entries whose function is not a non-empty string`, () => {
    const out = parseActionsBlock(
      fence(
        `[{"function":123,"args":{}},{"function":"","args":{}},{"function":"keep","args":{"y":2}}]`
      )
    )
    expect(out).toEqual([{ function: `keep`, args: { y: 2 } }])
  })

  it(`defaults args to {} when missing or non-object`, () => {
    const out = parseActionsBlock(
      fence(
        `[{"function":"a"},{"function":"b","args":[1,2]},{"function":"c","args":null}]`
      )
    )
    expect(out).toEqual([
      { function: `a`, args: {} },
      { function: `b`, args: {} },
      { function: `c`, args: {} },
    ])
  })

  it(`skips non-object entries in the list`, () => {
    const out = parseActionsBlock(fence(`[null,42,"str",{"function":"ok","args":{}}]`))
    expect(out).toEqual([{ function: `ok`, args: {} }])
  })
})

describe(`parseActionsBlockWithMeta`, () => {
  it(`returns blockCount 0 and no actions when there is no block`, () => {
    const out = parseActionsBlockWithMeta(`just some output`)
    expect(out).toEqual({ actions: [], blockCount: 0 })
  })

  it(`returns blockCount 1 and parses the actions when exactly one block is present`, () => {
    const out = parseActionsBlockWithMeta(fence(`[{"function":"f","args":{"a":true}}]`))
    expect(out).toEqual({
      actions: [{ function: `f`, args: { a: true } }],
      blockCount: 1,
    })
  })

  it(`returns blockCount matching the number of blocks and only parses the last (3+ blocks)`, () => {
    const text = `${fence(`[{"function":"first","args":{}}]`)}\nchatter\n${fence(
      `[{"function":"second","args":{}}]`
    )}\nmore chatter\n${fence(`[{"function":"third","args":{}}]`)}`

    const out = parseActionsBlockWithMeta(text)
    expect(out.blockCount).toBe(3)
    expect(out.actions).toEqual([{ function: `third`, args: {} }])
  })

  it(`still returns blockCount 0 for an empty string`, () => {
    expect(parseActionsBlockWithMeta(``)).toEqual({ actions: [], blockCount: 0 })
  })

  it(`reports the block count even when the last block's JSON is malformed`, () => {
    const text = `${fence(`[{"function":"first","args":{}}]`)}\n${fence(`[ { not json ]`)}`
    const out = parseActionsBlockWithMeta(text)
    expect(out.blockCount).toBe(2)
    expect(out.actions).toEqual([])
  })
})
