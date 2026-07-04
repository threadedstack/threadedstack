import { describe, it, expect, vi } from 'vitest'

import {
  buildEnvPrefix,
  clampImportance,
  parseMemoryBlock,
  truncateMemoryText,
  matchTransientSignal,
  MemoryDefaultImportance,
  isTransientUpstreamFailure,
} from './memory'
import {
  MemoriesBlockFence,
  MemoryMaxTextChars,
  MemoryMaxImportance,
  MemoryMinImportance,
} from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const fence = (json: string) => `\`\`\`${MemoriesBlockFence}\n${json}\n\`\`\``

// ── clampImportance ──────────────────────────────────────────────────

describe(`clampImportance`, () => {
  it(`clamps below the minimum`, () => {
    expect(clampImportance(0)).toBe(MemoryMinImportance)
    expect(clampImportance(-5)).toBe(MemoryMinImportance)
  })
  it(`clamps above the maximum`, () => {
    expect(clampImportance(99)).toBe(MemoryMaxImportance)
  })
  it(`rounds to an integer within range`, () => {
    expect(clampImportance(4.6)).toBe(5)
  })
})

// ── truncateMemoryText ───────────────────────────────────────────────

describe(`truncateMemoryText`, () => {
  it(`truncates over-long text`, () => {
    expect(truncateMemoryText(`x`.repeat(MemoryMaxTextChars + 10))).toHaveLength(
      MemoryMaxTextChars
    )
  })
  it(`leaves short text unchanged`, () => {
    expect(truncateMemoryText(`hi`)).toBe(`hi`)
  })
})

// ── isTransientUpstreamFailure ───────────────────────────────────────

describe(`isTransientUpstreamFailure`, () => {
  it.each([
    `API Error: 529 Overloaded`,
    `the model is Overloaded, retry`,
    `HTTP 503 Service Unavailable`,
    `got a 502 bad gateway`,
    `429 rate limit exceeded`,
    `rate-limited by upstream`,
    `API Error: 500 something`,
    `500 Internal Server Error`,
  ])(`detects transient signal: %s`, (text) => {
    expect(isTransientUpstreamFailure(text)).toBe(true)
  })

  it.each([
    ``,
    `Task completed successfully`,
    `SyntaxError: unexpected token`,
    `command not found: claude`,
    `exit code 1`,
  ])(`treats normal output as non-transient: %s`, (text) => {
    expect(isTransientUpstreamFailure(text)).toBe(false)
  })
})

// ── matchTransientSignal ─────────────────────────────────────────────

describe(`matchTransientSignal`, () => {
  it(`returns the matched signal substring`, () => {
    expect(matchTransientSignal(`API Error: 529 Overloaded`)).toBe(`API Error: 529`)
    expect(matchTransientSignal(`the model is 529 today`)).toBe(`529`)
    expect(matchTransientSignal(`the model is Overloaded`)).toBe(`Overloaded`)
    expect(matchTransientSignal(`429 rate limit exceeded`)).toBe(`rate limit`)
    expect(matchTransientSignal(`HTTP 503 Service Unavailable`)).toBe(`503`)
  })

  it(`returns undefined when there is no transient signal`, () => {
    expect(matchTransientSignal(``)).toBeUndefined()
    expect(matchTransientSignal(`Task completed successfully`)).toBeUndefined()
  })
})

// ── buildEnvPrefix ───────────────────────────────────────────────────

describe(`buildEnvPrefix`, () => {
  it(`returns an empty string for an empty env map`, () => {
    expect(buildEnvPrefix({})).toBe(``)
  })

  it(`single-quotes each value and prefixes with env`, () => {
    expect(
      buildEnvPrefix({
        ANTHROPIC_AUTH_TOKEN: `tdsk_ph_abc123`,
        ANTHROPIC_BASE_URL: `https://api.z.ai/api/anthropic`,
      })
    ).toBe(
      `env ANTHROPIC_AUTH_TOKEN='tdsk_ph_abc123' ANTHROPIC_BASE_URL='https://api.z.ai/api/anthropic'`
    )
  })

  it(`escapes embedded single quotes so values cannot break out of the quoting`, () => {
    expect(buildEnvPrefix({ FOO: `a'b` })).toBe(`env FOO='a'\\''b'`)
  })

  it(`preserves insertion order of the env keys`, () => {
    expect(buildEnvPrefix({ B: `2`, A: `1` })).toBe(`env B='2' A='1'`)
  })
})

// ── parseMemoryBlock ─────────────────────────────────────────────────

describe(`parseMemoryBlock`, () => {
  it(`returns [] when there is no block`, () => {
    expect(parseMemoryBlock(`just some output`)).toEqual([])
  })

  it(`returns [] for an empty string`, () => {
    expect(parseMemoryBlock(``)).toEqual([])
  })

  it(`returns [] when the block JSON is malformed`, () => {
    expect(parseMemoryBlock(fence(`[ { not json ]`))).toEqual([])
  })

  it(`returns [] when the payload is not an array`, () => {
    expect(parseMemoryBlock(fence(`{"text":"hi"}`))).toEqual([])
  })

  it(`parses a valid block, defaulting and clamping importance`, () => {
    const out = parseMemoryBlock(
      fence(`[{"text":"remember this","importance":50},{"text":"no importance"}]`)
    )
    expect(out).toEqual([
      { text: `remember this`, importance: MemoryMaxImportance },
      { text: `no importance`, importance: MemoryDefaultImportance },
    ])
  })

  it(`keeps a recognized kind and drops an invalid one`, () => {
    const out = parseMemoryBlock(
      fence(`[{"text":"a","kind":"roadmap"},{"text":"b","kind":"bogus"}]`)
    )
    expect(out[0].kind).toBe(`roadmap`)
    expect(out[1].kind).toBeUndefined()
  })

  it(`drops entries without a non-empty text string`, () => {
    const out = parseMemoryBlock(fence(`[{"text":""},{"importance":3},{"text":"keep"}]`))
    expect(out).toEqual([{ text: `keep`, importance: MemoryDefaultImportance }])
  })

  it(`truncates over-long text`, () => {
    const long = `y`.repeat(MemoryMaxTextChars + 100)
    const out = parseMemoryBlock(fence(JSON.stringify([{ text: long }])))
    expect(out[0].text).toHaveLength(MemoryMaxTextChars)
  })

  it(`uses the LAST block when multiple are present`, () => {
    const text = `${fence(`[{"text":"first"}]`)}\nchatter\n${fence(`[{"text":"second"}]`)}`
    const out = parseMemoryBlock(text)
    expect(out).toEqual([{ text: `second`, importance: MemoryDefaultImportance }])
  })

  it(`carries meta through when present`, () => {
    const out = parseMemoryBlock(fence(`[{"text":"a","meta":{"src":"x"}}]`))
    expect(out[0].meta).toEqual({ src: `x` })
  })
})
