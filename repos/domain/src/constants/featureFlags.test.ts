import { describe, it, expect } from 'vitest'
import { FeatureFlags, isFeatureEnabled } from './featureFlags'
import type { TFeatureFlagName } from '@TDM/types'

describe('FeatureFlags', () => {
  it('should define all expected flags', () => {
    expect(FeatureFlags).toHaveProperty('agents')
    expect(FeatureFlags).toHaveProperty('terminalGui')
    expect(FeatureFlags).toHaveProperty('schedules')
    expect(FeatureFlags).toHaveProperty('skills')
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
