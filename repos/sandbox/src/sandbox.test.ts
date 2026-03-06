import { ESandboxType } from '@tdsk/domain'
import { describe, it, expect } from 'vitest'
import { LocalSandboxProvider } from './local'
import { createSandboxProvider } from './sandbox'

describe(`createSandboxProvider`, () => {
  it(`should create a LocalSandboxProvider for '${ESandboxType.local}'`, () => {
    const provider = createSandboxProvider(ESandboxType.local)
    expect(provider).toBeInstanceOf(LocalSandboxProvider)
    expect(provider.type).toBe(ESandboxType.local)
  })

  it(`should throw for unknown provider type`, () => {
    expect(() => createSandboxProvider(`docker` as any)).toThrow(
      `Unknown sandbox provider: docker`
    )
  })

  it(`should create new local instances on each call`, () => {
    const p1 = createSandboxProvider(ESandboxType.local)
    const p2 = createSandboxProvider(ESandboxType.local)
    expect(p1).not.toBe(p2)
  })

  it(`should return a local provider that implements ISandboxProvider`, () => {
    const provider = createSandboxProvider(ESandboxType.local)
    expect(provider).toHaveProperty(`type`)
    expect(provider).toHaveProperty(`create`)
    expect(typeof provider.create).toBe(`function`)
  })
})
