import { EAgentTool } from '@tdsk/domain'
import { describe, it, expect, vi } from 'vitest'

import { createTaskTools } from './tools'

const makeProvider = () => ({
  proposeTask: vi.fn().mockResolvedValue({
    id: `tp_1`,
    status: `scanned`,
    findings: [],
    deduped: false,
  }),
})

const sampleParams = {
  title: `Fix egress CA negative serial`,
  description: `The egress MITM CA generates negative serials that Go rejects`,
  priority: `P1`,
  evidence: `x509: negative serial number in backend logs`,
  sourceSignal: `log`,
  dedupeKey: `egress-ca-negative-serial`,
  repos: [`backend`],
}

describe(`createTaskTools`, () => {
  describe(`tool creation and filtering`, () => {
    it(`should expose the proposeTask tool`, () => {
      const tools = createTaskTools(makeProvider())
      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe(EAgentTool.proposeTask)
    })

    it(`should filter by allowedTools names`, () => {
      expect(createTaskTools(makeProvider(), [`nonExistent`])).toHaveLength(0)
      expect(createTaskTools(makeProvider(), [EAgentTool.proposeTask])).toHaveLength(1)
    })

    it(`should return the tool when allowedTools is empty`, () => {
      expect(createTaskTools(makeProvider(), [])).toHaveLength(1)
    })
  })

  describe(`proposeTask`, () => {
    it(`should call provider.proposeTask with the params and report a scanned proposal`, async () => {
      const provider = makeProvider()
      const tools = createTaskTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.proposeTask)!
      const result = await tool.execute(`call-1`, sampleParams, undefined as any, vi.fn())

      expect(provider.proposeTask).toHaveBeenCalledWith(sampleParams)
      const text = (result.content[0] as { text: string }).text
      expect(text).toContain(`tp_1`)
      expect(text).toContain(`proposed`)
      expect(result.details).toEqual(
        expect.objectContaining({
          id: `tp_1`,
          status: `scanned`,
          deduped: false,
          success: true,
        })
      )
    })

    it(`should report a deduped proposal as already proposed`, async () => {
      const provider = makeProvider()
      provider.proposeTask.mockResolvedValue({
        id: `tp_existing`,
        status: `scanned`,
        findings: [],
        deduped: true,
      })
      const tools = createTaskTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.proposeTask)!
      const result = await tool.execute(`call-1`, sampleParams, undefined as any, vi.fn())

      const text = (result.content[0] as { text: string }).text
      expect(text).toContain(`already proposed`)
      expect(text).toContain(`tp_existing`)
      expect(result.details).toEqual(
        expect.objectContaining({ deduped: true, success: true })
      )
    })

    it(`should report a rejected proposal with the scan findings`, async () => {
      const provider = makeProvider()
      provider.proposeTask.mockResolvedValue({
        id: `tp_bad`,
        status: `rejected`,
        findings: [`secret exfiltration`, `rm -rf`],
        deduped: false,
      })
      const tools = createTaskTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.proposeTask)!
      const result = await tool.execute(`call-1`, sampleParams, undefined as any, vi.fn())

      const text = (result.content[0] as { text: string }).text
      expect(text).toContain(`rejected by scan`)
      expect(text).toContain(`secret exfiltration`)
      expect(text).toContain(`rm -rf`)
      expect(result.details).toEqual(
        expect.objectContaining({ status: `rejected`, success: false })
      )
    })

    it(`should call onUpdate with running status`, async () => {
      const onUpdate = vi.fn()
      const tools = createTaskTools(makeProvider())
      const tool = tools.find((t) => t.name === EAgentTool.proposeTask)!
      await tool.execute(`call-1`, sampleParams, undefined as any, onUpdate)

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Proposing task: ${sampleParams.title}` }],
        details: { status: `running` },
      })
    })

    it(`should catch errors and return a failure message`, async () => {
      const provider = makeProvider()
      provider.proposeTask.mockRejectedValue(new Error(`db down`))
      const tools = createTaskTools(provider)
      const tool = tools.find((t) => t.name === EAgentTool.proposeTask)!
      const result = await tool.execute(`call-1`, sampleParams, undefined as any, vi.fn())

      expect(result.content).toEqual([
        { type: `text`, text: `Task proposal failed: db down` },
      ])
      expect(result.details).toEqual({ success: false })
    })
  })

  describe(`tool metadata`, () => {
    it(`should have a label, description, and parameters`, () => {
      const tools = createTaskTools(makeProvider())
      expect(tools[0].label).toBe(`Propose Task`)
      expect(tools[0].description).toBeTruthy()
      expect(tools[0].parameters).toBeDefined()
    })
  })
})
