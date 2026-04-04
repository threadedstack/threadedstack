import { describe, it, expect } from 'vitest'
import { computeUnits } from './computeUnits'

describe(`computeUnits`, () => {
  it(`should return function calls + runtime chunks`, () => {
    // 1 function call + 15 seconds (2 chunks of 10s) = 3
    expect(computeUnits(1, 15_000)).toBe(3)
  })

  it(`should round up partial runtime chunks`, () => {
    // 0 calls + 1ms runtime = 1 chunk
    expect(computeUnits(0, 1)).toBe(1)
  })

  it(`should handle exact 10s boundaries`, () => {
    // 2 calls + exactly 10s = 1 chunk → 3
    expect(computeUnits(2, 10_000)).toBe(3)
  })

  it(`should handle zero runtime`, () => {
    // 5 calls + 0ms runtime = 0 chunks → 5
    expect(computeUnits(5, 0)).toBe(5)
  })

  it(`should handle zero function calls`, () => {
    // 0 calls + 30s runtime = 3 chunks → 3
    expect(computeUnits(0, 30_000)).toBe(3)
  })

  it(`should handle both zeros`, () => {
    expect(computeUnits(0, 0)).toBe(0)
  })
})
