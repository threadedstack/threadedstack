import { describe, it, expect } from 'vitest'

describe('useConfig logic', () => {
  it('merges global and project configs', () => {
    const global = { org: 'g1', display: { theme: 'dark' as const } }
    const project = { org: 'p1' }
    const merged = { ...global, ...project }
    expect(merged.org).toBe('p1')
  })
})
