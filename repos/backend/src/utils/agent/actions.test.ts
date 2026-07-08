import { describe, it, expect, vi } from 'vitest'

import { parseActionsBlock } from './actions'
import { ActionsBlockFence } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const fence = (json: string) => `\`\`\`${ActionsBlockFence}\n${json}\n\`\`\``

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
