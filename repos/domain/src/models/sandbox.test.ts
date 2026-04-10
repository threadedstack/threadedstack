import { describe, it, expect } from 'vitest'
import { Sandbox } from './sandbox'
import { Provider } from './provider'

describe(`Sandbox model`, () => {
  describe(`constructor`, () => {
    it(`should create sandbox with full data`, () => {
      const sandbox = new Sandbox({
        id: `sandbox-1`,
        name: `Test Sandbox`,
        orgId: `org-1`,
        userId: `user-1`,
        projectId: `proj-1`,
        builtIn: true,
        config: { image: `tdsk-sandbox-claude`, runtime: `claude-code` } as any,
      })
      expect(sandbox.id).toBe(`sandbox-1`)
      expect(sandbox.name).toBe(`Test Sandbox`)
      expect(sandbox.orgId).toBe(`org-1`)
      expect(sandbox.userId).toBe(`user-1`)
      expect(sandbox.projectId).toBe(`proj-1`)
      expect(sandbox.builtIn).toBe(true)
      expect(sandbox.config).toEqual({
        image: `tdsk-sandbox-claude`,
        runtime: `claude-code`,
      })
    })

    it(`should default to empty providerLinks array`, () => {
      const sandbox = new Sandbox({
        name: `Test Sandbox`,
        orgId: `org-1`,
      })
      expect(sandbox.providerLinks).toEqual([])
      expect(sandbox.providers).toEqual([])
      expect(sandbox.primaryProvider).toBeUndefined()
    })

    it(`should wrap raw provider objects in Provider class`, () => {
      const sandbox = new Sandbox({
        name: `Test Sandbox`,
        orgId: `org-1`,
        providerLinks: [
          { provider: { id: `prov-1`, brand: `anthropic` } as any, priority: 0 },
          { provider: { id: `prov-2`, brand: `openai` } as any, priority: 1 },
        ],
      })
      expect(sandbox.providerLinks).toHaveLength(2)
      expect(sandbox.providerLinks[0]?.provider).toBeInstanceOf(Provider)
      expect(sandbox.providerLinks[0]?.provider.id).toBe(`prov-1`)
      expect(sandbox.providerLinks[1]?.provider).toBeInstanceOf(Provider)
      expect(sandbox.providerLinks[1]?.provider.id).toBe(`prov-2`)
    })

    it(`should preserve Provider instances as-is`, () => {
      const prov = new Provider({ id: `prov-1`, brand: `anthropic` } as any)
      const sandbox = new Sandbox({
        name: `Test Sandbox`,
        orgId: `org-1`,
        providerLinks: [{ provider: prov, priority: 0 }],
      })
      expect(sandbox.providerLinks[0]?.provider).toBe(prov)
      expect(sandbox.providerLinks[0]?.provider).toBeInstanceOf(Provider)
    })

    it(`should handle undefined providerLinks gracefully`, () => {
      const sandbox = new Sandbox({
        name: `Test Sandbox`,
        orgId: `org-1`,
        providerLinks: undefined,
      })
      expect(sandbox.providerLinks).toEqual([])
    })

    it(`should have correct defaults`, () => {
      const sandbox = new Sandbox({
        name: `Test`,
        orgId: `org-1`,
      })
      expect(sandbox.builtIn).toBe(false)
      expect(sandbox.providerLinks).toEqual([])
      expect(sandbox.userId).toBeUndefined()
      expect(sandbox.projectId).toBeUndefined()
    })
  })

  describe(`providers getter`, () => {
    it(`should derive providers from providerLinks`, () => {
      const prov1 = new Provider({ id: `prov-1`, brand: `anthropic` } as any)
      const prov2 = new Provider({ id: `prov-2`, brand: `openai` } as any)
      const sandbox = new Sandbox({
        name: `Test Sandbox`,
        orgId: `org-1`,
        providerLinks: [
          { provider: prov1, priority: 0 },
          { provider: prov2, priority: 1 },
        ],
      })
      expect(sandbox.providers).toHaveLength(2)
      expect(sandbox.providers[0]).toBe(prov1)
      expect(sandbox.providers[1]).toBe(prov2)
    })

    it(`should return primary provider (first in array)`, () => {
      const prov1 = new Provider({ id: `prov-1`, brand: `anthropic` } as any)
      const prov2 = new Provider({ id: `prov-2`, brand: `openai` } as any)
      const sandbox = new Sandbox({
        name: `Test Sandbox`,
        orgId: `org-1`,
        providerLinks: [
          { provider: prov1, priority: 0 },
          { provider: prov2, priority: 1 },
        ],
      })
      expect(sandbox.primaryProvider).toBe(prov1)
    })

    it(`should return undefined primaryProvider when no providers`, () => {
      const sandbox = new Sandbox({
        name: `Test Sandbox`,
        orgId: `org-1`,
      })
      expect(sandbox.primaryProvider).toBeUndefined()
    })
  })

  describe(`providerLinks`, () => {
    it(`should store priority metadata`, () => {
      const prov1 = new Provider({ id: `prov-1`, brand: `anthropic` } as any)
      const prov2 = new Provider({ id: `prov-2`, brand: `openai` } as any)
      const sandbox = new Sandbox({
        name: `Test Sandbox`,
        orgId: `org-1`,
        providerLinks: [
          { provider: prov1, priority: 0 },
          { provider: prov2, priority: 5 },
        ],
      })
      expect(sandbox.providerLinks).toHaveLength(2)
      expect(sandbox.providerLinks[0]?.provider).toBe(prov1)
      expect(sandbox.providerLinks[0]?.priority).toBe(0)
      expect(sandbox.providerLinks[1]?.provider).toBe(prov2)
      expect(sandbox.providerLinks[1]?.priority).toBe(5)
    })

    it(`should return empty array when no providers`, () => {
      const sandbox = new Sandbox({
        name: `Test Sandbox`,
        orgId: `org-1`,
      })
      expect(sandbox.providerLinks).toEqual([])
    })
  })
})
