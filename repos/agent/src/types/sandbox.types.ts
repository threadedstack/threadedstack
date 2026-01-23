/**
 * Custom tool types for dynamic user-supplied tool execution
 * These tools run in isolated WASM sandboxes for security
 */

export type TSandboxLanguage = `javascript`

/**
 * Metadata for a custom tool defined by the user
 */
export type TSandboxMetadata = {
  /** Unique tool identifier */
  name: string
  /** Human-readable description for the LLM */
  description: string
  /** Programming language of the tool code */
  language: TSandboxLanguage
  /** Source code for the tool (must be a function) */
  code: string
  /** JSON schema for tool parameters */
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
}

/**
 * Runtime execution context for a custom tool
 */
export type TSandboxExecution = {
  /** Tool metadata */
  tool: TSandboxMetadata
  /** Parsed arguments from LLM */
  arguments: Record<string, any>
  /** Project directory for file operations */
  projectDir: string
}

/**
 * Result from custom tool execution
 */
export type TSandboxResult = {
  /** Whether execution succeeded */
  success: boolean
  /** Result output (JSON stringified if object) */
  output: string
  /** Error message if failed */
  error?: string
  /** Execution time in milliseconds */
  executionTime?: number
}

/**
 * Configuration for custom tool execution
 */
export type TSandboxOpts = {
  /** Maximum execution time in milliseconds (default: 30000) */
  timeout?: number
  /** Enable detailed logging */
  enableLogging?: boolean
  /** Memory limit for WASM sandbox (in MB, default: 256) */
  memoryLimit?: number
}

/**
 * WASM Sandbox Module
 * Dynamically imported from the transpiled WASM component
 */
export interface IToolSandboxModule {
  executeCode(code: string, argsJson: string): string
}
