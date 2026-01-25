import type { Readable, Writable } from 'node:stream'
import { PassThrough } from 'node:stream'
import type { TShellStreams } from '@TSH/types'
import { logger } from '@TSH/utils/logger'

/**
 * StreamManager handles I/O streams for shell execution
 * Provides stdin/stdout/stderr streams with buffering and event handling
 */
export class StreamManager {
  private _stdin: Writable
  private _stdout: Readable
  private _stderr: Readable
  private _stdoutBuffer: string[] = []
  private _stderrBuffer: string[] = []
  private _isDestroyed = false

  constructor() {
    // Create pass-through streams for I/O
    this._stdin = new PassThrough()
    this._stdout = new PassThrough()
    this._stderr = new PassThrough()

    // Set up buffering for stdout
    this._stdout.on('data', (chunk) => {
      if (!this._isDestroyed) {
        const text = chunk.toString()
        this._stdoutBuffer.push(text)
        logger.debug('stdout:', text.trim())
      }
    })

    // Set up buffering for stderr
    this._stderr.on('data', (chunk) => {
      if (!this._isDestroyed) {
        const text = chunk.toString()
        this._stderrBuffer.push(text)
        logger.debug('stderr:', text.trim())
      }
    })

    // Handle stream errors
    this._stdin.on('error', (error) => {
      logger.error('stdin error', { error })
    })

    this._stdout.on('error', (error) => {
      logger.error('stdout error', { error })
    })

    this._stderr.on('error', (error) => {
      logger.error('stderr error', { error })
    })
  }

  /**
   * Gets all I/O streams
   * @returns Object containing stdin, stdout, stderr streams
   */
  getStreams(): TShellStreams {
    if (this._isDestroyed) {
      throw new Error('StreamManager has been destroyed')
    }

    return {
      stdin: this._stdin,
      stdout: this._stdout,
      stderr: this._stderr,
    }
  }

  /**
   * Gets the current stdout buffer content
   * @returns Concatenated stdout content
   */
  getStdout(): string {
    return this._stdoutBuffer.join('')
  }

  /**
   * Gets the current stderr buffer content
   * @returns Concatenated stderr content
   */
  getStderr(): string {
    return this._stderrBuffer.join('')
  }

  /**
   * Clears all buffered output
   */
  clearBuffers(): void {
    this._stdoutBuffer = []
    this._stderrBuffer = []
    logger.debug('Buffers cleared')
  }

  /**
   * Writes data to stdin
   * @param data - Data to write
   */
  write(data: string): void {
    if (this._isDestroyed) {
      throw new Error('Cannot write to destroyed StreamManager')
    }

    this._stdin.write(data)
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
    if (!this._isDestroyed) {
      this._stdin.end()
    }
  }

  /**
   * Destroys all streams and cleans up resources
   */
  destroy(): void {
    if (this._isDestroyed) {
      return
    }

    this._isDestroyed = true

    // Remove all listeners
    this._stdin.removeAllListeners()
    this._stdout.removeAllListeners()
    this._stderr.removeAllListeners()

    // Destroy streams
    this._stdin.destroy()
    this._stdout.destroy()
    this._stderr.destroy()

    // Clear buffers
    this._stdoutBuffer = []
    this._stderrBuffer = []

    logger.debug('StreamManager destroyed')
  }

  /**
   * Checks if StreamManager has been destroyed
   * @returns true if destroyed
   */
  isDestroyed(): boolean {
    return this._isDestroyed
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
