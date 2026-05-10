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
        projects: [{ id: `proj-1`, name: `Project 1`, orgId: `org-1` } as any],
        builtIn: true,
        config: { image: `tdsk-sandbox-claude`, runtime: `claude-code` } as any,
      })
      expect(sandbox.id).toBe(`sandbox-1`)
      expect(sandbox.name).toBe(`Test Sandbox`)
      expect(sandbox.orgId).toBe(`org-1`)
      expect(sandbox.userId).toBe(`user-1`)
      expect(sandbox.projects).toHaveLength(1)
      expect(sandbox.projects[0]?.id).toBe(`proj-1`)
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
          {
            provider: { id: `prov-1`, brand: `anthropic` } as any,
            priority: 0,
          },
          {
            provider: { id: `prov-2`, brand: `openai` } as any,
            priority: 1,
          },
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
      expect(sandbox.projects).toEqual([])
      expect(sandbox.projectConfigs).toEqual([])
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

  describe(`getEffectiveConfig`, () => {
    const baseSandbox = () =>
      new Sandbox({
        id: `sandbox-1`,
        name: `Base Sandbox`,
        orgId: `org-1`,
        userId: `user-1`,
        config: {
          image: `tdsk-sandbox-claude`,
          runtime: `claude-code`,
          envVars: { NODE_ENV: `production`, LOG_LEVEL: `info` },
          resources: {
            limits: { cpu: `1000m`, memory: `2Gi` },
            requests: { cpu: `500m`, memory: `1Gi` },
          },
          ports: { ssh: 22, http: 8080 },
          sync: { enabled: true, ignore: [`node_modules`] },
        } as any,
        projects: [{ id: `proj-1`, name: `Project 1`, orgId: `org-1` } as any],
        projectConfigs: [],
        providerLinks: [
          {
            provider: { id: `prov-1`, brand: `anthropic` } as any,
            priority: 0,
          },
        ],
      })

    it(`should return self when no projectId is provided`, () => {
      const sandbox = baseSandbox()
      const result = sandbox.getEffectiveConfig()
      expect(result).toBe(sandbox)
    })

    it(`should return self when projectId has no matching config`, () => {
      const sandbox = baseSandbox()
      const result = sandbox.getEffectiveConfig(`unknown-project`)
      expect(result).toBe(sandbox)
    })

    it(`should merge envVars from project config with override winning on conflict`, () => {
      const sandbox = baseSandbox()
      sandbox.projectConfigs = [
        {
          sandboxId: `sandbox-1`,
          projectId: `proj-1`,
          alias: `test-sandbox`,
          config: {
            envVars: { LOG_LEVEL: `debug`, NEW_VAR: `added` },
          } as any,
        },
      ]
      const result = sandbox.getEffectiveConfig(`proj-1`)
      expect(result.config.envVars).toEqual({
        NODE_ENV: `production`,
        LOG_LEVEL: `debug`,
        NEW_VAR: `added`,
      })
    })

    it(`should merge resources limits and requests from project config`, () => {
      const sandbox = baseSandbox()
      sandbox.projectConfigs = [
        {
          sandboxId: `sandbox-1`,
          projectId: `proj-1`,
          alias: `test-sandbox`,
          config: {
            resources: {
              limits: { memory: `4Gi` },
              requests: { cpu: `250m`, gpu: `1` },
            },
          } as any,
        },
      ]
      const result = sandbox.getEffectiveConfig(`proj-1`)
      expect(result.config.resources).toEqual({
        limits: { cpu: `1000m`, memory: `4Gi` },
        requests: { cpu: `250m`, memory: `1Gi`, gpu: `1` },
      })
    })

    it(`should merge ports from project config`, () => {
      const sandbox = baseSandbox()
      sandbox.projectConfigs = [
        {
          sandboxId: `sandbox-1`,
          projectId: `proj-1`,
          alias: `test-sandbox`,
          config: {
            ports: { debug: 9229 },
          } as any,
        },
      ]
      const result = sandbox.getEffectiveConfig(`proj-1`)
      expect(result.config.ports).toEqual({ ssh: 22, http: 8080, debug: 9229 })
    })

    it(`should merge sync config from project config`, () => {
      const sandbox = baseSandbox()
      sandbox.projectConfigs = [
        {
          sandboxId: `sandbox-1`,
          projectId: `proj-1`,
          alias: `test-sandbox`,
          config: {
            sync: { bidirectional: true },
          } as any,
        },
      ]
      const result = sandbox.getEffectiveConfig(`proj-1`)
      expect(result.config.sync).toEqual({
        enabled: true,
        ignore: [`node_modules`],
        bidirectional: true,
      })
    })

    it(`should apply alias override as name`, () => {
      const sandbox = baseSandbox()
      sandbox.projectConfigs = [
        {
          sandboxId: `sandbox-1`,
          projectId: `proj-1`,
          alias: `Custom Name`,
          config: null,
        },
      ]
      const result = sandbox.getEffectiveConfig(`proj-1`)
      expect(result.name).toBe(`Custom Name`)
    })

    it(`should not mutate the original sandbox`, () => {
      const sandbox = baseSandbox()
      sandbox.projectConfigs = [
        {
          sandboxId: `sandbox-1`,
          projectId: `proj-1`,
          alias: `Override Name`,
          config: {
            envVars: { EXTRA: `val` },
            resources: { limits: { memory: `8Gi` } },
          } as any,
        },
      ]
      const originalName = sandbox.name
      const originalEnvVars = { ...sandbox.config.envVars }
      const originalLimits = { ...sandbox.config.resources?.limits }

      sandbox.getEffectiveConfig(`proj-1`)

      expect(sandbox.name).toBe(originalName)
      expect(sandbox.config.envVars).toEqual(originalEnvVars)
      expect(sandbox.config.resources?.limits).toEqual(originalLimits)
    })

    it(`should return a new Sandbox instance`, () => {
      const sandbox = baseSandbox()
      sandbox.projectConfigs = [
        {
          sandboxId: `sandbox-1`,
          projectId: `proj-1`,
          alias: `test-sandbox`,
          config: { envVars: { X: `1` } } as any,
        },
      ]
      const result = sandbox.getEffectiveConfig(`proj-1`)
      expect(result).not.toBe(sandbox)
      expect(result).toBeInstanceOf(Sandbox)
    })

    it(`should preserve original config when project config has null config`, () => {
      const sandbox = baseSandbox()
      sandbox.projectConfigs = [
        {
          sandboxId: `sandbox-1`,
          projectId: `proj-1`,
          alias: `Aliased`,
          config: null,
        },
      ]
      const result = sandbox.getEffectiveConfig(`proj-1`)
      expect(result.name).toBe(`Aliased`)
      expect(result.config).toEqual(sandbox.config)
    })
  })
})
