import { describe, it, expect, afterEach } from 'vitest'
import {
  safeReplacer,
  replaceUnsafe,
  injectUnsafe,
  resetInjectedLogs,
} from './safeReplacer'

describe(`safeReplacer`, () => {
  afterEach(() => {
    resetInjectedLogs()
  })

  describe(`HIDDEN sentinel short-circuit`, () => {
    it(`returns HIDDEN when the key is already the HIDDEN sentinel`, () => {
      expect(safeReplacer(`****`, `anything`)).toBe(`****`)
    })

    it(`returns HIDDEN when the value is already the HIDDEN sentinel`, () => {
      expect(safeReplacer(`x`, `****`)).toBe(`****`)
    })
  })

  describe(`Buffer / Date coercion`, () => {
    it(`converts a Buffer value to a base64 string`, () => {
      expect(safeReplacer(`x`, Buffer.from(`hello`))).toBe(`aGVsbG8=`)
    })

    it(`converts a Date value to its toString() form`, () => {
      const date = new Date(0)
      expect(safeReplacer(`x`, date)).toBe(date.toString())
    })
  })

  describe(`key-based secret detection`, () => {
    it.each([
      [`password`, `hunter2`],
      [`apiKey`, `sk-12345`],
      [`api-key`, `sk-12345`],
      [`sessionId`, `abc123`],
      [`session-id`, `abc123`],
      [`token`, `xyz`],
      [`secret`, `mysecret`],
      [`pw`, `p`],
      [`pass`, `p`],
      [`connect.sid`, `abcd`],
    ])(`hides the value for a %s key`, (key, value) => {
      const result = safeReplacer(key, value)
      expect(result).not.toBe(value)
      expect(String(result)).toContain(`****`)
    })

    it(`hides via the generic /pass/i pattern for a key that merely contains "pass"`, () => {
      // "passing" doesn't match the anchored `/^pass$/` rule, but the earlier
      // unanchored `/pass/i` rule in KEYS still catches it.
      expect(safeReplacer(`passing`, `val`)).toBe(`pass ****`)
    })

    it(`does not treat "pwned" as the anchored "pw" key`, () => {
      expect(safeReplacer(`pwned`, `val`)).toBe(`val`)
    })

    it(`omits the separator space when key and value are the same string`, () => {
      expect(safeReplacer(`password`, `password`)).toBe(`password****`)
    })

    it(`includes a separator space when key and value differ`, () => {
      expect(safeReplacer(`password`, `hunter2`)).toBe(`password ****`)
    })
  })

  describe(`non-string values pass through unaffected by key rules`, () => {
    it(`returns a number value unchanged even under a secret-like key`, () => {
      // Key-based redaction transforms the KEY text itself (see above), so a
      // non-string value only reaches passthrough when the key doesn't match.
      expect(safeReplacer(`count`, 42)).toBe(42)
    })

    it(`returns an object value unchanged`, () => {
      const obj = { a: 1 }
      expect(safeReplacer(`x`, obj)).toBe(obj)
    })

    it(`returns null unchanged`, () => {
      expect(safeReplacer(`x`, null)).toBe(null)
    })

    it(`returns undefined unchanged`, () => {
      expect(safeReplacer(`x`, undefined)).toBe(undefined)
    })
  })

  describe(`unsafe value patterns`, () => {
    it(`hides a credit-card-shaped value under a plain key`, () => {
      expect(safeReplacer(`normalKey`, `4111-1111-1111-1111`)).toBe(`****`)
    })

    it(`hides a value containing "Bearer "`, () => {
      expect(safeReplacer(`normalKey`, `Bearer abc123`)).toBe(`****`)
    })

    it(`hides a value that already looks like a partially-masked secret`, () => {
      expect(safeReplacer(`normalKey`, `****extra`)).toBe(`****`)
    })

    it(`leaves an ordinary value under a plain key untouched`, () => {
      expect(safeReplacer(`normalKey`, `normalValue`)).toBe(`normalValue`)
    })
  })

  describe(`unsafe key patterns not covered by the KEYS list`, () => {
    it(`hides the value when the key contains "auth" even with a benign value`, () => {
      expect(safeReplacer(`authHeader`, `plainvalue`)).toBe(`****`)
    })

    it(`hides via the KEYS token match when the key contains "token"`, () => {
      expect(safeReplacer(`bearerToken2`, `plainvalue`)).toBe(`bearerToken ****`)
    })
  })

  describe(`array-key newline splitting`, () => {
    it(`splits a multi-line "stack" value into a trimmed array`, () => {
      expect(safeReplacer(`stack`, `at foo\nat bar`)).toEqual([`at foo`, `at bar`])
    })

    it(`splits a multi-line "message" value into a trimmed array`, () => {
      expect(safeReplacer(`message`, `line1\nline2`)).toEqual([`line1`, `line2`])
    })

    it(`leaves a single-line "stack" value as a plain string`, () => {
      expect(safeReplacer(`stack`, `single line`)).toBe(`single line`)
    })
  })

  describe(`dynamic injected redaction`, () => {
    it(`replaces every occurrence of an injected marker with HIDDEN`, () => {
      injectUnsafe([`zzzcustommarker123`])
      expect(safeReplacer(`x`, `contains zzzcustommarker123 inside`)).toBe(
        `contains **** inside`
      )
    })

    it(`stops redacting once resetInjectedLogs is called`, () => {
      injectUnsafe([`zzzcustommarker123`])
      resetInjectedLogs()
      expect(safeReplacer(`x`, `contains zzzcustommarker123 inside`)).toBe(
        `contains zzzcustommarker123 inside`
      )
    })

    it(`does not inject the same item twice`, () => {
      injectUnsafe([`dupmarker`])
      injectUnsafe([`dupmarker`])
      expect(safeReplacer(`x`, `dupmarker dupmarker`)).toBe(`**** ****`)
    })
  })

  describe(`JSON.stringify integration`, () => {
    it(`redacts a secret field when used as a JSON.stringify replacer`, () => {
      const json = JSON.stringify({ password: `hunter2`, name: `bob` }, safeReplacer)
      expect(JSON.parse(json)).toEqual({ password: `password ****`, name: `bob` })
    })

    it(`splits nested error stack/message fields into arrays`, () => {
      const json = JSON.stringify(
        { err: { message: `boom\nline2`, stack: `at foo\nat bar` } },
        safeReplacer
      )
      expect(JSON.parse(json)).toEqual({
        err: { message: [`boom`, `line2`], stack: [`at foo`, `at bar`] },
      })
    })
  })
})

