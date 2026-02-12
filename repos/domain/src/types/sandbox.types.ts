/**
 * Sandbox provider types for modular sandbox integration
 */

export enum ESandboxProvider {
  e2b = `e2b`,
  local = `local`,
}

export type TSandboxProviderType = `${ESandboxProvider}`

/**
 * Result of a command/file operation in the sandbox
 */
export type TSandboxResult = {
  success: boolean
  output: string
  error?: string
  exitCode?: number
}

/**
 * Sandbox configuration
 */
export type TSandboxConfig = {
  provider: TSandboxProviderType
  /** E2B API key or other provider credentials */
  apiKey?: string
  /** Sandbox template/image to use */
  template?: string
  /** Timeout in milliseconds for sandbox operations */
  timeout?: number
  /** Environment variables to set in sandbox */
  envVars?: Record<string, string>
  /** Provider-specific options */
  options?: Record<string, unknown>
}

/**
 * ISandbox - interface for an active sandbox instance
 */
export interface ISandbox {
  /** Execute a shell command */
  exec(command: string, args?: string[]): Promise<TSandboxResult>
  /** Read a file */
  readFile(path: string): Promise<string>
  /** Write a file */
  writeFile(path: string, content: string): Promise<void>
  /** List directory contents */
  listDir(path: string): Promise<string[]>
  /** Delete a file */
  deleteFile(path: string): Promise<void>
  /** Create a directory */
  mkdir(path: string): Promise<void>
  /** Check if a file exists */
  fileExists(path: string): Promise<boolean>
  /** Close/destroy the sandbox */
  close(): Promise<void>
}

/**
 * ISandboxProvider - factory for creating sandbox instances
 */
export interface ISandboxProvider {
  readonly type: TSandboxProviderType
  /** Create a new sandbox instance */
  create(config: TSandboxConfig): Promise<ISandbox>
}
