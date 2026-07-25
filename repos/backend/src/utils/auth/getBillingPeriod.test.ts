import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getBillingPeriod } from './getBillingPeriod'

describe(`getBillingPeriod`, () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it(`pads a single-digit month with a leading zero`, () => {
    vi.setSystemTime(new Date(`2026-01-15T00:00:00Z`))
    expect(getBillingPeriod()).toBe(`2026-01`)
  })

  it(`does not pad a double-digit month`, () => {
    vi.setSystemTime(new Date(`2026-11-15T00:00:00Z`))
    expect(getBillingPeriod()).toBe(`2026-11`)
  })

  it(`formats December with the correct year, no off-by-one rollover`, () => {
    vi.setSystemTime(new Date(`2026-12-31T00:00:00Z`))
    expect(getBillingPeriod()).toBe(`2026-12`)
  })
})
