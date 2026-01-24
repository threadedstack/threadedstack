/**
 * @module tsagent
 * TODO: clean up and refactor
 * Move tools to own files
 * Clean up wasmImports object
 */

import type { TTSAgentOpts, TInitOpts } from '@TAG/types'
import type { TSandboxExecution } from '@TAG/types/sandbox.types'

import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { Mutex } from '@TAG/services/mutex'
import { WasmBridge } from '@TAG/services/wasm'
import { Sandbox } from '@TAG/services/sandbox'
import { Executor } from '@TAG/services/executor'
import { SubAgentManager } from '@TAG/services/subagent'

/**
 * TSAgent - Main Agent class exported from this package
 * Exposes methods and properties for interfacing with the WASM agent
 *
 * Architecture:
 * - Each request spawns a fresh WASM instance for isolation
 * - Mutex ensures serial execution per projectId
 * - Executor provides secure shell access via Host Bridge
 * - WasmBridge handles WASM instantiation and VFS mounting
 */
export class TSAgent {
  temp: string
  mutex: Mutex
  exec: Executor
  bridge: WasmBridge
  sandbox: Sandbox
  subAgentManager: SubAgentManager

  constructor(opts?: TTSAgentOpts) {
    this.temp = opts?.tempDir ?? os.tmpdir()
    this.sandbox = new Sandbox()
    this.mutex = new Mutex(opts?.mutex)
    this.exec = new Executor(opts?.exec)
    this.bridge = new WasmBridge(opts?.bridge)
    this.subAgentManager = new SubAgentManager({
      maxSubAgents: 5,
      idleTimeout: 300000,
      defaultQueueSize: 100,
    })
  }

