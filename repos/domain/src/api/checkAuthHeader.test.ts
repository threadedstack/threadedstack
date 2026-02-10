import { describe, it, expect } from 'vitest'
import { checkAuthHeader } from './checkAuthHeader'

describe(`checkAuthHeader`, () => {
  it(`should return access_token for "Bearer xyz123"`, () => {
    const result = checkAuthHeader(`Bearer xyz123`)
    expect(result.access_token).toBe(`xyz123`)
  })

  it(`should return access_token for "bearer xyz123" (lowercase)`, () => {
    const result = checkAuthHeader(`bearer xyz123`)
    expect(result.access_token).toBe(`xyz123`)
  })

  it(`should return access_token for "BEARER xyz123" (uppercase)`, () => {
    const result = checkAuthHeader(`BEARER xyz123`)
    expect(result.access_token).toBe(`xyz123`)
  })

  it(`should return undefined for missing header`, () => {
    const result = checkAuthHeader(undefined)
    expect(result.access_token).toBeUndefined()
  })

  it(`should return undefined for empty header`, () => {
    const result = checkAuthHeader(``)
    expect(result.access_token).toBeUndefined()
  })

  it(`should return undefined for "Basic abc123" (wrong scheme)`, () => {
    const result = checkAuthHeader(`Basic abc123`)
    expect(result.access_token).toBeUndefined()
  })

  it(`should return full token for "Bearer token.with.dots"`, () => {
    const result = checkAuthHeader(`Bearer token.with.dots`)
    expect(result.access_token).toBe(`token.with.dots`)
  })
})
