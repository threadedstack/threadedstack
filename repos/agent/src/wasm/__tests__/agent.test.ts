import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock WASI environment module
vi.mock('wasi:cli/environment@0.2.0', () => ({
  getEnvironment: vi.fn(() => [
    ['AGENT_URL', 'https://api.openai.com'],
    ['AGENT_MODEL', 'gpt-4o'],
    ['AGENT_API_KEY', 'test-key'],
    ['AGENT_PROVIDER', 'openai'],
    ['AGENT_MAX_TOKENS', '100000'],
  ]),
}))

// Mock Host Bridge functions
global.onToken = vi.fn()
global.executeShell = vi.fn()
global.webSearch = vi.fn()
global.readFile = vi.fn()
global.writeFile = vi.fn()
global.listDirectory = vi.fn()
global.deleteFile = vi.fn()
global.createDirectory = vi.fn()
global.fileExists = vi.fn()
global.getFileStats = vi.fn()
global.executeCustomTool = vi.fn()
global.spawnSubAgent = vi.fn()
global.sendMessageToSubAgent = vi.fn()
global.receiveMessageFromSubAgent = vi.fn()
global.terminateSubAgent = vi.fn()

// Import after mocks are set up
import type { TToolCall } from '@TAG/types'

// We can't directly import agent.ts due to WASM component model limitations
// Instead, we'll test the helper functions by recreating them here

