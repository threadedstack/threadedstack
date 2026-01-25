import type { config } from '@TSH/configs/shell.config'
import type { Bash, BashOptions } from 'just-bash'
import type { Readable, Writable } from 'node:stream'

export type TShellCfg = typeof config

export enum EPlatform {
  Browser = 'browser',
  Node = 'node',
  Bun = 'bun',
}

export type TShellOptions = {
  /**
   * Home directory for Node/Bun filesystem (default: process.cwd())
   * Ignored in browser environment
   */
  homeDir?: string

  /**
   * Enable persistent storage in browser via IndexedDB (default: true)
   * Ignored in Node/Bun environment
   */
  persistent?: boolean

  /**
   * Custom bash options to override defaults
   */
  bashOptions?: Partial<BashOptions>

  /**
   * Enable verbose logging (default: false)
   */
  verbose?: boolean
}

export type TExecutionResult = {
  /**
   * Exit code (0 = success, non-zero = error)
   */
  exitCode: number

  /**
   * Standard output content
   */
  stdout: string

  /**
   * Standard error content
   */
  stderr: string

  /**
   * Command that was executed
   */
  command: string

  /**
   * Execution duration in milliseconds
   */
  duration: number
}

export type TShellStreams = {
  stdin: Writable
  stdout: Readable
  stderr: Readable
}

export type TShellState = {
  /**
   * Whether shell is initialized and ready
   */
  initialized: boolean

  /**
   * Detected runtime platform
   */
  platform: EPlatform

  /**
   * Home directory path
   */
  homeDir: string

  /**
   * Just-bash kernel instance
   */
  bash: Bash | null

  /**
   * Command execution count
   */
  executionCount: number
}
