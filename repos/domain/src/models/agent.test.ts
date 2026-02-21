import { describe, it, expect } from 'vitest'
import { Agent } from './agent'
import { Provider } from './provider'

describe(`Agent model`, () => {
  describe(`constructor`, () => {
    it(`should create agent with full data`, () => {
      const agent = new Agent({
        id: `agent-1`,
        name: `Test Agent`,
        orgId: `org-1`,
        model: `gpt-4`,
        description: `A test agent`,
        active: true,
        tools: [`tool1`],
      })
      expect(agent.id).toBe(`agent-1`)
      expect(agent.name).toBe(`Test Agent`)
      expect(agent.orgId).toBe(`org-1`)
      expect(agent.active).toBe(true)
      expect(agent.tools).toEqual([`tool1`])
    })

    it(`should default to empty providers array`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
      })
      expect(agent.providers).toEqual([])
      expect(agent.primaryProvider).toBeUndefined()
    })

    it(`should wrap raw provider objects in Provider class`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providers: [
          { id: `prov-1`, type: `openai` } as any,
          { id: `prov-2`, type: `anthropic` } as any,
        ],
      })
      expect(agent.providers).toHaveLength(2)
      expect(agent.providers[0]).toBeInstanceOf(Provider)
      expect(agent.providers[0]?.id).toBe(`prov-1`)
      expect(agent.providers[1]).toBeInstanceOf(Provider)
      expect(agent.providers[1]?.id).toBe(`prov-2`)
    })

    it(`should preserve Provider instances as-is`, () => {
      const prov = new Provider({ id: `prov-1`, type: `openai` } as any)
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providers: [prov],
      })
      expect(agent.providers[0]).toBe(prov)
      expect(agent.providers[0]).toBeInstanceOf(Provider)
    })

    it(`should return primary provider (first in array)`, () => {
      const prov1 = new Provider({ id: `prov-1`, type: `openai` } as any)
      const prov2 = new Provider({ id: `prov-2`, type: `anthropic` } as any)
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providers: [prov1, prov2],
      })
      expect(agent.primaryProvider).toBe(prov1)
    })

    it(`should have correct defaults`, () => {
      const agent = new Agent({
        name: `Test`,
        orgId: `org-1`,
      })
      expect(agent.active).toBe(true)
      expect(agent.tools).toEqual([])
      expect(agent.secrets).toEqual([])
      expect(agent.projects).toEqual([])
      expect(agent.providers).toEqual([])
      expect(agent.providerPriorities).toEqual([])
      expect(agent.envVars).toEqual({})
      expect(agent.environment).toEqual({})
    })
  })

  describe(`providerPriorities`, () => {
    it(`should store providerPriorities alongside providers`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providers: [
          { id: `prov-1`, type: `openai` } as any,
          { id: `prov-2`, type: `anthropic` } as any,
        ],
        providerPriorities: [0, 1],
      })
      expect(agent.providerPriorities).toEqual([0, 1])
      expect(agent.providers).toHaveLength(2)
    })

    it(`should default providerPriorities to empty array`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
      })
      expect(agent.providerPriorities).toEqual([])
    })
  })

  describe(`agentProviders getter`, () => {
    it(`should return agentProviders with priority metadata`, () => {
      const prov1 = new Provider({ id: `prov-1`, type: `openai` } as any)
      const prov2 = new Provider({ id: `prov-2`, type: `anthropic` } as any)
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providers: [prov1, prov2],
        providerPriorities: [0, 1],
      })
      const result = agent.agentProviders
      expect(result).toHaveLength(2)
      expect(result[0]?.provider).toBe(prov1)
      expect(result[0]?.priority).toBe(0)
      expect(result[1]?.provider).toBe(prov2)
      expect(result[1]?.priority).toBe(1)
    })

    it(`should default priorities to index when providerPriorities not provided`, () => {
      const prov1 = new Provider({ id: `prov-1`, type: `openai` } as any)
      const prov2 = new Provider({ id: `prov-2`, type: `anthropic` } as any)
      const prov3 = new Provider({ id: `prov-3`, type: `google` } as any)
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providers: [prov1, prov2, prov3],
      })
      const result = agent.agentProviders
      expect(result).toHaveLength(3)
      expect(result[0]?.priority).toBe(0)
      expect(result[1]?.priority).toBe(1)
      expect(result[2]?.priority).toBe(2)
    })

    it(`should return empty array when no providers`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
      })
      expect(agent.agentProviders).toEqual([])
    })

    it(`should handle non-sequential priorities`, () => {
      const prov1 = new Provider({ id: `prov-1`, type: `openai` } as any)
      const prov2 = new Provider({ id: `prov-2`, type: `anthropic` } as any)
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providers: [prov1, prov2],
        providerPriorities: [0, 5],
      })
      const result = agent.agentProviders
      expect(result[0]?.priority).toBe(0)
      expect(result[1]?.priority).toBe(5)
    })
  })
})
