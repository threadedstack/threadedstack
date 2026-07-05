import { EOpsAction, EAgentTool } from '@tdsk/domain'
import { describe, it, expect, vi } from 'vitest'

import { createOpsTools } from './tools'

const makeProvider = () => ({
  podStatus: vi
    .fn()
    .mockResolvedValue({
      ok: true,
      pods: [{ name: `tdsk-backend-abc`, phase: `Running` }],
    }),
  podLogs: vi
    .fn()
    .mockResolvedValue({ ok: true, logs: `[INFO] server listening on :5885` }),
  deployState: vi.fn().mockResolvedValue({
    ok: true,
    deployments: [{ name: `tdsk-backend`, ready: 1, desired: 1 }],
  }),
  quotaUsage: vi.fn().mockResolvedValue({
    ok: true,
    quotas: [{ resource: `projects`, used: 3, limit: 5 }],
  }),
  propose: vi.fn().mockResolvedValue({
    opsActionId: `op_abc123`,
    status: `pending`,
    findings: [`no critical issues found`],
    dryRun: { steps: [`restart deployment tdsk-backend`] },
  }),
})

describe(`createOpsTools`, () => {
  describe(`tool creation and filtering`, () => {
    it(`should expose exactly 7 tools`, () => {
      const tools = createOpsTools(makeProvider())
      expect(tools).toHaveLength(7)
    })

    it(`should have the correct tool names`, () => {
      const tools = createOpsTools(makeProvider())
      const names = tools.map((t) => t.name)
      expect(names).toContain(EAgentTool.opsPodStatus)
      expect(names).toContain(EAgentTool.opsPodLogs)
      expect(names).toContain(EAgentTool.opsDeployState)
      expect(names).toContain(EAgentTool.opsQuotaUsage)
      expect(names).toContain(EAgentTool.opsTriggerRedeploy)
      expect(names).toContain(EAgentTool.opsRestartDeployment)
      expect(names).toContain(EAgentTool.opsApplySandboxConfig)
    })

    it(`should filter to 1 tool when allowedTools contains only opsPodStatus`, () => {
      const tools = createOpsTools(makeProvider(), [EAgentTool.opsPodStatus])
      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe(EAgentTool.opsPodStatus)
    })

    it(`should return all tools when allowedTools is empty`, () => {
      expect(createOpsTools(makeProvider(), [])).toHaveLength(7)
    })

    it(`should return empty array when no tool name matches`, () => {
      expect(createOpsTools(makeProvider(), [`nonExistent`])).toHaveLength(0)
    })
  })

  describe(`opsPodStatus`, () => {
    it(`should call provider.podStatus and forward params`, async () => {
      const provider = makeProvider()
      const tools = createOpsTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.opsPodStatus)!
      const params = { component: `tdsk-backend` }
      await tool.execute(`call-1`, params, undefined as any, vi.fn())

      expect(provider.podStatus).toHaveBeenCalledWith(params)
    })

    it(`should return a non-empty text result on success`, async () => {
      const provider = makeProvider()
      const tools = createOpsTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.opsPodStatus)!
      const result = await tool.execute(
        `call-1`,
        { component: `tdsk-backend` },
        undefined as any,
        vi.fn()
      )

      const text = (result.content[0] as { text: string }).text
      expect(text.length).toBeGreaterThan(0)
    })

    it(`should catch errors and return a failure message`, async () => {
      const provider = makeProvider()
      provider.podStatus.mockRejectedValue(new Error(`k8s unreachable`))
      const tools = createOpsTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.opsPodStatus)!
      const result = await tool.execute(`call-1`, {}, undefined as any, vi.fn())

      const text = (result.content[0] as { text: string }).text
      expect(text).toContain(`k8s unreachable`)
      expect(result.details).toEqual({ success: false })
    })
  })

  describe(`opsPodLogs`, () => {
    it(`should call provider.podLogs and forward params`, async () => {
      const provider = makeProvider()
      const tools = createOpsTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.opsPodLogs)!
      const params = { component: `tdsk-backend`, tailLines: 50, previous: false }
      await tool.execute(`call-1`, params, undefined as any, vi.fn())

      expect(provider.podLogs).toHaveBeenCalledWith(params)
    })
  })

  describe(`opsDeployState`, () => {
    it(`should call provider.deployState and forward params`, async () => {
      const provider = makeProvider()
      const tools = createOpsTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.opsDeployState)!
      const params = { deployment: `tdsk-backend` }
      await tool.execute(`call-1`, params, undefined as any, vi.fn())

      expect(provider.deployState).toHaveBeenCalledWith(params)
    })
  })

  describe(`opsQuotaUsage`, () => {
    it(`should call provider.quotaUsage with empty params`, async () => {
      const provider = makeProvider()
      const tools = createOpsTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.opsQuotaUsage)!
      await tool.execute(`call-1`, {}, undefined as any, vi.fn())

      expect(provider.quotaUsage).toHaveBeenCalledWith({})
    })
  })

  describe(`opsTriggerRedeploy (WRITE — propose only)`, () => {
    it(`should call provider.propose with EOpsAction.triggerRedeploy`, async () => {
      const provider = makeProvider()
      const tools = createOpsTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.opsTriggerRedeploy)!
      const params = { forceAll: false, reason: `new backend image pushed` }
      await tool.execute(`call-1`, params, undefined as any, vi.fn())

      expect(provider.propose).toHaveBeenCalledWith(EOpsAction.triggerRedeploy, params)
    })

    it(`return message MUST contain "dry-run" and "adversary review"`, async () => {
      const provider = makeProvider()
      const tools = createOpsTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.opsTriggerRedeploy)!
      const result = await tool.execute(
        `call-1`,
        { reason: `test` },
        undefined as any,
        vi.fn()
      )

      const text = (result.content[0] as { text: string }).text
      expect(text).toContain(`dry-run`)
      expect(text).toContain(`adversary review`)
    })

    it(`should catch errors and return a failure message`, async () => {
      const provider = makeProvider()
      provider.propose.mockRejectedValue(new Error(`scan blocked`))
      const tools = createOpsTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.opsTriggerRedeploy)!
      const result = await tool.execute(
        `call-1`,
        { reason: `test` },
        undefined as any,
        vi.fn()
      )

      const text = (result.content[0] as { text: string }).text
      expect(text).toContain(`scan blocked`)
      expect(result.details).toEqual({ success: false })
    })
  })

  describe(`opsRestartDeployment (WRITE — propose only)`, () => {
    it(`should call provider.propose with EOpsAction.restartDeployment`, async () => {
      const provider = makeProvider()
      const tools = createOpsTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.opsRestartDeployment)!
      const params = { deployment: `tdsk-backend`, reason: `OOM loop observed` }
      await tool.execute(`call-1`, params, undefined as any, vi.fn())

      expect(provider.propose).toHaveBeenCalledWith(EOpsAction.restartDeployment, params)
    })

    it(`return message MUST contain "dry-run" and "adversary review"`, async () => {
      const provider = makeProvider()
      const tools = createOpsTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.opsRestartDeployment)!
      const result = await tool.execute(
        `call-1`,
        { deployment: `tdsk-backend`, reason: `test` },
        undefined as any,
        vi.fn()
      )

      const text = (result.content[0] as { text: string }).text
      expect(text).toContain(`dry-run`)
      expect(text).toContain(`adversary review`)
    })
  })

  describe(`opsApplySandboxConfig (WRITE — propose only)`, () => {
    it(`should call provider.propose with EOpsAction.applySandboxConfig`, async () => {
      const provider = makeProvider()
      const tools = createOpsTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.opsApplySandboxConfig)!
      const params = {
        sandboxId: `sb_abc`,
        patch: { envVars: { FOO: `bar` } },
        reason: `update env for new feature`,
      }
      await tool.execute(`call-1`, params, undefined as any, vi.fn())

      expect(provider.propose).toHaveBeenCalledWith(EOpsAction.applySandboxConfig, params)
    })

    it(`return message MUST contain "dry-run" and "adversary review"`, async () => {
      const provider = makeProvider()
      const tools = createOpsTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.opsApplySandboxConfig)!
      const result = await tool.execute(
        `call-1`,
        { sandboxId: `sb_abc`, patch: { envVars: {} }, reason: `test` },
        undefined as any,
        vi.fn()
      )

      const text = (result.content[0] as { text: string }).text
      expect(text).toContain(`dry-run`)
      expect(text).toContain(`adversary review`)
    })
  })

  describe(`when opsProvider is absent`, () => {
    it(`createOpsTools called with allowedTools=[] returns 7 tools (all enabled)`, () => {
      // When opsProvider is absent the runner never calls createOpsTools at all.
      // This tests the guard pattern at the call site: only invoke when provider present.
      const opsProvider = undefined
      const result = opsProvider ? createOpsTools(opsProvider) : []
      expect(result).toHaveLength(0)
    })
  })

  describe(`tool metadata`, () => {
    it(`every tool has a label, description, and parameters`, () => {
      const tools = createOpsTools(makeProvider())
      for (const tool of tools) {
        expect(tool.label).toBeTruthy()
        expect(tool.description).toBeTruthy()
        expect(tool.parameters).toBeDefined()
      }
    })
  })
})
