import { describe, it, expect } from 'vitest'
import { PlanLimits } from './plans'
import { ESubscriptionTier } from '@TDM/types'

describe(`PlanLimits`, () => {
  it(`should define all 4 subscription tiers`, () => {
    const tiers = Object.keys(PlanLimits)
    expect(tiers).toHaveLength(4)
    expect(tiers).toContain(ESubscriptionTier.free)
    expect(tiers).toContain(ESubscriptionTier.solo)
    expect(tiers).toContain(ESubscriptionTier.pro)
    expect(tiers).toContain(ESubscriptionTier.team)
  })

  it(`should have the strictest limits on the free tier`, () => {
    const free = PlanLimits[ESubscriptionTier.free]
    expect(free.projects).toBe(2)
    expect(free.compute).toBe(1_000)
    expect(free.threads).toBe(100)
    expect(free.messages).toBe(500)
    expect(free.endpoints).toBe(3)
    expect(free.secrets).toBe(5)
    expect(free.retention).toBe(7)
    expect(free.organizations).toBe(1)
    expect(free.seats).toBe(1)
    expect(free.additionalSeats).toBe(false)
  })

  it(`should not allow additional seats on the solo tier`, () => {
    const solo = PlanLimits[ESubscriptionTier.solo]
    expect(solo.additionalSeats).toBe(false)
    expect(solo.seats).toBe(1)
  })

  it(`should allow additional seats on the pro tier with 3 included`, () => {
    const pro = PlanLimits[ESubscriptionTier.pro]
    expect(pro.additionalSeats).toBe(true)
    expect(pro.seats).toBe(3)
  })

  it(`should have unlimited (-1) for most resources on the team tier with 10 seats`, () => {
    const team = PlanLimits[ESubscriptionTier.team]
    expect(team.organizations).toBe(-1)
    expect(team.projects).toBe(-1)
    expect(team.compute).toBe(-1)
    expect(team.threads).toBe(-1)
    expect(team.messages).toBe(-1)
    expect(team.endpoints).toBe(-1)
    expect(team.secrets).toBe(-1)
    expect(team.seats).toBe(10)
    expect(team.additionalSeats).toBe(true)
    expect(team.retention).toBe(365)
  })

  it(`should not contain negative values other than -1 for unlimited`, () => {
    for (const tier of Object.values(ESubscriptionTier)) {
      const limits = PlanLimits[tier]
      for (const [key, value] of Object.entries(limits)) {
        if (typeof value === 'number') {
          expect(
            value === -1 || value >= 0,
            `${tier}.${key} has invalid value ${value}`
          ).toBe(true)
        }
      }
    }
  })
})
