import { describe, it, expect } from 'vitest'
import { isDomain } from './isDomain'

describe(`isDomain`, () => {
  it(`should return true for valid domains`, () => {
    expect(isDomain(`example.com`)).toBe(true)
    expect(isDomain(`sub.domain.co.uk`)).toBe(true)
    expect(isDomain(`my-site.org`)).toBe(true)
    expect(isDomain(`a.bc`)).toBe(true)
  })

  it(`should return false for invalid domains`, () => {
    expect(isDomain(`not-a-domain`)).toBe(false)
    expect(isDomain(`.com`)).toBe(false)
    expect(isDomain(``)).toBe(false)
    expect(isDomain(`   `)).toBe(false)
    expect(isDomain(`-bad.com`)).toBe(false)
  })

  it(`should return false for non-string values`, () => {
    expect(isDomain(null as any)).toBe(false)
    expect(isDomain(undefined as any)).toBe(false)
    expect(isDomain(123 as any)).toBe(false)
  })

  it(`should handle case insensitive domains`, () => {
    expect(isDomain(`EXAMPLE.COM`)).toBe(true)
    expect(isDomain(`Example.Com`)).toBe(true)
    expect(isDomain(`SUB.DOMAIN.CO.UK`)).toBe(true)
    expect(isDomain(`My-Site.ORG`)).toBe(true)
  })
})
