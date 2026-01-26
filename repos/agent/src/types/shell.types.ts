import type { Bash, BashOptions } from 'just-bash'

export type TShellCfg = {
  /**
   * Home directory for Node/Bun filesystem (default: process.cwd())
   * Ignored in browser environment
   */
  home?: string

  /**
   * Enable persistent storage in browser via IndexedDB (default: true)
   * Ignored in Node/Bun environment
   */
  persistent?: boolean

  /**
   * Custom bash options to override defaults
   */
  options?: Partial<BashOptions>

  /**
   * Enable verbose logging (default: false)
   */
  verbose?: boolean
}

export type TShellState = {
  /**
   * Whether shell is initialized and ready
   */
  initialized: boolean

  /**
   * Home directory path
   */
  home: string

  /**
   * Just-bash kernel instance
   */
  bash: Bash | null

  /**
   * Command execution count
   */
  executionCount: number
}

export type TShellStreams = {
  stdin: WritableStream<Uint8Array>
  stdout: ReadableStream<Uint8Array>
  stderr: ReadableStream<Uint8Array>
}
