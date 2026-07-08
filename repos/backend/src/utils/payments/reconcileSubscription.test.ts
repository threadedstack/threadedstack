import { describe, it, expect } from 'vitest'

import type { TPaySubscriptionState } from '@TBE/types'
import type { Subscription } from '@tdsk/domain'

import { reconcileSubscription } from './reconcileSubscription'

describe(`reconcileSubscription`, () => {
  const buildLocal = (overrides: Partial<Subscription> = {}) =>
    ({
      tier: `pro`,
      status: `active`,
      stripePriceId: `price_123`,
      cancelAtPeriodEnd: false,
      currentPeriodStart: `2026-01-01T00:00:00.000Z`,
      currentPeriodEnd: `2026-02-01T00:00:00.000Z`,
      ...overrides,
    }) as Subscription

  const buildRemote = (overrides: Partial<TPaySubscriptionState> = {}) =>
    ({
      tier: `pro`,
      status: `active`,
      stripePriceId: `price_123`,
      cancelAtPeriodEnd: false,
      currentPeriodStart: `2026-01-01T00:00:00.000Z`,
      currentPeriodEnd: `2026-02-01T00:00:00.000Z`,
      ...overrides,
    }) as TPaySubscriptionState

  it(`should return null when local and remote are fully in sync`, () => {
    expect(reconcileSubscription(buildLocal(), buildRemote())).toBeNull()
  })

  it(`should return a tier update when tiers differ`, () => {
    const result = reconcileSubscription(buildLocal(), buildRemote({ tier: `team` }))
    expect(result).toEqual({ tier: `team` })
  })

  it(`should return a status update when statuses differ`, () => {
    const result = reconcileSubscription(
      buildLocal(),
      buildRemote({ status: `past_due` })
    )
    expect(result).toEqual({ status: `past_due` })
  })

  it(`should return a stripePriceId update when price ids differ`, () => {
    const result = reconcileSubscription(
      buildLocal(),
      buildRemote({ stripePriceId: `price_456` })
    )
    expect(result).toEqual({ stripePriceId: `price_456` })
  })

  it(`should return a cancelAtPeriodEnd update when it flips true`, () => {
    const result = reconcileSubscription(
      buildLocal({ cancelAtPeriodEnd: false }),
      buildRemote({ cancelAtPeriodEnd: true })
    )
    expect(result).toEqual({ cancelAtPeriodEnd: true })
  })

  it(`should coerce an undefined local cancelAtPeriodEnd to false before comparing`, () => {
    const result = reconcileSubscription(
      buildLocal({ cancelAtPeriodEnd: undefined }),
      buildRemote({ cancelAtPeriodEnd: false })
    )
    expect(result).toBeNull()
  })

  it(`should return a currentPeriodStart update when timestamps differ`, () => {
    const result = reconcileSubscription(
      buildLocal(),
      buildRemote({ currentPeriodStart: `2026-01-15T00:00:00.000Z` })
    )
    expect(result).toEqual({ currentPeriodStart: `2026-01-15T00:00:00.000Z` })
  })

  it(`should return a currentPeriodEnd update when timestamps differ`, () => {
    const result = reconcileSubscription(
      buildLocal(),
      buildRemote({ currentPeriodEnd: `2026-02-15T00:00:00.000Z` })
    )
    expect(result).toEqual({ currentPeriodEnd: `2026-02-15T00:00:00.000Z` })
  })

  it(`should ignore a missing remote currentPeriodStart even if local has one`, () => {
    const result = reconcileSubscription(
      buildLocal({ currentPeriodStart: `2026-01-01T00:00:00.000Z` }),
      buildRemote({ currentPeriodStart: undefined })
    )
    expect(result).toBeNull()
  })

  it(`should ignore a missing remote currentPeriodEnd even if local has one`, () => {
    const result = reconcileSubscription(
      buildLocal({ currentPeriodEnd: `2026-02-01T00:00:00.000Z` }),
      buildRemote({ currentPeriodEnd: undefined })
    )
    expect(result).toBeNull()
  })

  it(`should treat an unset local timestamp as epoch 0 and update once remote has a value`, () => {
    const result = reconcileSubscription(
      buildLocal({ currentPeriodStart: undefined }),
      buildRemote({ currentPeriodStart: `2026-01-01T00:00:00.000Z` })
    )
    expect(result).toEqual({ currentPeriodStart: `2026-01-01T00:00:00.000Z` })
  })

  it(`should collect multiple independent drifts into a single update payload`, () => {
    const result = reconcileSubscription(
      buildLocal(),
      buildRemote({ tier: `team`, status: `canceled`, cancelAtPeriodEnd: true })
    )
    expect(result).toEqual({ tier: `team`, status: `canceled`, cancelAtPeriodEnd: true })
  })
})