describe(`replaceUnsafe`, () => {
  it(`returns an ordinary string unchanged`, () => {
    expect(replaceUnsafe(`hello world`)).toBe(`hello world`)
  })

  it(`redacts a string that looks like a secret`, () => {
    expect(replaceUnsafe(`token abc123`)).toBe(`token ****`)
  })

  describe(`value-capture boundary (does not truncate the rest of the line)`, () => {
    it(`preserves fields after a redacted key in a compact production JSON line and keeps valid JSON`, () => {
      const line = JSON.stringify({
        data: { apiKey: `sk-12345`, user: `bob`, role: `admin`, status: 200 },
      })
      const out = replaceUnsafe(line)

      expect(() => JSON.parse(out)).not.toThrow()
      const parsed = JSON.parse(out)
      expect(parsed.data.user).toBe(`bob`)
      expect(parsed.data.role).toBe(`admin`)
      expect(parsed.data.status).toBe(200)
      expect(out).not.toContain(`sk-12345`)
    })

    it(`preserves fields after a redacted key in a compact single-line dev/prettyPrint object`, () => {
      const line = `{ token: 'abc123', user: 'bob', status: 200 }`
      const out = replaceUnsafe(line)

      expect(out).toContain(`user`)
      expect(out).toContain(`bob`)
      expect(out).toContain(`status`)
      expect(out).toContain(`200`)
      expect(out).not.toContain(`abc123`)
    })

    it(`stops the value capture at a newline, leaving subsequent lines untouched`, () => {
      const out = replaceUnsafe(`token: abc123\nnext line unaffected`)

      expect(out).toContain(`next line unaffected`)
      expect(out).not.toContain(`abc123`)
    })
  })
})
