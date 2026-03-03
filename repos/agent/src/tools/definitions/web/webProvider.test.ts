import { describe, it, expect } from 'vitest'
import { createWebProvider } from './webProvider'
import { JinaWebProvider } from './jinaWebProvider'

describe(`createWebProvider`, () => {
  it(`should return JinaWebProvider when no args are provided`, () => {
    const provider = createWebProvider()
    expect(provider).toBeInstanceOf(JinaWebProvider)
  })

  it(`should return JinaWebProvider when type is jina`, () => {
    const provider = createWebProvider({ type: `jina` })
    expect(provider).toBeInstanceOf(JinaWebProvider)
  })

  it(`should return JinaWebProvider when type is undefined`, () => {
    const provider = createWebProvider({})
    expect(provider).toBeInstanceOf(JinaWebProvider)
  })

  it(`should throw for unknown provider type`, () => {
    expect(() => createWebProvider({ type: `unknown-provider` as any })).toThrow(
      `Unknown web provider: unknown-provider`
    )
  })

  it(`should return provider with type discriminant`, () => {
    const provider = createWebProvider()
    expect(provider.type).toBe(`jina`)
  })
})