  /**
   * Run the AI agent for a given prompt
   *
   * @param opts - Configuration including prompt, LLM config, projectId, and callback
   *
   * Flow:
   * 1. Acquire mutex lock for projectId (prevent concurrent access)
   * 2. Create/ensure project directory exists
   * 3. Initialize WasmBridge with VFS mounts and capabilities
   * 4. Execute agent's processRequest function via WasmBridge
   * 5. Cleanup WASM resources
   * 6. Release lock (CRITICAL - always happens via finally)
   */
  run = async (opts: TInitOpts): Promise<void> => {
    const { prompt, config, projectId, onToken, history } = opts
    const projectDir = path.resolve(this.temp, projectId)

    let releaseLock: (() => void) | undefined

    try {
      // 1. Acquire mutex lock for this project (serial execution)
      releaseLock = await this.mutex.acquire(projectId)

      // 2. Ensure project directory exists
      await fs.mkdir(projectDir, { recursive: true })

      // 2.5. Register custom tools if provided
      if (config.tools?.custom) {
        for (const customTool of config.tools.custom) this.sandbox.tools.add(customTool)
      }

      // 3. Build WASM imports object with Host Bridge capabilities
      // TODO: move these to their own files
      // Figure out how to import and use dynamically
      const wasmImports = {
        onToken: (token: string) => onToken(token),
        executeShell: async (cmd: string, args: string[]): Promise<string> => {
          try {
            return await this.exec.exec(cmd, args, projectDir)
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            return `[Error] ${msg}`
          }
        },
        webSearch: (query: string) => {
          // TODO: Implement web search via MCP or external API
          return '[Search] Web search not yet implemented'
        },

        // Filesystem operations
        readFile: async (filePath: string): Promise<string> => {
          try {
            const fullPath = path.resolve(projectDir, filePath)
            // Security check: ensure path is within project directory
            if (!fullPath.startsWith(projectDir)) {
              throw new Error('Access denied: Path outside project directory')
            }
            const content = await fs.readFile(fullPath, 'utf-8')
            return content
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            throw new Error(`Failed to read file: ${msg}`)
          }
        },

        writeFile: async (filePath: string, content: string): Promise<string> => {
          try {
            const fullPath = path.resolve(projectDir, filePath)
            // Security check: ensure path is within project directory
            if (!fullPath.startsWith(projectDir)) {
              throw new Error('Access denied: Path outside project directory')
            }
            // Ensure parent directory exists
            await fs.mkdir(path.dirname(fullPath), { recursive: true })
            await fs.writeFile(fullPath, content, 'utf-8')
            return `Successfully wrote ${content.length} bytes to ${filePath}`
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            throw new Error(`Failed to write file: ${msg}`)
          }
        },

        listDirectory: async (dirPath: string): Promise<string[]> => {
          try {
            const fullPath = path.resolve(projectDir, dirPath)
            // Security check: ensure path is within project directory
            if (!fullPath.startsWith(projectDir)) {
              throw new Error('Access denied: Path outside project directory')
            }
            const entries = await fs.readdir(fullPath, { withFileTypes: true })
            return entries.map((entry) => {
              const prefix = entry.isDirectory() ? '[DIR] ' : ''
              return `${prefix}${entry.name}`
            })
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            throw new Error(`Failed to list directory: ${msg}`)
          }
        },

        deleteFile: async (filePath: string): Promise<string> => {
          try {
            const fullPath = path.resolve(projectDir, filePath)
            // Security check: ensure path is within project directory
            if (!fullPath.startsWith(projectDir)) {
              throw new Error('Access denied: Path outside project directory')
            }
            await fs.unlink(fullPath)
            return `Successfully deleted ${filePath}`
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            throw new Error(`Failed to delete file: ${msg}`)
          }
        },

        createDirectory: async (dirPath: string): Promise<string> => {
          try {
            const fullPath = path.resolve(projectDir, dirPath)
            // Security check: ensure path is within project directory
            if (!fullPath.startsWith(projectDir)) {
              throw new Error('Access denied: Path outside project directory')
            }
            await fs.mkdir(fullPath, { recursive: true })
            return `Successfully created directory ${dirPath}`
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            throw new Error(`Failed to create directory: ${msg}`)
          }
        },

        fileExists: async (filePath: string): Promise<boolean> => {
          try {
            const fullPath = path.resolve(projectDir, filePath)
            // Security check: ensure path is within project directory
            if (!fullPath.startsWith(projectDir)) {
              return false
            }
            await fs.access(fullPath)
            return true
          } catch {
            return false
          }
        },

        getFileStats: async (filePath: string): Promise<string> => {
          try {
            const fullPath = path.resolve(projectDir, filePath)
            // Security check: ensure path is within project directory
            if (!fullPath.startsWith(projectDir)) {
              throw new Error('Access denied: Path outside project directory')
            }
            const stats = await fs.stat(fullPath)
            return JSON.stringify({
              size: stats.size,
              isFile: stats.isFile(),
              isDirectory: stats.isDirectory(),
              modified: stats.mtime.toISOString(),
              created: stats.birthtime.toISOString(),
            })
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            throw new Error(`Failed to get file stats: ${msg}`)
          }
        },

        // Custom tool execution
        executeCustomTool: async (
          toolName: string,
          argsJson: string
        ): Promise<string> => {
          try {
            const tool = this.sandbox.tools.get(toolName)
            if (!tool) {
              throw new Error(`Custom tool "${toolName}" not found`)
            }

            const args = JSON.parse(argsJson)
            const execution: TSandboxExecution = {
              tool,
              arguments: args,
              projectDir,
            }

            const result = await this.sandbox.execute(execution)

            if (!result.success) {
              throw new Error(result.error || 'Unknown execution error')
            }

            return result.output
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            throw new Error(`Failed to execute custom tool: ${msg}`)
          }
        },

        // Sub-agent orchestration
        spawnSubAgent: async (subAgentId: string, prompt: string): Promise<string> => {
          try {
            await this.subAgentManager.spawn({
              subAgentId,
              prompt,
              config, // Inherit parent config
              onToken: (token) => {
                // Forward sub-agent tokens to parent with prefix
                onToken(`[SubAgent:${subAgentId}] ${token}`)
              },
            })
            return JSON.stringify({
              success: true,
              subAgentId,
              message: `Sub-agent ${subAgentId} spawned successfully`,
            })
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            return JSON.stringify({
              success: false,
              subAgentId,
              error: msg,
            })
          }
        },

        sendMessageToSubAgent: async (
          subAgentId: string,
          message: string
        ): Promise<string> => {
          try {
            await this.subAgentManager.sendMessage(subAgentId, {
              type: 'prompt',
              content: message,
              timestamp: Date.now(),
            })
            return JSON.stringify({
              success: true,
              subAgentId,
              message: `Message sent to ${subAgentId}`,
            })
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            return JSON.stringify({
              success: false,
              subAgentId,
              error: msg,
            })
          }
        },

        receiveMessageFromSubAgent: async (subAgentId: string): Promise<string> => {
          try {
            const messages = await this.subAgentManager.receiveMessage(subAgentId, 1)
            if (messages.length === 0) {
              return JSON.stringify({
                success: true,
                subAgentId,
                message: null,
              })
            }
            return JSON.stringify({
              success: true,
              subAgentId,
              message: messages[0],
            })
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            return JSON.stringify({
              success: false,
              subAgentId,
              error: msg,
            })
          }
        },

        terminateSubAgent: async (subAgentId: string): Promise<string> => {
          try {
            await this.subAgentManager.terminate(subAgentId)
            return JSON.stringify({
              success: true,
              subAgentId,
              message: `Sub-agent ${subAgentId} terminated successfully`,
            })
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            return JSON.stringify({
              success: false,
              subAgentId,
              error: msg,
            })
          }
        },
        vfsMounts: {
          '/data': projectDir, // Mount project directory as /data in WASM guest
        },
        config: {
          AGENT_URL: config.url,
          AGENT_PATH: config.path || '',
          AGENT_MODEL: config.model,
          AGENT_API_KEY: config.apiKey,
          AGENT_PROVIDER: config.provider,
          AGENT_MAX_TOKENS: config.maxTokens || 100000,
          AGENT_TOOLS_ALLOW: config.tools?.allow
            ? JSON.stringify(config.tools.allow)
            : '',
          AGENT_TOOLS_DISALLOW: config.tools?.disallow
            ? JSON.stringify(config.tools.disallow)
            : '',
          AGENT_INITIAL_HISTORY: history ? JSON.stringify(history) : '',
          AGENT_CUSTOM_TOOLS: config.tools?.custom
            ? JSON.stringify(config.tools.custom)
            : '',
        },
      }

      // 4. Initialize fresh WASM instance with VFS mounts and capabilities
      const instance = await this.bridge.init(wasmImports)

      // 5. Execute the agent request (streams tokens via onToken callback)
      await instance.prompt(prompt)

      // 6. Cleanup WASM resources
      await this.bridge.cleanup()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error in WASM agent execution'
      onToken(`[Error] ${message}\n`)
      throw error
    } finally {
      // CRITICAL: Always release lock, even on error
      if (releaseLock) releaseLock()
    }
  }

  /**
   * Get mutex statistics
   */
  getStats = () => {
    return {
      activeLocks: this.mutex.getActiveLocks(),
      tempDir: this.temp,
    }
  }

  /**
   * Cleanup all resources including sub-agents
   */
  cleanup = async (): Promise<void> => {
    await this.subAgentManager.cleanup()
    this.mutex.clearAll()
    await this.bridge.cleanup()
  }
}
