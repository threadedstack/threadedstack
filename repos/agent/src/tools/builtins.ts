import type { TOnToken } from '@TAG/types'
import type { GuestTools } from '@TAG/tools/guest'
import type { TExecData } from '@TAG/tools/definitions/shell/definition'

import { Shell } from '@TAG/tools/definitions/shell/shell'

/**
 * Imported by WASM at runtime, declare as noop's so we can reference them
 * TODO: replace these when the real functions are moved into the tools
 */
declare const webSearch: (query: string) => string

// Filesystem operations
declare const readFile: (path: string) => string | Promise<string>
declare const deleteFile: (path: string) => string | Promise<string>
declare const fileExists: (path: string) => boolean | Promise<boolean>
declare const getFileStats: (path: string) => string | Promise<string>
declare const createDirectory: (path: string) => string | Promise<string>
declare const listDirectory: (path: string) => string[] | Promise<string[]>
declare const writeFile: (path: string, content: string) => string | Promise<string>

// Custom tool execution
declare const executeCustomTool: (
  toolName: string,
  argsJson: string
) => string | Promise<string>

// Sub-agent orchestration
declare const spawnSubAgent: (
  subAgentId: string,
  prompt: string
) => string | Promise<string>
declare const sendMessageToSubAgent: (
  subAgentId: string,
  message: string
) => string | Promise<string>
declare const receiveMessageFromSubAgent: (subAgentId: string) => string | Promise<string>
declare const terminateSubAgent: (subAgentId: string) => string | Promise<string>

/** ------ End WASM imports ------ */

export type TToolCtx = {
  json: string
  name?: string
  onToken: TOnToken
  args: Record<string, any>
}

export const BuiltInTools = {
  shellExec: (tools: GuestTools) => {
    const shell = new Shell()

    return async (ctx: TToolCtx) => {
      const { args, onToken } = ctx
      const { command, args: cmdArgs } = args
      const cmd = `${command} ${cmdArgs.join(` `)}`
      onToken(`\n[Tool: shellExec] Running: ${cmd}\n`)
      const output = await shell.exec(args as TExecData, cmd)
      onToken(`[Output]\n${output}\n`)
      return output
    }
  },
  readFile: (tools: GuestTools) => {
    return async (ctx: TToolCtx) => {
      const { args, onToken } = ctx
      const { path } = args
      onToken(`\n[Tool: readFile] Reading: ${path}\n`)
      const content = await readFile(path)
      onToken(`[Content] ${content.length} bytes read\n`)
      return content
    }
  },
  writeFile: (tools: GuestTools) => {
    return async (ctx: TToolCtx) => {
      const { args, onToken } = ctx
      const { path, content } = args
      onToken(`\n[Tool: writeFile] Writing to: ${path}\n`)
      const result = await writeFile(path, content)
      onToken(`[Result] ${result}\n`)
      return result
    }
  },
  webSearch: (tools: GuestTools) => {
    return async (ctx: TToolCtx) => {
      const { args, onToken } = ctx
      const { query } = args
      onToken(`\n[Tool: webSearch] Searching: ${query}\n`)
      const results = webSearch(query)
      onToken(`[Results]\n${results}\n`)
      return results
    }
  },
  deleteFile: (tools: GuestTools) => {
    return async (ctx: TToolCtx) => {
      const { args, onToken } = ctx
      const { path } = args
      onToken(`\n[Tool: deleteFile] Deleting: ${path}\n`)
      const result = await deleteFile(path)
      onToken(`[Result] ${result}\n`)
      return result
    }
  },
  fileExists: (tools: GuestTools) => {
    return async (ctx: TToolCtx) => {
      const { args, onToken } = ctx
      const { path } = args
      onToken(`\n[Tool: fileExists] Checking: ${path}\n`)
      const exists = await fileExists(path)
      const result = exists ? `File exists` : `File does not exist`
      onToken(`[Result] ${result}\n`)
      return result
    }
  },
  getFileStats: (tools: GuestTools) => {
    return async (ctx: TToolCtx) => {
      const { args, onToken } = ctx
      const { path } = args
      onToken(`\n[Tool: getFileStats] Getting stats for: ${path}\n`)
      const stats = await getFileStats(path)
      onToken(`[Stats]\n${stats}\n`)
      return stats
    }
  },
  listDirectory: (tools: GuestTools) => {
    return async (ctx: TToolCtx) => {
      const { args, onToken } = ctx
      const { path } = args
      onToken(`\n[Tool: listDirectory] Listing: ${path}\n`)
      const entries = await listDirectory(path)
      const result = entries.join(`\n`)
      onToken(`[Entries]\n${result}\n`)
      return result
    }
  },
  spawnSubAgent: (tools: GuestTools) => {
    return async (ctx: TToolCtx) => {
      const { args, onToken } = ctx
      const { subAgentId, prompt } = args
      onToken(`\n[Tool: spawnSubAgent] Spawning sub-agent: ${subAgentId}\n`)
      const result = await spawnSubAgent(subAgentId, prompt)
      onToken(`[Result] ${result}\n`)
      return result
    }
  },
  createDirectory: (tools: GuestTools) => {
    return async (ctx: TToolCtx) => {
      const { args, onToken } = ctx
      const { path } = args
      onToken(`\n[Tool: createDirectory] Creating: ${path}\n`)
      const result = await createDirectory(path)
      onToken(`[Result] ${result}\n`)
      return result
    }
  },
  executeCustomTool: (tools: GuestTools) => {
    return async (ctx: TToolCtx) => {
      const { onToken, name, json } = ctx
      // This is a custom tool - execute via Host Bridge
      onToken(`\n[Custom Tool: ${name}] Executing user-supplied code...\n`)
      const result = await executeCustomTool(name, json)
      onToken(`[Result]\n${result}\n`)
      return result
    }
  },
  terminateSubAgent: (tools: GuestTools) => {
    return async (ctx: TToolCtx) => {
      const { args, onToken } = ctx
      const { subAgentId } = args
      onToken(`\n[Tool: terminateSubAgent] Terminating: ${subAgentId}\n`)
      const result = await terminateSubAgent(subAgentId)
      onToken(`[Result] ${result}\n`)
      return result
    }
  },
  sendMessageToSubAgent: (tools: GuestTools) => {
    return async (ctx: TToolCtx) => {
      const { args, onToken } = ctx
      const { subAgentId, message } = args
      onToken(`\n[Tool: sendMessageToSubAgent] Sending to ${subAgentId}\n`)
      const result = await sendMessageToSubAgent(subAgentId, message)
      onToken(`[Result] ${result}\n`)
      return result
    }
  },
  receiveMessageFromSubAgent: (tools: GuestTools) => {
    return async (ctx: TToolCtx) => {
      const { args, onToken } = ctx
      const { subAgentId } = args
      onToken(`\n[Tool: receiveMessageFromSubAgent] Receiving from ${subAgentId}\n`)
      const result = await receiveMessageFromSubAgent(subAgentId)
      onToken(`[Message]\n${result}\n`)
      return result
    }
  },
}
