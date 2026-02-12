import { describe, it, expect, vi } from 'vitest'

vi.mock(`e2b`, () => ({
  Sandbox: { create: vi.fn() },
}))

import { createSandboxProvider } from '@TAG/sandbox/factory'
import { E2bSandboxProvider } from '@TAG/sandbox/e2b'

describe(`createSandboxProvider`, () => {
  it(`should return an E2bSandboxProvider for 'e2b'`, () => {
    const provider = createSandboxProvider(`e2b`)
    expect(provider).toBeInstanceOf(E2bSandboxProvider)
    expect(provider.type).toBe(`e2b`)
  })

  it(`should throw for unknown provider type`, () => {
    expect(() => createSandboxProvider(`unknown` as any)).toThrow(
      `Unknown sandbox provider: unknown`
    )
  })

  it(`should return a provider with a create method`, () => {
    const provider = createSandboxProvider(`e2b`)
    expect(typeof provider.create).toBe(`function`)
  })
})
