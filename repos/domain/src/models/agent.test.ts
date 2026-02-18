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
      expect(agent.envVars).toEqual({})
      expect(agent.environment).toEqual({})
    })
  })
})
