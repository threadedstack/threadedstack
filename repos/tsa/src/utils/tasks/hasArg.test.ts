import { describe, it, expect } from 'vitest'
import { hasArg } from './hasArg'

describe(`hasArg`, () => {
  it(`returns true for an exact long-form match`, () => {
    expect(hasArg([`--version`], `version`, [])).toBe(true)
  })

  it(`returns true for a short alias match`, () => {
    expect(hasArg([`-v`], `version`, [`v`])).toBe(true)
  })

  it(`returns false when neither the long form nor any alias is present`, () => {
    expect(hasArg([`--other`], `version`, [`v`])).toBe(false)
  })

  it(`returns true when matching a non-first alias`, () => {
    expect(hasArg([`-x`], `version`, [`v`, `x`])).toBe(true)
  })
})
