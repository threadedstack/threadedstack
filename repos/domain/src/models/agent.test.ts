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
        providerId: `prov-1`,
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

    it(`should keep undefined provider as undefined`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providerId: `prov-1`,
      })
      expect(agent.provider).toBeUndefined()
    })

    it(`should wrap raw provider object in Provider class`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providerId: `prov-1`,
        provider: { id: `prov-1`, type: `openai` } as any,
      })
      expect(agent.provider).toBeInstanceOf(Provider)
      expect(agent.provider?.id).toBe(`prov-1`)
    })

    it(`should preserve Provider instance as-is`, () => {
      const prov = new Provider({ id: `prov-1`, type: `openai` } as any)
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providerId: `prov-1`,
        provider: prov,
      })
      expect(agent.provider).toBe(prov)
      expect(agent.provider).toBeInstanceOf(Provider)
    })

    it(`should have correct defaults`, () => {
      const agent = new Agent({
        name: `Test`,
        orgId: `org-1`,
        providerId: `prov-1`,
      })
      expect(agent.active).toBe(true)
      expect(agent.tools).toEqual([])
      expect(agent.secrets).toEqual([])
      expect(agent.projects).toEqual([])
      expect(agent.envVars).toEqual({})
      expect(agent.environment).toEqual({})
    })
  })
})