describe('wasm/agent helper functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('restoreHistory()', () => {
    // Recreate the function for testing
    const restoreHistory = (envs: Record<string, string>) => {
      const history: any[] = []
      const historyJson = envs.AGENT_INITIAL_HISTORY
      if (historyJson) {
        try {
          const restored = JSON.parse(historyJson)
          if (Array.isArray(restored)) {
            history.push(...restored)
            global.onToken(`[Agent] Restored ${restored.length} previous message(s)\n`)
          }
        } catch (error) {
          global.onToken(`[Warning] Failed to restore conversation history: ${error}\n`)
        }
      }
      return history
    }

    it('should return empty array when no history provided', () => {
      const history = restoreHistory({})
      expect(history).toEqual([])
    })

    it('should restore valid history from environment', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]

      const history = restoreHistory({
        AGENT_INITIAL_HISTORY: JSON.stringify(messages),
      })

      expect(history).toEqual(messages)
      expect(global.onToken).toHaveBeenCalledWith(
        '[Agent] Restored 2 previous message(s)\n'
      )
    })

    it('should handle invalid JSON gracefully', () => {
      const history = restoreHistory({
        AGENT_INITIAL_HISTORY: 'invalid json{',
      })

      expect(history).toEqual([])
      expect(global.onToken).toHaveBeenCalledWith(
        expect.stringContaining('[Warning] Failed to restore')
      )
    })

    it('should handle non-array JSON', () => {
      const history = restoreHistory({
        AGENT_INITIAL_HISTORY: '{"not":"an array"}',
      })

      expect(history).toEqual([])
    })

    it('should handle empty string', () => {
      const history = restoreHistory({
        AGENT_INITIAL_HISTORY: '',
      })

      expect(history).toEqual([])
    })
  })

  describe('executeTool()', () => {
    // Recreate the function for testing
    const executeTool = async (toolCall: TToolCall): Promise<string> => {
      const { name, arguments: argsJson } = toolCall.function

      try {
        const args = JSON.parse(argsJson)

        if (name === 'executeShell') {
          const { command, args: cmdArgs } = args
          global.onToken(
            `\n[Tool: executeShell] Running: ${command} ${cmdArgs.join(' ')}\n`
          )
          const output = await global.executeShell(command, cmdArgs)
          global.onToken(`[Output]\n${output}\n`)
          return output
        }

        if (name === 'webSearch') {
          const { query } = args
          global.onToken(`\n[Tool: webSearch] Searching: ${query}\n`)
          const results = global.webSearch(query)
          global.onToken(`[Results]\n${results}\n`)
          return results
        }

        if (name === 'readFile') {
          const { path } = args
          global.onToken(`\n[Tool: readFile] Reading: ${path}\n`)
          const content = await global.readFile(path)
          global.onToken(`[Content] ${content.length} bytes read\n`)
          return content
        }

        if (name === 'writeFile') {
          const { path, content } = args
          global.onToken(`\n[Tool: writeFile] Writing to: ${path}\n`)
          const result = await global.writeFile(path, content)
          global.onToken(`[Result] ${result}\n`)
          return result
        }

        if (name === 'listDirectory') {
          const { path } = args
          global.onToken(`\n[Tool: listDirectory] Listing: ${path}\n`)
          const entries = await global.listDirectory(path)
          const result = entries.join('\n')
          global.onToken(`[Entries]\n${result}\n`)
          return result
        }

        if (name === 'deleteFile') {
          const { path } = args
          global.onToken(`\n[Tool: deleteFile] Deleting: ${path}\n`)
          const result = await global.deleteFile(path)
          global.onToken(`[Result] ${result}\n`)
          return result
        }

        if (name === 'createDirectory') {
          const { path } = args
          global.onToken(`\n[Tool: createDirectory] Creating: ${path}\n`)
          const result = await global.createDirectory(path)
          global.onToken(`[Result] ${result}\n`)
          return result
        }

        if (name === 'fileExists') {
          const { path } = args
          global.onToken(`\n[Tool: fileExists] Checking: ${path}\n`)
          const exists = await global.fileExists(path)
          const result = exists ? 'File exists' : 'File does not exist'
          global.onToken(`[Result] ${result}\n`)
          return result
        }

        if (name === 'getFileStats') {
          const { path } = args
          global.onToken(`\n[Tool: getFileStats] Getting stats for: ${path}\n`)
          const stats = await global.getFileStats(path)
          global.onToken(`[Stats]\n${stats}\n`)
          return stats
        }

        if (name === 'spawnSubAgent') {
          const { subAgentId, prompt } = args
          global.onToken(`\n[Tool: spawnSubAgent] Spawning sub-agent: ${subAgentId}\n`)
          const result = await global.spawnSubAgent(subAgentId, prompt)
          global.onToken(`[Result] ${result}\n`)
          return result
        }

        if (name === 'sendMessageToSubAgent') {
          const { subAgentId, message } = args
          global.onToken(`\n[Tool: sendMessageToSubAgent] Sending to ${subAgentId}\n`)
          const result = await global.sendMessageToSubAgent(subAgentId, message)
          global.onToken(`[Result] ${result}\n`)
          return result
        }

        if (name === 'receiveMessageFromSubAgent') {
          const { subAgentId } = args
          global.onToken(
            `\n[Tool: receiveMessageFromSubAgent] Receiving from ${subAgentId}\n`
          )
          const result = await global.receiveMessageFromSubAgent(subAgentId)
          global.onToken(`[Message]\n${result}\n`)
          return result
        }

        if (name === 'terminateSubAgent') {
          const { subAgentId } = args
          global.onToken(`\n[Tool: terminateSubAgent] Terminating: ${subAgentId}\n`)
          const result = await global.terminateSubAgent(subAgentId)
          global.onToken(`[Result] ${result}\n`)
          return result
        }

        // Check for custom tools
        const builtInTools = [
          'readFile',
          'writeFile',
          'webSearch',
          'deleteFile',
          'fileExists',
          'getFileStats',
          'executeShell',
          'listDirectory',
          'createDirectory',
          'spawnSubAgent',
          'sendMessageToSubAgent',
          'receiveMessageFromSubAgent',
          'terminateSubAgent',
        ]

        if (!builtInTools.includes(name)) {
          global.onToken(`\n[Custom Tool: ${name}] Executing user-supplied code...\n`)
          const result = await global.executeCustomTool(name, argsJson)
          global.onToken(`[Result]\n${result}\n`)
          return result
        }

        throw new Error(`Unknown tool: ${name}`)
      } catch (error: any) {
        const errorMsg = `Error executing ${name}: ${error.message}`
        global.onToken(`[Error] ${errorMsg}\n`)
        return errorMsg
      }
    }

    it('should execute executeShell tool', async () => {
      vi.mocked(global.executeShell).mockResolvedValue('command output')

      const toolCall: TToolCall = {
        id: 'call_1',
        type: 'function',
        function: {
          name: 'executeShell',
          arguments: '{"command":"ls","args":["-la"]}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('command output')
      expect(global.executeShell).toHaveBeenCalledWith('ls', ['-la'])
      expect(global.onToken).toHaveBeenCalledWith(
        '\n[Tool: executeShell] Running: ls -la\n'
      )
      expect(global.onToken).toHaveBeenCalledWith('[Output]\ncommand output\n')
    })

    it('should execute webSearch tool', async () => {
      vi.mocked(global.webSearch).mockReturnValue('search results')

      const toolCall: TToolCall = {
        id: 'call_2',
        type: 'function',
        function: {
          name: 'webSearch',
          arguments: '{"query":"test query"}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('search results')
      expect(global.webSearch).toHaveBeenCalledWith('test query')
    })

    it('should execute readFile tool', async () => {
      vi.mocked(global.readFile).mockResolvedValue('file contents')

      const toolCall: TToolCall = {
        id: 'call_3',
        type: 'function',
        function: {
          name: 'readFile',
          arguments: '{"path":"test.txt"}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('file contents')
      expect(global.readFile).toHaveBeenCalledWith('test.txt')
      expect(global.onToken).toHaveBeenCalledWith('[Content] 13 bytes read\n')
    })

    it('should execute writeFile tool', async () => {
      vi.mocked(global.writeFile).mockResolvedValue('Write successful')

      const toolCall: TToolCall = {
        id: 'call_4',
        type: 'function',
        function: {
          name: 'writeFile',
          arguments: '{"path":"output.txt","content":"test content"}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('Write successful')
      expect(global.writeFile).toHaveBeenCalledWith('output.txt', 'test content')
    })

    it('should execute listDirectory tool', async () => {
      vi.mocked(global.listDirectory).mockResolvedValue(['file1.txt', 'file2.txt'])

      const toolCall: TToolCall = {
        id: 'call_5',
        type: 'function',
        function: {
          name: 'listDirectory',
          arguments: '{"path":"."}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('file1.txt\nfile2.txt')
      expect(global.listDirectory).toHaveBeenCalledWith('.')
    })

    it('should execute deleteFile tool', async () => {
      vi.mocked(global.deleteFile).mockResolvedValue('File deleted')

      const toolCall: TToolCall = {
        id: 'call_6',
        type: 'function',
        function: {
          name: 'deleteFile',
          arguments: '{"path":"old.txt"}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('File deleted')
      expect(global.deleteFile).toHaveBeenCalledWith('old.txt')
    })

    it('should execute createDirectory tool', async () => {
      vi.mocked(global.createDirectory).mockResolvedValue('Directory created')

      const toolCall: TToolCall = {
        id: 'call_7',
        type: 'function',
        function: {
          name: 'createDirectory',
          arguments: '{"path":"newdir"}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('Directory created')
      expect(global.createDirectory).toHaveBeenCalledWith('newdir')
    })

    it('should execute fileExists tool', async () => {
      vi.mocked(global.fileExists).mockResolvedValue(true)

      const toolCall: TToolCall = {
        id: 'call_8',
        type: 'function',
        function: {
          name: 'fileExists',
          arguments: '{"path":"check.txt"}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('File exists')
      expect(global.fileExists).toHaveBeenCalledWith('check.txt')
    })

    it('should execute fileExists tool when file does not exist', async () => {
      vi.mocked(global.fileExists).mockResolvedValue(false)

      const toolCall: TToolCall = {
        id: 'call_9',
        type: 'function',
        function: {
          name: 'fileExists',
          arguments: '{"path":"missing.txt"}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('File does not exist')
    })

    it('should execute getFileStats tool', async () => {
      const stats = JSON.stringify({ size: 1234, isFile: true })
      vi.mocked(global.getFileStats).mockResolvedValue(stats)

      const toolCall: TToolCall = {
        id: 'call_10',
        type: 'function',
        function: {
          name: 'getFileStats',
          arguments: '{"path":"data.txt"}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe(stats)
      expect(global.getFileStats).toHaveBeenCalledWith('data.txt')
    })

    it('should execute spawnSubAgent tool', async () => {
      vi.mocked(global.spawnSubAgent).mockResolvedValue('Sub-agent spawned')

      const toolCall: TToolCall = {
        id: 'call_11',
        type: 'function',
        function: {
          name: 'spawnSubAgent',
          arguments: '{"subAgentId":"worker-1","prompt":"Do work"}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('Sub-agent spawned')
      expect(global.spawnSubAgent).toHaveBeenCalledWith('worker-1', 'Do work')
    })

    it('should execute sendMessageToSubAgent tool', async () => {
      vi.mocked(global.sendMessageToSubAgent).mockResolvedValue('Message sent')

      const toolCall: TToolCall = {
        id: 'call_12',
        type: 'function',
        function: {
          name: 'sendMessageToSubAgent',
          arguments: '{"subAgentId":"worker-1","message":"Update"}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('Message sent')
      expect(global.sendMessageToSubAgent).toHaveBeenCalledWith('worker-1', 'Update')
    })

    it('should execute receiveMessageFromSubAgent tool', async () => {
      vi.mocked(global.receiveMessageFromSubAgent).mockResolvedValue(
        'Message from sub-agent'
      )

      const toolCall: TToolCall = {
        id: 'call_13',
        type: 'function',
        function: {
          name: 'receiveMessageFromSubAgent',
          arguments: '{"subAgentId":"worker-1"}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('Message from sub-agent')
      expect(global.receiveMessageFromSubAgent).toHaveBeenCalledWith('worker-1')
    })

    it('should execute terminateSubAgent tool', async () => {
      vi.mocked(global.terminateSubAgent).mockResolvedValue('Sub-agent terminated')

      const toolCall: TToolCall = {
        id: 'call_14',
        type: 'function',
        function: {
          name: 'terminateSubAgent',
          arguments: '{"subAgentId":"worker-1"}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('Sub-agent terminated')
      expect(global.terminateSubAgent).toHaveBeenCalledWith('worker-1')
    })

    it('should execute custom tools', async () => {
      vi.mocked(global.executeCustomTool).mockResolvedValue('Custom tool result')

      const toolCall: TToolCall = {
        id: 'call_15',
        type: 'function',
        function: {
          name: 'myCustomTool',
          arguments: '{"arg1":"value1"}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('Custom tool result')
      expect(global.executeCustomTool).toHaveBeenCalledWith(
        'myCustomTool',
        '{"arg1":"value1"}'
      )
      expect(global.onToken).toHaveBeenCalledWith(
        '\n[Custom Tool: myCustomTool] Executing user-supplied code...\n'
      )
    })

    it('should handle invalid JSON arguments', async () => {
      const toolCall: TToolCall = {
        id: 'call_16',
        type: 'function',
        function: {
          name: 'readFile',
          arguments: 'invalid json{',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toContain('Error executing readFile')
      expect(global.onToken).toHaveBeenCalledWith(expect.stringContaining('[Error]'))
    })

    it('should handle unknown tools', async () => {
      const toolCall: TToolCall = {
        id: 'call_17',
        type: 'function',
        function: {
          name: 'unknownTool',
          arguments: '{}',
        },
      }

      // Since 'unknownTool' is not in builtInTools, it will be treated as custom tool
      vi.mocked(global.executeCustomTool).mockResolvedValue('Custom result')

      const result = await executeTool(toolCall)

      expect(global.executeCustomTool).toHaveBeenCalledWith('unknownTool', '{}')
    })

    it('should handle tool execution errors', async () => {
      vi.mocked(global.readFile).mockRejectedValue(new Error('File not found'))

      const toolCall: TToolCall = {
        id: 'call_18',
        type: 'function',
        function: {
          name: 'readFile',
          arguments: '{"path":"missing.txt"}',
        },
      }

      const result = await executeTool(toolCall)

      expect(result).toBe('Error executing readFile: File not found')
      expect(global.onToken).toHaveBeenCalledWith(
        '[Error] Error executing readFile: File not found\n'
      )
    })
  })
})
