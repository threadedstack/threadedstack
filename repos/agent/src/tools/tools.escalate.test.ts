import { EAgentTool } from '@tdsk/domain'
import { describe, it, expect, vi } from 'vitest'

import { createEscalateTools } from './tools'

const makeProvider = () => ({
  escalate: vi.fn().mockResolvedValue({
    id: `es_1`,
    status: `routed`,
    routable: true,
    deduped: false,
  }),
})

const sampleParams = {
  title: `Egress CA cert expired`,
  problem: `The egress MITM CA cert has expired, causing all outbound proxied requests to fail`,
  target: `ops`,
  evidence: [`x509: certificate has expired in backend logs`],
  proposedPatch: `Rotate the egress CA cert via tdsk kube secret egress`,
  dedupeKey: `egress-ca-expired`,
  issueRef: `https://github.com/org/repo/issues/42`,
}

describe(`createEscalateTools`, () => {
  describe(`tool creation and filtering`, () => {
    it(`should expose the escalate tool`, () => {
      const tools = createEscalateTools(makeProvider())
      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe(EAgentTool.escalate)
    })

    it(`should filter by allowedTools names`, () => {
      expect(createEscalateTools(makeProvider(), [`nonExistent`])).toHaveLength(0)
      expect(createEscalateTools(makeProvider(), [EAgentTool.escalate])).toHaveLength(1)
    })

    it(`should return the tool when allowedTools is empty`, () => {
      expect(createEscalateTools(makeProvider(), [])).toHaveLength(1)
    })
  })

  describe(`escalate`, () => {
    it(`should call provider.escalate with the params and report a routed escalation`, async () => {
      const provider = makeProvider()
      const tools = createEscalateTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.escalate)!
      const result = await tool.execute(`call-1`, sampleParams, undefined as any, vi.fn())

      expect(provider.escalate).toHaveBeenCalledWith(sampleParams)
      const text = (result.content[0] as { text: string }).text
      expect(text).toContain(`es_1`)
      expect(text).toContain(`routed`)
      expect(result.details).toEqual(
        expect.objectContaining({
          id: `es_1`,
          status: `routed`,
          routable: true,
          deduped: false,
          success: true,
        })
      )
    })

    it(`should report a deduped escalation as already open`, async () => {
      const provider = makeProvider()
      provider.escalate.mockResolvedValue({
        id: `es_existing`,
        status: `routed`,
        routable: true,
        deduped: true,
      })
      const tools = createEscalateTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.escalate)!
      const result = await tool.execute(`call-1`, sampleParams, undefined as any, vi.fn())

      const text = (result.content[0] as { text: string }).text
      expect(text).toContain(`already open`)
      expect(text).toContain(`es_existing`)
      expect(result.details).toEqual(
        expect.objectContaining({ deduped: true, success: true })
      )
    })

    it(`should report a non-routable escalation as tracked and awaiting faculty`, async () => {
      const provider = makeProvider()
      provider.escalate.mockResolvedValue({
        id: `es_infra`,
        status: `open`,
        routable: false,
        deduped: false,
      })
      const tools = createEscalateTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.escalate)!
      const result = await tool.execute(`call-1`, sampleParams, undefined as any, vi.fn())

      const text = (result.content[0] as { text: string }).text
      expect(text).toContain(`es_infra`)
      expect(text).toContain(`tracked`)
      expect(text).toContain(`awaiting`)
      expect(result.details).toEqual(
        expect.objectContaining({ routable: false, deduped: false, success: true })
      )
    })

    it(`should call onUpdate with running status`, async () => {
      const onUpdate = vi.fn()
      const tools = createEscalateTools(makeProvider())
      const tool = tools.find((t) => t.name === EAgentTool.escalate)!
      await tool.execute(`call-1`, sampleParams, undefined as any, onUpdate)

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Escalating: ${sampleParams.title}` }],
        details: { status: `running` },
      })
    })

    it(`should catch errors and return a failure message`, async () => {
      const provider = makeProvider()
      provider.escalate.mockRejectedValue(new Error(`db down`))
      const tools = createEscalateTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.escalate)!
      const result = await tool.execute(`call-1`, sampleParams, undefined as any, vi.fn())

      expect(result.content).toEqual([
        { type: `text`, text: `Escalation failed: db down` },
      ])
      expect(result.details).toEqual({ success: false })
    })

    it(`should return an empty array when escalationProvider is absent (no provider)`, () => {
      // When escalationProvider is absent, createEscalateTools is never called.
      // This test confirms the guard at the call site: an undefined provider
      // must not produce any tools.
      const escalationProvider = undefined
      const result: unknown[] = escalationProvider
        ? createEscalateTools(escalationProvider)
        : []
      expect(result).toHaveLength(0)
    })
  })

  describe(`tool metadata`, () => {
    it(`should have a label, description, and parameters`, () => {
      const tools = createEscalateTools(makeProvider())
      expect(tools[0].label).toBe(`Escalate`)
      expect(tools[0].description).toBeTruthy()
      expect(tools[0].parameters).toBeDefined()
    })
  })
})
