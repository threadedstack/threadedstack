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
