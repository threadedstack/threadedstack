import { describe, it, expect, afterEach } from 'vitest'
import { injectKeyValues } from './injectKeyValues'
import { safeReplacer, resetInjectedLogs } from './safeReplacer'

describe(`injectKeyValues`, () => {
  afterEach(() => {
    resetInjectedLogs()
  })

  it(`returns non-object input unchanged`, () => {
    expect(injectKeyValues(null as any)).toBe(null)
    expect(injectKeyValues(undefined as any)).toBe(undefined)
    expect(injectKeyValues(`str` as any)).toBe(`str`)
  })

  it(`returns an empty object unchanged without throwing`, () => {
    const resp = {}
    expect(injectKeyValues(resp)).toBe(resp)
  })

  it(`does not throw when values include numbers, booleans, null, arrays, and nested objects`, () => {
    const resp = {
      userId: `u1`,
      count: 42,
      active: true,
      missing: null,
      tags: [`a`, `b`],
      meta: { nested: 1 },
    }

    expect(() => injectKeyValues(resp)).not.toThrow()
    expect(injectKeyValues(resp)).toBe(resp)
  })

  it(`registers the object's keys for redaction`, () => {
    injectKeyValues({ zzzcustomkey123: `val` })
    expect(safeReplacer(`x`, `contains zzzcustomkey123 inside`)).toBe(
      `contains **** inside`
    )
  })

  it(`registers only the string values for redaction, skipping non-strings`, () => {
    injectKeyValues({
      zzzstrfield: `zzzcustomvalue456`,
      zzznumfield: 42,
      zzzboolfield: true,
      zzzobjfield: { nested: 1 },
    })

    expect(safeReplacer(`x`, `contains zzzcustomvalue456 inside`)).toBe(
      `contains **** inside`
    )
  })

  it(`does not register an empty-string value, which would corrupt later redaction`, () => {
    injectKeyValues({ zzzemptyfield: `` })
    expect(safeReplacer(`x`, `unrelated text`)).toBe(`unrelated text`)
  })
})
