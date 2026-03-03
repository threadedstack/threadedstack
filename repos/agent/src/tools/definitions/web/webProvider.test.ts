import type { TWebProviderConfig } from '@tdsk/domain'

import { describe, it, expect } from 'vitest'
import { createWebProvider } from './webProvider'
import { JinaWebProvider } from './jinaWebProvider'

describe(`createWebProvider`, () => {
  it(`should return JinaWebProvider when no config is provided`, () => {
    const provider = createWebProvider()
    expect(provider).toBeInstanceOf(JinaWebProvider)
  })

  it(`should return JinaWebProvider when config type is jina`, () => {
    const config: TWebProviderConfig = { type: `jina` }
    const provider = createWebProvider(config)
    expect(provider).toBeInstanceOf(JinaWebProvider)
  })

  it(`should return JinaWebProvider when config type is undefined`, () => {
    const config: TWebProviderConfig = { apiKey: `some-key` }
    const provider = createWebProvider(config)
    expect(provider).toBeInstanceOf(JinaWebProvider)
  })

  it(`should throw for unknown provider type`, () => {
    const config = { type: `unknown-provider` } as unknown as TWebProviderConfig
    expect(() => createWebProvider(config)).toThrow(
      `Unknown web provider: unknown-provider`
    )
  })

  it(`should return provider with type discriminant`, () => {
    const provider = createWebProvider()
    expect(provider.type).toBe(`jina`)
  })
})
