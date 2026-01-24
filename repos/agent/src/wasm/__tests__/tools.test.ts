import { describe, it, expect } from 'vitest'
import type { TToolDefinition } from '@TAG/wasm/tools'
import {
  TOOL_DEFINITIONS,
  getToolDefinitions,
  convertToAnthropicTools,
} from '@TAG/wasm/tools'

describe('wasm/tools', () => {
  describe('TOOL_DEFINITIONS', () => {
    it('should contain all built-in tool definitions', () => {
      const expectedTools = [
        'executeShell',
        'webSearch',
        'readFile',
        'writeFile',
        'listDirectory',
        'deleteFile',
        'createDirectory',
        'fileExists',
        'getFileStats',
        'spawnSubAgent',
        'sendMessageToSubAgent',
        'receiveMessageFromSubAgent',
        'terminateSubAgent',
      ]

      for (const toolName of expectedTools) {
        expect(TOOL_DEFINITIONS[toolName]).toBeDefined()
      }
    })

    it('should have correct structure for each tool', () => {
      for (const [name, tool] of Object.entries(TOOL_DEFINITIONS)) {
        expect(tool.type).toBe('function')
        expect(tool.function).toBeDefined()
        expect(tool.function.name).toBe(name)
        expect(tool.function.description).toBeTruthy()
        expect(tool.function.parameters).toBeDefined()
        expect(tool.function.parameters.type).toBe('object')
        expect(tool.function.parameters.properties).toBeDefined()
        expect(tool.function.parameters.required).toBeInstanceOf(Array)
      }
    })

    describe('executeShell tool', () => {
      it('should have correct definition', () => {
        const tool = TOOL_DEFINITIONS.executeShell
        expect(tool.function.name).toBe('executeShell')
        expect(tool.function.parameters.required).toEqual(['command', 'args'])
        expect(tool.function.parameters.properties.command).toBeDefined()
        expect(tool.function.parameters.properties.args).toBeDefined()
        expect(tool.function.parameters.properties.args.type).toBe('array')
      })
    })

    describe('filesystem tools', () => {
      it('should have readFile tool', () => {
        const tool = TOOL_DEFINITIONS.readFile
        expect(tool.function.parameters.required).toEqual(['path'])
        expect(tool.function.parameters.properties.path.type).toBe('string')
      })

      it('should have writeFile tool', () => {
        const tool = TOOL_DEFINITIONS.writeFile
        expect(tool.function.parameters.required).toEqual(['path', 'content'])
        expect(tool.function.parameters.properties.path).toBeDefined()
        expect(tool.function.parameters.properties.content).toBeDefined()
      })

      it('should have listDirectory tool', () => {
        const tool = TOOL_DEFINITIONS.listDirectory
        expect(tool.function.parameters.required).toEqual(['path'])
      })

      it('should have deleteFile tool', () => {
        const tool = TOOL_DEFINITIONS.deleteFile
        expect(tool.function.parameters.required).toEqual(['path'])
      })

      it('should have createDirectory tool', () => {
        const tool = TOOL_DEFINITIONS.createDirectory
        expect(tool.function.parameters.required).toEqual(['path'])
      })

      it('should have fileExists tool', () => {
        const tool = TOOL_DEFINITIONS.fileExists
        expect(tool.function.parameters.required).toEqual(['path'])
      })

      it('should have getFileStats tool', () => {
        const tool = TOOL_DEFINITIONS.getFileStats
        expect(tool.function.parameters.required).toEqual(['path'])
      })
    })

    describe('sub-agent tools', () => {
      it('should have spawnSubAgent tool', () => {
        const tool = TOOL_DEFINITIONS.spawnSubAgent
        expect(tool.function.parameters.required).toEqual(['subAgentId', 'prompt'])
        expect(tool.function.parameters.properties.subAgentId).toBeDefined()
        expect(tool.function.parameters.properties.prompt).toBeDefined()
      })

      it('should have sendMessageToSubAgent tool', () => {
        const tool = TOOL_DEFINITIONS.sendMessageToSubAgent
        expect(tool.function.parameters.required).toEqual(['subAgentId', 'message'])
      })

      it('should have receiveMessageFromSubAgent tool', () => {
        const tool = TOOL_DEFINITIONS.receiveMessageFromSubAgent
        expect(tool.function.parameters.required).toEqual(['subAgentId'])
      })

      it('should have terminateSubAgent tool', () => {
        const tool = TOOL_DEFINITIONS.terminateSubAgent
        expect(tool.function.parameters.required).toEqual(['subAgentId'])
      })
    })
  })

  describe('getToolDefinitions()', () => {
    it('should return all tools when no filters provided', () => {
      const tools = getToolDefinitions()
      expect(tools.length).toBeGreaterThan(10)
      expect(tools.every((t) => t.type === 'function')).toBe(true)
    })

    it('should filter by allowList', () => {
      const tools = getToolDefinitions(['readFile', 'writeFile'])
      expect(tools).toHaveLength(2)
      expect(tools.map((t) => t.function.name)).toEqual(['readFile', 'writeFile'])
    })

    it('should exclude tools in disallowList', () => {
      const tools = getToolDefinitions(undefined, ['executeShell', 'webSearch'])
      const names = tools.map((t) => t.function.name)
      expect(names).not.toContain('executeShell')
      expect(names).not.toContain('webSearch')
      expect(names).toContain('readFile')
    })

    it('should combine allowList and disallowList', () => {
      const tools = getToolDefinitions(
        ['readFile', 'writeFile', 'deleteFile'],
        ['deleteFile']
      )
      expect(tools).toHaveLength(2)
      expect(tools.map((t) => t.function.name)).toEqual(['readFile', 'writeFile'])
    })

    it('should ignore non-existent tools in allowList', () => {
      const tools = getToolDefinitions(['readFile', 'nonExistent', 'writeFile'])
      expect(tools).toHaveLength(2)
      expect(tools.map((t) => t.function.name)).toEqual(['readFile', 'writeFile'])
    })

    it('should append custom tools', () => {
      const customTools = [
        {
          name: 'customTool',
          description: 'Custom tool',
          code: 'return true',
          language: 'javascript' as const,
          parameters: {
            type: 'object' as const,
            properties: {
              arg: { type: 'string' },
            },
            required: ['arg'],
          },
        },
      ]

      const tools = getToolDefinitions(['readFile'], undefined, customTools)
      expect(tools).toHaveLength(2)
      expect(tools[0].function.name).toBe('readFile')
      expect(tools[1].function.name).toBe('customTool')
    })

    it('should handle multiple custom tools', () => {
      const customTools = [
        {
          name: 'custom1',
          description: 'First',
          code: 'return',
          language: 'javascript' as const,
          parameters: {
            type: 'object' as const,
            properties: {},
            required: [],
          },
        },
        {
          name: 'custom2',
          description: 'Second',
          code: 'return',
          language: 'javascript' as const,
          parameters: {
            type: 'object' as const,
            properties: {},
            required: [],
          },
        },
      ]

      const tools = getToolDefinitions([], undefined, customTools)
      expect(tools).toHaveLength(2)
      expect(tools.map((t) => t.function.name)).toEqual(['custom1', 'custom2'])
    })

    it('should return empty array when allowList is empty and no custom tools', () => {
      const tools = getToolDefinitions([])
      expect(tools).toEqual([])
    })

    it('should handle disallowing all tools', () => {
      const allTools = Object.keys(TOOL_DEFINITIONS)
      const tools = getToolDefinitions(undefined, allTools)
      expect(tools).toEqual([])
    })
  })

  describe('convertToAnthropicTools()', () => {
    it('should convert OpenAI format to Anthropic format', () => {
      const openaiTools: TToolDefinition[] = [
        {
          type: 'function',
          function: {
            name: 'testTool',
            description: 'Test tool',
            parameters: {
              type: 'object',
              properties: {
                arg: { type: 'string' },
              },
              required: ['arg'],
            },
          },
        },
      ]

      const anthropicTools = convertToAnthropicTools(openaiTools)

      expect(anthropicTools).toHaveLength(1)
      expect(anthropicTools[0]).toEqual({
        name: 'testTool',
        description: 'Test tool',
        input_schema: {
          type: 'object',
          properties: {
            arg: { type: 'string' },
          },
          required: ['arg'],
        },
      })
    })

    it('should convert multiple tools', () => {
      const tools = getToolDefinitions(['readFile', 'writeFile'])
      const anthropicTools = convertToAnthropicTools(tools)

      expect(anthropicTools).toHaveLength(2)
      expect(anthropicTools[0].name).toBe('readFile')
      expect(anthropicTools[1].name).toBe('writeFile')
      expect(anthropicTools[0].input_schema).toBeDefined()
      expect(anthropicTools[1].input_schema).toBeDefined()
    })

    it('should preserve parameter schemas', () => {
      const tools = getToolDefinitions(['writeFile'])
      const anthropicTools = convertToAnthropicTools(tools)

      expect(anthropicTools[0].input_schema).toEqual({
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path to the file',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
        },
        required: ['path', 'content'],
      })
    })

    it('should handle empty array', () => {
      const anthropicTools = convertToAnthropicTools([])
      expect(anthropicTools).toEqual([])
    })

    it('should preserve complex parameter schemas', () => {
      const complexTool: TToolDefinition = {
        type: 'function',
        function: {
          name: 'complex',
          description: 'Complex tool',
          parameters: {
            type: 'object',
            properties: {
              nested: {
                type: 'object',
                properties: {
                  deep: { type: 'string' },
                },
                required: ['deep'],
              },
              array: {
                type: 'array',
                items: { type: 'number' },
              },
            },
            required: ['nested'],
          },
        },
      }

      const anthropicTools = convertToAnthropicTools([complexTool])

      expect(anthropicTools[0].input_schema.properties.nested).toEqual({
        type: 'object',
        properties: {
          deep: { type: 'string' },
        },
        required: ['deep'],
      })
      expect(anthropicTools[0].input_schema.properties.array).toEqual({
        type: 'array',
        items: { type: 'number' },
      })
    })
  })

  describe('Tool filtering scenarios', () => {
    it('should allow only shell and file operations', () => {
      const tools = getToolDefinitions(['executeShell', 'readFile', 'writeFile'])
      expect(tools).toHaveLength(3)
      expect(tools.map((t) => t.function.name)).toEqual([
        'executeShell',
        'readFile',
        'writeFile',
      ])
    })

    it('should disallow dangerous operations', () => {
      const tools = getToolDefinitions(undefined, [
        'executeShell',
        'deleteFile',
        'webSearch',
      ])
      const names = tools.map((t) => t.function.name)
      expect(names).not.toContain('executeShell')
      expect(names).not.toContain('deleteFile')
      expect(names).not.toContain('webSearch')
      expect(names).toContain('readFile')
      expect(names).toContain('writeFile')
    })

    it('should support read-only filesystem access', () => {
      const tools = getToolDefinitions([
        'readFile',
        'listDirectory',
        'fileExists',
        'getFileStats',
      ])
      expect(tools).toHaveLength(4)
      const names = tools.map((t) => t.function.name)
      expect(names).not.toContain('writeFile')
      expect(names).not.toContain('deleteFile')
    })

    it('should support sub-agent only mode', () => {
      const tools = getToolDefinitions([
        'spawnSubAgent',
        'sendMessageToSubAgent',
        'receiveMessageFromSubAgent',
        'terminateSubAgent',
      ])
      expect(tools).toHaveLength(4)
      expect(tools.every((t) => t.function.name.includes('SubAgent'))).toBe(true)
    })
  })
})
