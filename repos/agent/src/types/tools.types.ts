// These would be imported from WASM component in actual implementation
// For now, we'll define the interface
export declare const onToken: (token: string) => void
export declare const webSearch: (query: string) => string
export declare const shellExec: (cmd: string, args: string[]) => string | Promise<string>

// Filesystem operations
export declare const readFile: (path: string) => string | Promise<string>
export declare const deleteFile: (path: string) => string | Promise<string>
export declare const fileExists: (path: string) => boolean | Promise<boolean>
export declare const getFileStats: (path: string) => string | Promise<string>
export declare const createDirectory: (path: string) => string | Promise<string>
export declare const listDirectory: (path: string) => string[] | Promise<string[]>
export declare const writeFile: (
  path: string,
  content: string
) => string | Promise<string>

// Custom tool execution
export declare const executeCustomTool: (
  toolName: string,
  argsJson: string
) => string | Promise<string>

// Sub-agent orchestration
export declare const spawnSubAgent: (
  subAgentId: string,
  prompt: string
) => string | Promise<string>
export declare const sendMessageToSubAgent: (
  subAgentId: string,
  message: string
) => string | Promise<string>
export declare const receiveMessageFromSubAgent: (
  subAgentId: string
) => string | Promise<string>
export declare const terminateSubAgent: (subAgentId: string) => string | Promise<string>

export type TToolDefinition = {
  type: `function`
  function: {
    name: string
    description: string
    parameters: {
      type: `object`
      properties: Record<string, any>
      required: string[]
    }
  }
}

export type TToolDefGroup = Record<string, TToolDefinition>

export type TToolCall = {
  id: string
  type: `function`
  function: {
    name: string
    arguments: string
  }
}

export type TToolResult = {
  tool_call_id: string
  output: string
  error?: string
}
