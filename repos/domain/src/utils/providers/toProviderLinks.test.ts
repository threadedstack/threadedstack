import { describe, it, expect } from 'vitest'
import { Provider } from '@TDM/models/provider'
import { toProviderLinks } from './toProviderLinks'

describe(`toProviderLinks`, () => {
  it(`should return empty array for undefined input`, () => {
    expect(toProviderLinks(undefined)).toEqual([])
  })

  it(`should return empty array for null input`, () => {
    expect(toProviderLinks(null as any)).toEqual([])
  })

  it(`should return empty array for empty array input`, () => {
    expect(toProviderLinks([])).toEqual([])
  })

  it(`should filter out links with no provider`, () => {
    const links = [
      { provider: undefined, priority: 0, model: null },
      { provider: null, priority: 1, model: null },
    ] as any

    const result = toProviderLinks(links)
    expect(result).toEqual([])
  })

  it(`should wrap plain objects in Provider instances`, () => {
    const links = [
      { provider: { id: `p1`, name: `Test` }, priority: 0, model: null },
    ] as any

    const result = toProviderLinks(links)
    expect(result).toHaveLength(1)
    expect(result[0].provider).toBeInstanceOf(Provider)
  })

  it(`should preserve existing Provider instances`, () => {
    const existing = new Provider({ id: `p1` })
    const links = [{ provider: existing, priority: 0, model: null, projectId: null }]

    const result = toProviderLinks(links)
    expect(result).toHaveLength(1)
    expect(result[0].provider).toBe(existing)
  })

  it(`should preserve priority and model fields`, () => {
    const links = [{ provider: { id: `p1` }, priority: 2, model: `claude-3` }] as any

    const result = toProviderLinks(links)
    expect(result).toHaveLength(1)
    expect(result[0].priority).toBe(2)
    expect(result[0].model).toBe(`claude-3`)
  })

  it(`should handle mixed Provider instances and plain objects`, () => {
    const existing = new Provider({ id: `p1` })
    const links = [
      { provider: existing, priority: 0, model: null },
      { provider: { id: `p2` }, priority: 1, model: null },
    ] as any

    const result = toProviderLinks(links)
    expect(result).toHaveLength(2)
    expect(result[0].provider).toBeInstanceOf(Provider)
    expect(result[1].provider).toBeInstanceOf(Provider)
  })
})
