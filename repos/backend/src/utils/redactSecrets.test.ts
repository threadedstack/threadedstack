import { describe, it, expect } from 'vitest'

import { redactSecrets } from './redactSecrets'

describe(`redactSecrets`, () => {
  it(`redacts every credential shape it claims to cover`, () => {
    const cases: [string, string, string][] = [
      [`tdsk`, `tdsk_liveKey1234567890`, `[redacted]`],
      [`openai`, `sk-live-abc123`, `[redacted]`],
      [`anthropic`, `sk-ant-api03-AbCdEf123456`, `[redacted]`],
      [`ghp`, `ghp_abcdefghijklmnopqrstuvwxyz012345`, `[redacted]`],
      [`gho`, `gho_abcdefghijklmnopqrstuvwxyz012345`, `[redacted]`],
      [`ghu`, `ghu_abcdefghijklmnopqrstuvwxyz012345`, `[redacted]`],
      [`ghs`, `ghs_abcdefghijklmnopqrstuvwxyz012345`, `[redacted]`],
      [`ghr`, `ghr_abcdefghijklmnopqrstuvwxyz012345`, `[redacted]`],
      [`github_pat`, `github_pat_11ABCDEFG0abcdefghijklmno`, `[redacted]`],
      [`aws`, `AKIAIOSFODNN7EXAMPLE`, `[redacted]`],
      [`slack`, `xoxb-123456789012-abcdef`, `[redacted]`],
      // The `Bearer ` label survives so telemetry still shows a call was
      // authenticated, without showing what with.
      [`bearer`, `Bearer eyJhbGciOiJIUzI1NiJ9`, `Bearer [redacted]`],
    ]

    for (const [name, secret, expected] of cases)
      expect(redactSecrets(secret), name).toBe(expected)
  })

  it(`redacts a secret embedded mid-sentence, keeping the surrounding text`, () => {
    expect(redactSecrets(`ran curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9" ok`)).toBe(
      `ran curl -H "Authorization: Bearer [redacted]" ok`
    )
    expect(redactSecrets(`two keys: sk-live-abc123 and tdsk_liveKey1234567890.`)).toBe(
      `two keys: [redacted] and [redacted].`
    )
  })

  it(`leaves ordinary agent prose alone`, () => {
    // Word-boundary anchoring is load-bearing: an unanchored `sk-` matches
    // inside `task-management`, which would silently eat real telemetry.
    const prose = `groomed task-management, checked disk-usage and risk-assessment; the sk- prefix`

    expect(redactSecrets(prose)).toBe(prose)
  })

  it(`walks nested objects and arrays`, () => {
    expect(
      redactSecrets({
        output: { steps: [{ cmd: `export KEY=sk-live-abc123` }] },
        tags: [`ok`, `tdsk_liveKey1234567890`],
      })
    ).toEqual({
      output: { steps: [{ cmd: `export KEY=[redacted]` }] },
      tags: [`ok`, `[redacted]`],
    })
  })

  it(`returns a copy and never writes to the source document`, () => {
    const source = { nested: { key: `sk-live-abc123` }, list: [`tdsk_liveKey1234567890`] }
    const result = redactSecrets(source)

    expect(source).toEqual({
      nested: { key: `sk-live-abc123` },
      list: [`tdsk_liveKey1234567890`],
    })
    expect(result).not.toBe(source)
    expect(result.nested).not.toBe(source.nested)
    expect(result.list).not.toBe(source.list)
  })

  it(`passes non-string JSON values through untouched`, () => {
    expect(redactSecrets({ n: 7, b: true, nil: null, empty: [] })).toEqual({
      n: 7,
      b: true,
      nil: null,
      empty: [],
    })
    expect(redactSecrets(null)).toBeNull()
    expect(redactSecrets(undefined)).toBeUndefined()
  })

  it(`keeps the Bearer label whatever whitespace follows it`, () => {
    expect(redactSecrets(`Bearer  eyJhbGciOiJIUzI1NiJ9`)).toBe(`Bearer  [redacted]`)
    expect(redactSecrets(`bearer\teyJhbGciOiJIUzI1NiJ9`)).toBe(`bearer\t[redacted]`)
  })

  it(`stays linear on a 20k whitespace run`, () => {
    // `appendTranscript` tail-caps a turn at 20k characters, so this is exactly
    // the largest string that can reach here. A variable-length lookbehind on
    // the bearer rule made this quadratic — 646ms for ONE value, and a page
    // serves up to 100 of them, which stalls the single-threaded event loop.
    const start = Date.now()

    expect(redactSecrets(` `.repeat(20000))).toBe(` `.repeat(20000))
    expect(Date.now() - start).toBeLessThan(200)
  })

  it(`does not match a prefix that is too short to be a credential`, () => {
    // Every rule demands a minimum length so a bare prefix in prose survives.
    for (const short of [`sk-abc`, `tdsk_ab`, `ghp_abc`, `xoxb-abc`, `Bearer abc`])
      expect(redactSecrets(short), short).toBe(short)
  })
})
