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

    it(`should default to empty providerLinks array`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
      })
      expect(agent.providerLinks).toEqual([])
      expect(agent.providers).toEqual([])
      expect(agent.primaryProvider).toBeUndefined()
    })

    it(`should wrap raw provider objects in Provider class`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providerLinks: [
          {
            provider: { id: `prov-1`, type: `openai` } as any,
            priority: 0,
            model: null,
          },
          {
            provider: { id: `prov-2`, type: `anthropic` } as any,
            priority: 1,
            model: null,
          },
        ],
      })
      expect(agent.providerLinks).toHaveLength(2)
      expect(agent.providerLinks[0]?.provider).toBeInstanceOf(Provider)
      expect(agent.providerLinks[0]?.provider.id).toBe(`prov-1`)
      expect(agent.providerLinks[1]?.provider).toBeInstanceOf(Provider)
      expect(agent.providerLinks[1]?.provider.id).toBe(`prov-2`)
    })

    it(`should preserve Provider instances as-is`, () => {
      const prov = new Provider({ id: `prov-1`, type: `openai` } as any)
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providerLinks: [{ provider: prov, priority: 0, model: null }],
      })
      expect(agent.providerLinks[0]?.provider).toBe(prov)
      expect(agent.providerLinks[0]?.provider).toBeInstanceOf(Provider)
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
      expect(agent.providerLinks).toEqual([])
      expect(agent.envVars).toEqual({})
      expect(agent.environment).toEqual({})
    })
  })

  describe(`providers getter`, () => {
    it(`should derive providers from providerLinks`, () => {
      const prov1 = new Provider({ id: `prov-1`, type: `openai` } as any)
      const prov2 = new Provider({ id: `prov-2`, type: `anthropic` } as any)
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providerLinks: [
          { provider: prov1, priority: 0, model: null },
          { provider: prov2, priority: 1, model: `gpt-4o` },
        ],
      })
      expect(agent.providers).toHaveLength(2)
      expect(agent.providers[0]).toBe(prov1)
      expect(agent.providers[1]).toBe(prov2)
    })

    it(`should return primary provider (first in array)`, () => {
      const prov1 = new Provider({ id: `prov-1`, type: `openai` } as any)
      const prov2 = new Provider({ id: `prov-2`, type: `anthropic` } as any)
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providerLinks: [
          { provider: prov1, priority: 0, model: null },
          { provider: prov2, priority: 1, model: null },
        ],
      })
      expect(agent.primaryProvider).toBe(prov1)
    })
  })

  describe(`providerLinks`, () => {
    it(`should store priority and model metadata`, () => {
      const prov1 = new Provider({ id: `prov-1`, type: `openai` } as any)
      const prov2 = new Provider({ id: `prov-2`, type: `anthropic` } as any)
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        providerLinks: [
          { provider: prov1, priority: 0, model: null },
          { provider: prov2, priority: 5, model: `claude-sonnet` },
        ],
      })
      expect(agent.providerLinks).toHaveLength(2)
      expect(agent.providerLinks[0]?.provider).toBe(prov1)
      expect(agent.providerLinks[0]?.priority).toBe(0)
      expect(agent.providerLinks[0]?.model).toBeNull()
      expect(agent.providerLinks[1]?.provider).toBe(prov2)
      expect(agent.providerLinks[1]?.priority).toBe(5)
      expect(agent.providerLinks[1]?.model).toBe(`claude-sonnet`)
    })

    it(`should return empty array when no providers`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
      })
      expect(agent.providerLinks).toEqual([])
    })
  })

  describe(`resolveModel`, () => {
    it(`should return per-provider model when set`, () => {
      const prov = new Provider({ id: `prov-1`, type: `openai` } as any)
      const agent = new Agent({
        name: `Test`,
        orgId: `org-1`,
        model: `agent-default`,
        providerLinks: [{ provider: prov, priority: 0, model: `per-provider-model` }],
      })
      expect(agent.resolveModel(`prov-1`, `provider-default`)).toBe(`per-provider-model`)
    })

    it(`should fall back to agent model when no per-provider model`, () => {
      const prov = new Provider({ id: `prov-1`, type: `openai` } as any)
      const agent = new Agent({
        name: `Test`,
        orgId: `org-1`,
        model: `agent-default`,
        providerLinks: [{ provider: prov, priority: 0, model: null }],
      })
      expect(agent.resolveModel(`prov-1`, `provider-default`)).toBe(`agent-default`)
    })

    it(`should fall back to provider default when no agent model`, () => {
      const prov = new Provider({ id: `prov-1`, type: `openai` } as any)
      const agent = new Agent({
        name: `Test`,
        orgId: `org-1`,
        providerLinks: [{ provider: prov, priority: 0, model: null }],
      })
      expect(agent.resolveModel(`prov-1`, `provider-default`)).toBe(`provider-default`)
    })

    it(`should return undefined when no model at any tier`, () => {
      const agent = new Agent({ name: `Test`, orgId: `org-1` })
      expect(agent.resolveModel(`prov-1`)).toBeUndefined()
    })
  })

  describe(`projectConfigs`, () => {
    it(`should default to empty array`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
      })
      expect(agent.projectConfigs).toEqual([])
    })

    it(`should store projectConfigs from constructor`, () => {
      const configs = [
        { agentId: `agent-1`, projectId: `proj-1`, model: `gpt-4o` },
        { agentId: `agent-1`, projectId: `proj-2`, model: `claude-3` },
      ]
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        projectConfigs: configs,
      })
      expect(agent.projectConfigs).toHaveLength(2)
      expect(agent.projectConfigs[0]?.projectId).toBe(`proj-1`)
      expect(agent.projectConfigs[1]?.projectId).toBe(`proj-2`)
    })

    it(`should handle undefined projectConfigs gracefully`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        projectConfigs: undefined,
      })
      expect(agent.projectConfigs).toEqual([])
    })
  })

  describe(`getProjectConfig`, () => {
    const configs = [
      { agentId: `agent-1`, projectId: `proj-1`, model: `gpt-4o`, maxTokens: 1000 },
      { agentId: `agent-1`, projectId: `proj-2`, model: `claude-3`, tools: [`search`] },
    ]

    it(`should return matching config by projectId`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        projectConfigs: configs,
      })
      const result = agent.getProjectConfig(`proj-1`)
      expect(result).toBeDefined()
      expect(result?.projectId).toBe(`proj-1`)
      expect(result?.model).toBe(`gpt-4o`)
      expect(result?.maxTokens).toBe(1000)
    })

    it(`should return undefined when no matching config`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
        projectConfigs: configs,
      })
      const result = agent.getProjectConfig(`proj-nonexistent`)
      expect(result).toBeUndefined()
    })

    it(`should return undefined when projectConfigs is empty`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
      })
      const result = agent.getProjectConfig(`proj-1`)
      expect(result).toBeUndefined()
    })
  })

  describe(`getEffectiveConfig`, () => {
    const baseAgent = () =>
      new Agent({
        id: `agent-1`,
        name: `Test Agent`,
        orgId: `org-1`,
        model: `gpt-4`,
        maxTokens: 2000,
        systemPrompt: `You are helpful`,
        tools: [`tool-a`, `tool-b`],
        envVars: { API_URL: `https://base.example.com`, SHARED_KEY: `base-value` },
        environment: { temperature: 0.5, streaming: true },
        providerLinks: [
          {
            provider: { id: `prov-1`, type: `openai` } as any,
            priority: 0,
            model: null,
          },
        ],
        projectConfigs: [
          {
            agentId: `agent-1`,
            projectId: `proj-1`,
            model: `claude-3-opus`,
            maxTokens: 4000,
            systemPrompt: `You are a project assistant`,
            tools: [`tool-c`],
            envVars: { SHARED_KEY: `project-value`, PROJECT_VAR: `proj-only` },
            environment: { temperature: 1, streaming: false },
          },
          {
            agentId: `agent-1`,
            projectId: `proj-2`,
            model: null,
            maxTokens: null,
            systemPrompt: null,
            tools: null,
            envVars: null,
            environment: null,
          },
        ],
      })

    it(`should return self when no projectId provided`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig()
      expect(result).toBe(agent)
    })

    it(`should return self when projectId has no matching config`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-unknown`)
      expect(result).toBe(agent)
    })

    it(`should override model when config has non-null model`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-1`)
      expect(result.model).toBe(`claude-3-opus`)
    })

    it(`should keep base model when config model is null`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-2`)
      expect(result.model).toBe(`gpt-4`)
    })

    it(`should override maxTokens, systemPrompt, tools`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-1`)
      expect(result.maxTokens).toBe(4000)
      expect(result.systemPrompt).toBe(`You are a project assistant`)
      expect(result.tools).toEqual([`tool-c`])
    })

    it(`should deep merge envVars (project keys win)`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-1`)
      expect(result.envVars).toEqual({
        API_URL: `https://base.example.com`,
        SHARED_KEY: `project-value`,
        PROJECT_VAR: `proj-only`,
      })
    })

    it(`should deep merge environment (project keys win)`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-1`)
      expect(result.environment).toEqual({
        temperature: 1,
        streaming: false,
      })
    })

    it(`should preserve projectConfigs on effective config`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-1`)
      expect(result.projectConfigs).toEqual(agent.projectConfigs)
      expect(result.projectConfigs).toHaveLength(2)
    })

    it(`should preserve providerLinks on effective config`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-1`)
      expect(result.providerLinks).toHaveLength(1)
      expect(result.providerLinks[0]?.provider.id).toBe(`prov-1`)
    })

    it(`should return a new Agent instance (not mutate original)`, () => {
      const agent = baseAgent()
      const result = agent.getEffectiveConfig(`proj-1`)
      expect(result).not.toBe(agent)
      expect(result).toBeInstanceOf(Agent)
      expect(agent.model).toBe(`gpt-4`)
      expect(agent.maxTokens).toBe(2000)
      expect(agent.systemPrompt).toBe(`You are helpful`)
      expect(agent.tools).toEqual([`tool-a`, `tool-b`])
      expect(agent.envVars).toEqual({
        API_URL: `https://base.example.com`,
        SHARED_KEY: `base-value`,
      })
    })
  })

  describe(`soul and autonomous`, () => {
    it(`carries soul and autonomous through the constructor`, () => {
      const agent = new Agent({
        name: `Steward`,
        orgId: `org-1`,
        soul: `I am the ThreadedStack steward.`,
        autonomous: true,
      })
      expect(agent.soul).toBe(`I am the ThreadedStack steward.`)
      expect(agent.autonomous).toBe(true)
    })

    it(`defaults autonomous to false and soul to undefined`, () => {
      const agent = new Agent({ name: `Plain`, orgId: `org-1` })
      expect(agent.autonomous).toBe(false)
      expect(agent.soul).toBeUndefined()
    })

    it(`preserves soul and autonomous through getEffectiveConfig`, () => {
      const agent = new Agent({
        name: `Steward`,
        orgId: `org-1`,
        soul: `base soul`,
        autonomous: true,
      })
      const eff = agent.getEffectiveConfig()
      expect(eff.soul).toBe(`base soul`)
      expect(eff.autonomous).toBe(true)
    })
  })

  describe(`removed fields`, () => {
    it(`should NOT have a functions property`, () => {
      const agent = new Agent({
        name: `Test Agent`,
        orgId: `org-1`,
      })
      expect(`functions` in agent).toBe(false)
      expect((agent as any).functions).toBeUndefined()
    })
  })
})
