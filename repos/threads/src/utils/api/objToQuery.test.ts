import { describe, it, expect } from 'vitest'
import { objToQuery } from './objToQuery'

describe(`objToQuery`, () => {
  it(`converts a plain object of scalar values into a '?key=value&...' query string, URI-encoded`, () => {
    const result = objToQuery({ name: `a b`, count: 3, active: true })

    expect(result).toBe(`?name=a%20b&count=3&active=true`)
  })

  it(`with default opts (repeated), an array value produces repeated key=v1&key=v2 pairs`, () => {
    const result = objToQuery({ tag: [`a`, `b`, `c`] })

    expect(result).toBe(`?tag=a&tag=b&tag=c`)
  })

  it(`with opts.array set to 'string', an array value produces a single comma-joined pair`, () => {
    const result = objToQuery({ tag: [`a`, `b`, `c`] }, { array: `string` })

    expect(result).toBe(`?tag=a%2Cb%2Cc`)
  })

  it(`JSON.stringifies a nested plain-object value regardless of opts.array`, () => {
    const nested = { a: 1, b: `two` }
    const repeated = objToQuery({ meta: nested })
    const stringMode = objToQuery({ meta: nested }, { array: `string` })

    expect(repeated).toBe(`?meta=${encodeURIComponent(JSON.stringify(nested))}`)
    expect(stringMode).toBe(`?meta=${encodeURIComponent(JSON.stringify(nested))}`)
  })

  it(`skips null/undefined top-level values entirely -- the key never appears`, () => {
    const result = objToQuery({ a: 1, skipMe: null, alsoSkip: undefined, b: 2 })

    expect(result).toBe(`?a=1&b=2`)
  })

  it(`in repeated mode, skips just the null/undefined elements within an array, keeping the rest`, () => {
    const result = objToQuery({ tag: [`a`, null, `b`, undefined] })

    expect(result).toBe(`?tag=a&tag=b`)
  })

  it(`in repeated mode, drops the key entirely when every array element is null/undefined`, () => {
    const result = objToQuery({ tag: [null, undefined], other: `keep` })

    expect(result).toBe(`?other=keep`)
  })

  it(`drops the key entirely for an empty array in repeated mode`, () => {
    const result = objToQuery({ tag: [], other: `keep` })

    expect(result).toBe(`?other=keep`)
  })

  it(`returns an empty string (no bare '?') when every value is null/undefined`, () => {
    expect(objToQuery({ a: null, b: undefined })).toBe(``)
  })

  it(`returns an empty string for an empty input object`, () => {
    expect(objToQuery({})).toBe(``)
  })
})
