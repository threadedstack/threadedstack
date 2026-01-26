import type { TShellStreams } from '@TAG/types'
import { logger } from '@TAG/wasm/logger'

export type TStreamBuffers = {
  stdout: string[]
  stderr: string[]
}

/**
 * StreamManager handles I/O streams for shell execution
 * Provides stdin/stdout/stderr streams with buffering and event handling
 */
export class StreamManager {
  #stdin: TransformStream<Uint8Array, Uint8Array>
  #stdout: TransformStream<Uint8Array, Uint8Array>
  #stderr: TransformStream<Uint8Array, Uint8Array>
  #destroyed = false
  #buffers: TStreamBuffers = {
    stdout: [],
    stderr: [],
  }

  constructor() {
    // Create transform streams for I/O
    this.#stdin = new TransformStream()
    this.#stdout = new TransformStream()
    this.#stderr = new TransformStream()

    // Start monitoring output streams
    this.#monitorStream(this.#stdout.readable, 'stdout')
    this.#monitorStream(this.#stderr.readable, 'stderr')
  }

  /**
   * Monitors a readable stream and buffers its output
   */
  async #monitorStream(
    readable: ReadableStream<Uint8Array>,
    type: 'stdout' | 'stderr'
  ): Promise<void> {
    const reader = readable.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done || this.#destroyed) break

        const text = decoder.decode(value, { stream: true })
        if (text) {
          this.#buffers[type].push(text)
          logger.debug(`${type}:`, text.trim())
        }
      }
    } catch (error) {
      if (!this.#destroyed) {
        logger.error(`${type} error`, { error })
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Gets all I/O streams
   * Returns the sides of the streams expected by the shell:
   * stdin: Readable (shell reads from here)
   * stdout/stderr: Writable (shell writes to here)
   */
  getStreams(): TShellStreams {
    if (this.#destroyed) {
      throw new Error(`StreamManager has been destroyed`)
    }

    // Cast as unknown then TShellStreams to bypass potential Node.js type mismatches
    // in the current TShellStreams definition
    return {
      stdin: this.#stdin.readable,
      stdout: this.#stdout.writable,
      stderr: this.#stderr.writable,
    } as unknown as TShellStreams
  }

  /**
   * Gets the current stdout buffer content
   * @returns Concatenated stdout content
   */
  getStdout(): string {
    return this.#buffers.stdout.join(``)
  }

  /**
   * Gets the current stderr buffer content
   * @returns Concatenated stderr content
   */
  getStderr(): string {
    return this.#buffers.stderr.join(``)
  }

  /**
   * Clears all buffered output
   */
  clearBuffers(): void {
    this.#buffers.stdout = []
    this.#buffers.stderr = []
    logger.debug(`Buffers cleared`)
  }

  /**
   * Writes data to stdin
   * @param data - Data to write
   */
  async write(data: string): Promise<void> {
    if (this.#destroyed) {
      throw new Error(`Cannot write to destroyed StreamManager`)
    }

    const writer = this.#stdin.writable.getWriter()
    try {
      await writer.write(new TextEncoder().encode(data))
    } finally {
      writer.releaseLock()
    }
  }

  /**
   * Writes a line to stdin (adds newline)
   * @param line - Line to write
   */
  async writeLine(line: string): Promise<void> {
    await this.write(`${line}\n`)
  }

  /**
   * Ends the stdin stream
   */
  async endInput(): Promise<void> {
    if (!this.#destroyed) {
      const writer = this.#stdin.writable.getWriter()
      try {
        await writer.close()
      } catch (error) {
        logger.error(`Error closing stdin`, { error })
      } finally {
        writer.releaseLock()
      }
    }
  }

  /**
   * Destroys all streams and cleans up resources
   */
  destroy(): void {
    if (this.#destroyed) {
      return
    }

    this.#destroyed = true

    // Clean up streams
    // Note: We catch errors to prevent unhandled rejections during cleanup
    this.#stdin.writable.abort().catch(() => {})
    this.#stdout.readable.cancel().catch(() => {})
    this.#stderr.readable.cancel().catch(() => {})

    // Clear buffers
    this.#buffers.stdout = []
    this.#buffers.stderr = []

    logger.debug(`StreamManager destroyed`)
  }

  /**
   * Checks if StreamManager has been destroyed
   * @returns true if destroyed
   */
  isDestroyed(): boolean {
    return this.#destroyed
  }

  /**
   * Creates a new set of streams for command execution
   * @returns Fresh streams for a new command
   */
  createCommandStreams(): TShellStreams {
    const stdin = new TransformStream()
    const stdout = new TransformStream()
    const stderr = new TransformStream()

    return {
      stdin: stdin.readable,
      stdout: stdout.writable,
      stderr: stderr.writable,
    } as unknown as TShellStreams
  }
}

/**
 * Creates a new StreamManager instance
 * @returns Configured StreamManager
 */
export const createStreamManager = (): StreamManager => {
  return new StreamManager()
}
