/**
 * Sandbox provider types for modular sandbox integration
 */

export enum ESandboxType {
  local = `local`,
}

export type TSandboxType = `${ESandboxType}`

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
  provider: TSandboxType
  /** Timeout in milliseconds for sandbox operations */
  timeout?: number
  /** Environment variables to set in sandbox */
  envVars?: Record<string, string>
  /** Provider-specific options */
  options?: Record<string, unknown>
}

/**
 * Result of evaluating code in the sandbox
 */
export type TSandboxEvalResult = {
  /** Captured console output */
  output: string
  /** Default export from the evaluated module (if any) */
  result: any
}

/**
 * Options for eval()
 */
export type TSandboxEvalOpts = {
  /** Execution timeout in ms (default: 5000) */
  timeout?: number
  /** Named ES modules to register before evaluation.
   *  Keys are import specifiers, values are module source code.
   *  The evaluated code can import from them by name. */
  modules?: Record<string, string>
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
  /** Execute JavaScript code in an isolated V8 environment */
  evaluate(code: string, opts?: TSandboxEvalOpts): Promise<TSandboxEvalResult>
  /** Reset sandbox state for reuse (clear filesystem, release user modules) */
  reset(): Promise<void>
  /** Close/destroy the sandbox */
  close(): Promise<void>
}

/**
 * ISandboxProvider - factory for creating sandbox instances
 */
export interface ISandboxProvider {
  readonly type: TSandboxType
  /** Create a new sandbox instance */
  create(config: TSandboxConfig): Promise<ISandbox>
}
