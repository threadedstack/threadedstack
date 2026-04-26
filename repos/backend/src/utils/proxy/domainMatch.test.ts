import { describe, it, expect } from 'vitest'
import { isDomainAllowed } from './domainMatch'

describe(`isDomainAllowed`, () => {
  it(`should return true for exact domain match`, () => {
    expect(isDomainAllowed(`api.example.com`, [`api.example.com`])).toBe(true)
  })

  it(`should return false for non-matching domain`, () => {
    expect(isDomainAllowed(`api.other.com`, [`api.example.com`])).toBe(false)
  })

  it(`should match subdomains with wildcard pattern`, () => {
    expect(isDomainAllowed(`sub.example.com`, [`*.example.com`])).toBe(true)
  })

  it(`should match bare domain with wildcard pattern`, () => {
    expect(isDomainAllowed(`example.com`, [`*.example.com`])).toBe(true)
  })

  it(`should NOT match unrelated domain with wildcard pattern`, () => {
    expect(isDomainAllowed(`notexample.com`, [`*.example.com`])).toBe(false)
  })

  it(`should return false for empty allowedDomains array`, () => {
    expect(isDomainAllowed(`api.example.com`, [])).toBe(false)
  })

  it(`should return true if any domain in the list matches`, () => {
    expect(
      isDomainAllowed(`api.openai.com`, [
        `api.anthropic.com`,
        `api.openai.com`,
        `api.google.com`,
      ])
    ).toBe(true)
  })

  it(`should return false when no domain in the list matches`, () => {
    expect(
      isDomainAllowed(`api.stripe.com`, [`api.anthropic.com`, `api.openai.com`])
    ).toBe(false)
  })

  it(`should match deep subdomains with wildcard`, () => {
    expect(isDomainAllowed(`a.b.c.example.com`, [`*.example.com`])).toBe(true)
  })
})
