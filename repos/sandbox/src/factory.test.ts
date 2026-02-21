import { describe, it, expect } from 'vitest'
import { createSandboxProvider } from './factory'
import { LocalSandboxProvider } from './local'

describe(`createSandboxProvider`, () => {
  it(`should create a LocalSandboxProvider for 'local'`, () => {
    const provider = createSandboxProvider(`local`)
    expect(provider).toBeInstanceOf(LocalSandboxProvider)
    expect(provider.type).toBe(`local`)
  })

  it(`should throw for unknown provider type`, () => {
    expect(() => createSandboxProvider(`docker` as any)).toThrow(
      `Unknown sandbox provider: docker`
    )
  })

  it(`should create new local instances on each call`, () => {
    const p1 = createSandboxProvider(`local`)
    const p2 = createSandboxProvider(`local`)
    expect(p1).not.toBe(p2)
  })

  it(`should return a local provider that implements ISandboxProvider`, () => {
    const provider = createSandboxProvider(`local`)
    expect(provider).toHaveProperty(`type`)
    expect(provider).toHaveProperty(`create`)
    expect(typeof provider.create).toBe(`function`)
  })
})
