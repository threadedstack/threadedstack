import type { TSandboxMetadata } from '@TAG/types/sandbox.types'

import { HostTools } from '@TAG/tools/host'
import { describe, it, expect, beforeEach } from 'vitest'

describe(`HostTools`, () => {
  let tools: HostTools

  beforeEach(() => {
    tools = new HostTools()
  })

  describe(`Constructor`, () => {
    it(`should initialize empty tools registry`, () => {
      expect(tools.list()).toEqual([])
    })
  })

  describe(`add()`, () => {
    const validTool: TSandboxMetadata = {
      name: `testTool`,
      description: `Test tool`,
      code: `return true`,
      language: `javascript`,
      parameters: {
        type: `object`,
        properties: {
          arg1: { type: `string` },
        },
        required: [`arg1`],
      },
    }

    it(`should register a valid tool`, () => {
      tools.add(validTool)
      expect(tools.list()).toEqual([`testTool`])
    })

    it(`should throw error if tool name already registered`, () => {
      tools.add(validTool)
      expect(() => tools.add(validTool)).toThrow(`Tool "testTool" is already registered`)
    })

    it(`should throw error if tool missing name`, () => {
      const invalidTool = {
        ...validTool,
        name: ``,
      }

      expect(() => tools.add(invalidTool as TSandboxMetadata)).toThrow(
        `Tool must have name, description, code, and parameters`
      )
    })

    it(`should throw error if tool missing description`, () => {
      const invalidTool = {
        ...validTool,
        description: ``,
      }

      expect(() => tools.add(invalidTool as TSandboxMetadata)).toThrow(
        `Tool must have name, description, code, and parameters`
      )
    })

    it(`should throw error if tool missing code`, () => {
      const invalidTool = {
        ...validTool,
        code: ``,
      }

      expect(() => tools.add(invalidTool as TSandboxMetadata)).toThrow(
        `Tool must have name, description, code, and parameters`
      )
    })

    it(`should throw error if tool missing parameters`, () => {
      const invalidTool = {
        name: `test`,
        description: `test`,
        code: `return`,
        language: `javascript` as const,
        parameters: null as any,
      }

      expect(() => tools.add(invalidTool)).toThrow(
        `Tool must have name, description, code, and parameters`
      )
    })

    it(`should throw error for non-JavaScript language`, () => {
      const pythonTool = {
        ...validTool,
        name: `pythonTool`,
        language: `python` as any,
      }

      expect(() => tools.add(pythonTool)).toThrow(
        `Only JavaScript tools are currently supported`
      )
    })

    it(`should register multiple different tools`, () => {
      tools.add(validTool)
      tools.add({ ...validTool, name: `tool2` })
      tools.add({ ...validTool, name: `tool3` })

      expect(tools.list()).toEqual([`testTool`, `tool2`, `tool3`])
    })
  })

  describe(`get()`, () => {
    const tool: TSandboxMetadata = {
      name: `getTool`,
      description: `Get test`,
      code: `return 42`,
      language: `javascript`,
      parameters: {
        type: `object`,
        properties: {},
        required: [],
      },
    }

    it(`should return registered tool`, () => {
      tools.add(tool)
      const retrieved = tools.get(`getTool`)
      expect(retrieved).toEqual(tool)
    })

    it(`should return undefined for non-existent tool`, () => {
      const retrieved = tools.get(`nonExistent`)
      expect(retrieved).toBeUndefined()
    })

    it(`should return exact tool metadata`, () => {
      tools.add(tool)
      const retrieved = tools.get(`getTool`)

      expect(retrieved?.name).toBe(`getTool`)
      expect(retrieved?.description).toBe(`Get test`)
      expect(retrieved?.code).toBe(`return 42`)
      expect(retrieved?.language).toBe(`javascript`)
      expect(retrieved?.parameters).toEqual({
        type: `object`,
        properties: {},
        required: [],
      })
    })
  })

  describe(`remove()`, () => {
    const tool: TSandboxMetadata = {
      name: `removeTool`,
      description: `Remove test`,
      code: `return`,
      language: `javascript`,
      parameters: {
        type: `object`,
        properties: {},
        required: [],
      },
    }

    it(`should remove registered tool`, () => {
      tools.add(tool)
      expect(tools.list()).toContain(`removeTool`)

      const removed = tools.remove(`removeTool`)
      expect(removed).toBe(true)
      expect(tools.list()).not.toContain(`removeTool`)
    })

    it(`should return false for non-existent tool`, () => {
      const removed = tools.remove(`nonExistent`)
      expect(removed).toBe(false)
    })

    it(`should allow re-adding after removal`, () => {
      tools.add(tool)
      tools.remove(`removeTool`)
      tools.add(tool) // Should not throw
      expect(tools.list()).toContain(`removeTool`)
    })

    it(`should not affect other tools`, () => {
      tools.add(tool)
      tools.add({ ...tool, name: `tool2` })
      tools.add({ ...tool, name: `tool3` })

      tools.remove(`tool2`)

      expect(tools.list()).toContain(`removeTool`)
      expect(tools.list()).toContain(`tool3`)
      expect(tools.list()).not.toContain(`tool2`)
    })
  })

  describe(`list()`, () => {
    it(`should return empty array for new registry`, () => {
      expect(tools.list()).toEqual([])
    })

    it(`should return all registered tool names`, () => {
      const tool1: TSandboxMetadata = {
        name: `tool1`,
        description: `First`,
        code: `return 1`,
        language: `javascript`,
        parameters: { type: `object`, properties: {}, required: [] },
      }

      const tool2: TSandboxMetadata = {
        name: `tool2`,
        description: `Second`,
        code: `return 2`,
        language: `javascript`,
        parameters: { type: `object`, properties: {}, required: [] },
      }

      tools.add(tool1)
      tools.add(tool2)

      const list = tools.list()
      expect(list).toHaveLength(2)
      expect(list).toContain(`tool1`)
      expect(list).toContain(`tool2`)
    })

    it(`should return copy of keys (not affect registry)`, () => {
      const tool: TSandboxMetadata = {
        name: `tool`,
        description: `Test`,
        code: `return`,
        language: `javascript`,
        parameters: { type: `object`, properties: {}, required: [] },
      }

      tools.add(tool)
      const list = tools.list()
      list.push(`hacked`)

      // Original registry should be unaffected
      expect(tools.list()).toEqual([`tool`])
    })
  })

  describe(`clear()`, () => {
    it(`should clear empty registry`, () => {
      tools.clear()
      expect(tools.list()).toEqual([])
    })

    it(`should remove all tools`, () => {
      const tool1: TSandboxMetadata = {
        name: `tool1`,
        description: `First`,
        code: `return`,
        language: `javascript`,
        parameters: { type: `object`, properties: {}, required: [] },
      }

      const tool2: TSandboxMetadata = {
        name: `tool2`,
        description: `Second`,
        code: `return`,
        language: `javascript`,
        parameters: { type: `object`, properties: {}, required: [] },
      }

      tools.add(tool1)
      tools.add(tool2)
      expect(tools.list()).toHaveLength(2)

      tools.clear()
      expect(tools.list()).toEqual([])
    })

    it(`should allow adding tools after clear`, () => {
      const tool: TSandboxMetadata = {
        name: `tool`,
        description: `Test`,
        code: `return`,
        language: `javascript`,
        parameters: { type: `object`, properties: {}, required: [] },
      }

      tools.add(tool)
      tools.clear()
      tools.add(tool) // Should work

      expect(tools.list()).toEqual([`tool`])
    })
  })

  describe(`Tool validation`, () => {
    it(`should validate tool structure on add`, () => {
      const validTool: TSandboxMetadata = {
        name: `valid`,
        description: `Valid tool`,
        code: `return args.x + args.y`,
        language: `javascript`,
        parameters: {
          type: `object`,
          properties: {
            x: { type: `number` },
            y: { type: `number` },
          },
          required: [`x`, `y`],
        },
      }

      expect(() => tools.add(validTool)).not.toThrow()
      expect(tools.get(`valid`)).toEqual(validTool)
    })

    it(`should preserve tool metadata exactly`, () => {
      const complexTool: TSandboxMetadata = {
        name: `complex`,
        description: `Complex tool with nested params`,
        code: `return JSON.stringify(args)`,
        language: `javascript`,
        parameters: {
          type: `object`,
          properties: {
            config: {
              type: `object`,
              properties: {
                timeout: { type: `number` },
                retry: { type: `boolean` },
              },
              required: [`timeout`],
            },
            data: {
              type: `array`,
              items: { type: `string` },
            },
          },
          required: [`config`],
        },
      }

      tools.add(complexTool)
      const retrieved = tools.get(`complex`)

      expect(retrieved).toEqual(complexTool)
      expect(retrieved?.parameters.properties.config).toEqual(
        complexTool.parameters.properties.config
      )
    })
  })

  describe(`Concurrent operations`, () => {
    it(`should handle rapid add operations`, () => {
      const toolCount = 100

      for (let i = 0; i < toolCount; i++) {
        tools.add({
          name: `tool${i}`,
          description: `Tool ${i}`,
          code: `return ${i}`,
          language: `javascript`,
          parameters: { type: `object`, properties: {}, required: [] },
        })
      }

      expect(tools.list()).toHaveLength(toolCount)
    })

    it(`should handle interleaved add/remove operations`, () => {
      const tool = (n: number): TSandboxMetadata => ({
        name: `tool${n}`,
        description: `Tool ${n}`,
        code: `return`,
        language: `javascript`,
        parameters: { type: `object`, properties: {}, required: [] },
      })

      tools.add(tool(1))
      tools.add(tool(2))
      tools.remove(`tool1`)
      tools.add(tool(3))
      tools.remove(`tool2`)
      tools.add(tool(4))

      expect(tools.list()).toEqual([`tool3`, `tool4`])
    })
  })
})
