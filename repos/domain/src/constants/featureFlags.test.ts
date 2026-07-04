import { describe, it, expect } from 'vitest'
import { FeatureFlags, isFeatureEnabled } from './featureFlags'
import type { TFeatureFlagName } from '@TDM/types'

describe('FeatureFlags', () => {
  it('should define all expected flags', () => {
    expect(FeatureFlags).toHaveProperty('agents')
    expect(FeatureFlags).toHaveProperty('terminalGui')
    expect(FeatureFlags).toHaveProperty('schedules')
    expect(FeatureFlags).toHaveProperty('skills')
    expect(FeatureFlags).toHaveProperty('memories')
    expect(FeatureFlags).toHaveProperty('delegation')
  })

  it(`has the delegation feature enabled`, () => {
    expect(FeatureFlags.delegation.enabled).toBe(true)
    expect(isFeatureEnabled(`delegation`)).toBe(true)
  })

  it(`has the memories feature enabled`, () => {
    expect(FeatureFlags.memories.enabled).toBe(true)
    expect(isFeatureEnabled(`memories`)).toBe(true)
  })

  it(`has the agents feature enabled`, () => {
    expect(FeatureFlags.agents.enabled).toBe(true)
    expect(isFeatureEnabled(`agents`)).toBe(true)
  })

  it('each flag should have enabled and description', () => {
    for (const [name, def] of Object.entries(FeatureFlags)) {
      expect(typeof def.enabled).toBe('boolean')
      expect(typeof def.description).toBe('string')
      expect(def.description.length).toBeGreaterThan(0)
    }
  })
})

describe('isFeatureEnabled', () => {
  it('should return the enabled value for a flag', () => {
    for (const [name, def] of Object.entries(FeatureFlags)) {
      expect(isFeatureEnabled(name as TFeatureFlagName)).toBe(def.enabled)
    }
  })
})
