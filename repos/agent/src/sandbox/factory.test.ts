import { describe, it, expect } from 'vitest'
import { createSandboxProvider } from './factory'
import { E2bSandboxProvider } from './e2b'
import { LocalSandboxProvider } from './local'

describe(`createSandboxProvider`, () => {
  it(`should create an E2bSandboxProvider for 'e2b'`, () => {
    const provider = createSandboxProvider(`e2b`)
    expect(provider).toBeInstanceOf(E2bSandboxProvider)
    expect(provider.type).toBe(`e2b`)
  })

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

  it(`should create new instances on each call`, () => {
    const p1 = createSandboxProvider(`e2b`)
    const p2 = createSandboxProvider(`e2b`)
    expect(p1).not.toBe(p2)
  })

  it(`should create new local instances on each call`, () => {
    const p1 = createSandboxProvider(`local`)
    const p2 = createSandboxProvider(`local`)
    expect(p1).not.toBe(p2)
  })

  it(`should return a provider that implements ISandboxProvider`, () => {
    const provider = createSandboxProvider(`e2b`)
    expect(provider).toHaveProperty(`type`)
    expect(provider).toHaveProperty(`create`)
    expect(typeof provider.create).toBe(`function`)
  })

  it(`should return a local provider that implements ISandboxProvider`, () => {
    const provider = createSandboxProvider(`local`)
    expect(provider).toHaveProperty(`type`)
    expect(provider).toHaveProperty(`create`)
    expect(typeof provider.create).toBe(`function`)
  })
})
