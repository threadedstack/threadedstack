import type { TShellStreams } from '@TAG/types'
import type { Readable, Writable } from 'node:stream'

import { PassThrough } from 'node:stream'
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
  #stdin: Writable
  #stdout: Readable
  #stderr: Readable
  #destroyed = false
  #buffers: TStreamBuffers = {
    stdout: [],
    stderr: [],
  }

  constructor() {
    // Create pass-through streams for I/O
    this.#stdin = new PassThrough()
    this.#stdout = new PassThrough()
    this.#stderr = new PassThrough()

    // Set up buffering for stdout
    this.#stdout.on(`data`, (chunk) => {
      if (!this.#destroyed) {
        const text = chunk.toString()
        this.#buffers.stdout.push(text)
        logger.debug(`stdout:`, text.trim())
      }
    })

    // Set up buffering for stderr
    this.#stderr.on(`data`, (chunk) => {
      if (!this.#destroyed) {
        const text = chunk.toString()
        this.#buffers.stderr.push(text)
        logger.debug(`stderr:`, text.trim())
      }
    })

    // Handle stream errors
    this.#stdin.on(`error`, (error) => {
      logger.error(`stdin error`, { error })
    })

    this.#stdout.on(`error`, (error) => {
      logger.error(`stdout error`, { error })
    })

    this.#stderr.on(`error`, (error) => {
      logger.error(`stderr error`, { error })
    })
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
  write(data: string): void {
    if (this.#destroyed) {
      throw new Error(`Cannot write to destroyed StreamManager`)
    }

    this.#stdin.write(data)
  }

  /**
   * Writes a line to stdin (adds newline)
   * @param line - Line to write
   */
  writeLine(line: string): void {
    this.write(`${line}\n`)
  }

  /**
   * Ends the stdin stream
   */
  endInput(): void {
    if (!this.#destroyed) {
      this.#stdin.end()
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

    // Remove all listeners
    this.#stdin.removeAllListeners()
    this.#stdout.removeAllListeners()
    this.#stderr.removeAllListeners()

    // Destroy streams
    this.#stdin.destroy()
    this.#stdout.destroy()
    this.#stderr.destroy()

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
    return {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
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
