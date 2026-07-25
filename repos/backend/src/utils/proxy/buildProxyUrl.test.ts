import { describe, it, expect } from 'vitest'
import { buildProxyUrl } from './buildProxyUrl'

describe(`buildProxyUrl`, () => {
  it(`should return undefined when host is undefined`, () => {
    expect(buildProxyUrl(undefined, undefined)).toBeUndefined()
  })

  it(`should return undefined when host is an empty string`, () => {
    expect(buildProxyUrl(``, `8080`)).toBeUndefined()
  })

  it(`should not append a port suffix when port is undefined`, () => {
    expect(buildProxyUrl(`localhost`, undefined)).toBe(`http://localhost`)
  })

  it(`should append a port suffix when port is provided`, () => {
    expect(buildProxyUrl(`localhost`, `8080`)).toBe(`http://localhost:8080`)
  })

  it(`should return an already-valid URL as-is, without an http:// prefix`, () => {
    expect(buildProxyUrl(`https://example.com`, undefined)).toBe(`https://example.com`)
  })

  it(`should append a port suffix to an already-valid URL without adding a protocol prefix`, () => {
    expect(buildProxyUrl(`https://example.com`, `8080`)).toBe(`https://example.com:8080`)
  })

  it(`should prefix a bare hostname with http://`, () => {
    expect(buildProxyUrl(`localhost`, undefined)).toBe(`http://localhost`)
  })
})
