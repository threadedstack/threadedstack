import type { TShellStreams } from '@TAG/types'

import { logger } from '@TAG/wasm/logger'

export type TStreamBuffers = {
  stdout: string[]
  stderr: string[]
}

/**
 * StreamManager handles I/O streams for shell execution
 * Provides stdin/stdout/stderr streams with buffering using Web Streams API
 */
export class StreamManager {
  #stdin: WritableStream<Uint8Array>
  #stdinWriter: WritableStreamDefaultWriter<Uint8Array> | null = null
  #stdout: ReadableStream<Uint8Array>
  #stderr: ReadableStream<Uint8Array>
  #destroyed = false
  #buffers: TStreamBuffers = {
    stdout: [],
    stderr: [],
  }
  #abortController: AbortController

  constructor() {
    this.#abortController = new AbortController()

    // Create stdin as a writable stream
    const stdinTransform = new TransformStream<Uint8Array, Uint8Array>()
    this.#stdin = stdinTransform.writable

    // Create stdout with buffering
    const stdoutTransform = new TransformStream<Uint8Array, Uint8Array>({
      transform: (chunk, controller) => {
        if (!this.#destroyed) {
          const text = new TextDecoder().decode(chunk)
          this.#buffers.stdout.push(text)
          logger.debug(`stdout:`, text.trim())
          controller.enqueue(chunk)
        }
      },
    })
    this.#stdout = stdoutTransform.readable

    // Create stderr with buffering
    const stderrTransform = new TransformStream<Uint8Array, Uint8Array>({
      transform: (chunk, controller) => {
        if (!this.#destroyed) {
          const text = new TextDecoder().decode(chunk)
          this.#buffers.stderr.push(text)
          logger.debug(`stderr:`, text.trim())
          controller.enqueue(chunk)
        }
      },
    })
    this.#stderr = stderrTransform.readable
  }

  /**
   * Gets all I/O streams
   * @returns Object containing stdin, stdout, stderr streams
   */
  getStreams(): TShellStreams {
    if (this.#destroyed) {
      throw new Error(`StreamManager has been destroyed`)
    }

    return {
      stdin: this.#stdin,
      stdout: this.#stdout,
      stderr: this.#stderr,
    }
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

    if (!this.#stdinWriter) {
      this.#stdinWriter = this.#stdin.getWriter()
    }

    const encoder = new TextEncoder()
    await this.#stdinWriter.write(encoder.encode(data))
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
    if (!this.#destroyed && this.#stdinWriter) {
      await this.#stdinWriter.close()
      this.#stdinWriter = null
    }
  }

  /**
   * Destroys all streams and cleans up resources
   */
  async destroy(): Promise<void> {
    if (this.#destroyed) {
      return
    }

    this.#destroyed = true
    this.#abortController.abort()

    // Close stdin writer if open
    if (this.#stdinWriter) {
      try {
        await this.#stdinWriter.close()
      } catch (error) {
        logger.error(`Error closing stdin writer`, { error })
      }
      this.#stdinWriter = null
    }

    // Cancel streams
    try {
      await this.#stdout.cancel()
    } catch (error) {
      logger.error(`Error canceling stdout`, { error })
    }

    try {
      await this.#stderr.cancel()
    } catch (error) {
      logger.error(`Error canceling stderr`, { error })
    }

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
    const stdinTransform = new TransformStream<Uint8Array, Uint8Array>()
    const stdoutTransform = new TransformStream<Uint8Array, Uint8Array>()
    const stderrTransform = new TransformStream<Uint8Array, Uint8Array>()

    return {
      stdin: stdinTransform.writable,
      stdout: stdoutTransform.readable,
      stderr: stderrTransform.readable,
    }
  }
}

/**
 * Creates a new StreamManager instance
 * @returns Configured StreamManager
 */
export const createStreamManager = (): StreamManager => {
  return new StreamManager()
}
