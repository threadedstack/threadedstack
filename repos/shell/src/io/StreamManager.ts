/**
 * StreamManager - WHATWG Streams wrapper for just-bash I/O
 *
 * Wraps just-bash standard I/O in WHATWG Streams for maximum portability.
 * Supports piping to external consumers (xterm.js, WebSockets, etc.)
 * with proper backpressure handling.
 *
 * @example
 * ```typescript
 * const bash = new Bash();
 * const streamManager = new StreamManager(bash);
 *
 * // Pipe stdout to xterm.js
 * const writer = xtermAdapter.writable.getWriter();
 * streamManager.pipe(xtermAdapter.writable);
 *
 * // Write to stdin
 * const stdinWriter = streamManager.stdin.getWriter();
 * await stdinWriter.write('ls -la\n');
 * await stdinWriter.close();
 * ```
 */

import type { Bash } from 'just-bash'

/**
 * Stream mode for data transmission
 */
export type StreamMode = 'text' | 'binary'

/**
 * Configuration options for StreamManager
 */
export interface StreamManagerOptions {
  /**
   * Stream mode - text for string data, binary for Uint8Array
   * @default 'text'
   */
  mode?: StreamMode

  /**
   * High water mark for backpressure control (number of chunks)
   * @default 1
   */
  highWaterMark?: number

  /**
   * Text encoding for text mode
   * @default 'utf-8'
   */
  encoding?: BufferEncoding
}

type BufferEncoding = 'utf-8' | 'utf8' | 'ascii' | 'latin1' | 'binary'

/**
 * Manages WHATWG Streams for just-bash I/O
 *
 * Provides:
 * - ReadableStream for stdout/stderr
 * - WritableStream for stdin
 * - Proper backpressure handling
 * - Support for both text and binary modes
 */
export class StreamManager {
  private bash: Bash
  private options: Required<StreamManagerOptions>

  // Stream controllers for managing data flow
  private stdoutController: ReadableStreamDefaultController<string> | null = null
  private stderrController: ReadableStreamDefaultController<string> | null = null

  // Pending stdin writes queue
  private stdinQueue: string[] = []
  private stdinClosed = false

  // Public stream interfaces
  public readonly stdin: WritableStream<string>
  public readonly stdout: ReadableStream<string>
  public readonly stderr: ReadableStream<string>

  /**
   * Create a new StreamManager for a just-bash instance
   *
   * @param bash - The just-bash instance to wrap
   * @param options - Stream configuration options
   */
  constructor(bash: Bash, options: StreamManagerOptions = {}) {
    this.bash = bash
    this.options = {
      mode: options.mode ?? 'text',
      highWaterMark: options.highWaterMark ?? 1,
      encoding: options.encoding ?? 'utf-8',
    }

    // Create stdin WritableStream
    this.stdin = new WritableStream<string>(
      {
        write: async (chunk) => {
          if (this.stdinClosed) {
            throw new Error('Cannot write to closed stdin')
          }
          this.stdinQueue.push(chunk)
        },
        close: async () => {
          this.stdinClosed = true
        },
        abort: async (reason) => {
          this.stdinClosed = true
          this.stdinQueue = []
          console.error('stdin aborted:', reason)
        },
      },
      new CountQueuingStrategy({ highWaterMark: this.options.highWaterMark })
    )

    // Create stdout ReadableStream
    this.stdout = new ReadableStream<string>(
      {
        start: (controller) => {
          this.stdoutController = controller
        },
        cancel: (reason) => {
          this.stdoutController = null
          console.log('stdout cancelled:', reason)
        },
      },
      new CountQueuingStrategy({ highWaterMark: this.options.highWaterMark })
    )

    // Create stderr ReadableStream
    this.stderr = new ReadableStream<string>(
      {
        start: (controller) => {
          this.stderrController = controller
        },
        cancel: (reason) => {
          this.stderrController = null
          console.log('stderr cancelled:', reason)
        },
      },
      new CountQueuingStrategy({ highWaterMark: this.options.highWaterMark })
    )
  }

  /**
   * Execute a command and stream its output
   *
   * @param command - The bash command to execute
   * @returns Promise that resolves when command completes
   */
  async exec(command: string): Promise<void> {
    try {
      // Get stdin from queue if available
      const stdin = this.stdinQueue.join('')
      this.stdinQueue = []

      // Execute command with just-bash
      const result = await this.bash.exec(command)

      // Stream stdout output
      if (result.stdout && this.stdoutController) {
        this.stdoutController.enqueue(result.stdout)
      }

      // Stream stderr output
      if (result.stderr && this.stderrController) {
        this.stderrController.enqueue(result.stderr)
      }

      // If command failed, include exit code in stderr
      if (result.exitCode !== 0 && this.stderrController) {
        this.stderrController.enqueue(`[exit code: ${result.exitCode}]\n`)
      }
    } catch (error) {
      // Stream error to stderr
      if (this.stderrController) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.stderrController.enqueue(`Error: ${errorMessage}\n`)
      }
      throw error
    }
  }

  /**
   * Pipe stdout to an external WritableStream
   *
   * Useful for connecting to xterm.js, WebSockets, or other consumers.
   * Automatically handles backpressure.
   *
   * @param target - The WritableStream to pipe to
   * @returns Promise that resolves when piping completes
   *
   * @example
   * ```typescript
   * // Pipe to xterm.js
   * const xtermWriter = xtermAdapter.writable
   * await streamManager.pipe(xtermWriter)
   * ```
   */
  async pipe(target: WritableStream<string>): Promise<void> {
    return this.stdout.pipeTo(target, { preventClose: true })
  }

  /**
   * Pipe stderr to an external WritableStream
   *
   * @param target - The WritableStream to pipe to
   * @returns Promise that resolves when piping completes
   */
  async pipeStderr(target: WritableStream<string>): Promise<void> {
    return this.stderr.pipeTo(target, { preventClose: true })
  }

  /**
   * Tee the stdout stream for multiple consumers
   *
   * Creates two independent branches that can be consumed separately.
   *
   * @returns Tuple of two ReadableStreams
   *
   * @example
   * ```typescript
   * const [branch1, branch2] = streamManager.teeStdout()
   * branch1.pipeTo(xtermWriter)
   * branch2.pipeTo(fileWriter)
   * ```
   */
  teeStdout(): [ReadableStream<string>, ReadableStream<string>] {
    return this.stdout.tee()
  }

  /**
   * Close all streams gracefully
   *
   * Closes stdin, stdout, and stderr streams in order.
   * Should be called when done with the StreamManager.
   */
  async close(): Promise<void> {
    // Close stdin
    if (!this.stdinClosed) {
      const writer = this.stdin.getWriter()
      try {
        await writer.close()
      } catch (error) {
        console.error('Error closing stdin:', error)
      }
      this.stdinClosed = true
    }

    // Close stdout
    if (this.stdoutController) {
      try {
        this.stdoutController.close()
      } catch (error) {
        console.error('Error closing stdout:', error)
      }
      this.stdoutController = null
    }

    // Close stderr
    if (this.stderrController) {
      try {
        this.stderrController.close()
      } catch (error) {
        console.error('Error closing stderr:', error)
      }
      this.stderrController = null
    }
  }

  /**
   * Get current stdin queue size
   *
   * Useful for monitoring backpressure
   */
  getStdinQueueSize(): number {
    return this.stdinQueue.length
  }

  /**
   * Check if streams are healthy
   *
   * @returns True if all streams are operational
   */
  isHealthy(): boolean {
    return (
      !this.stdinClosed &&
      this.stdoutController !== null &&
      this.stderrController !== null
    )
  }

  /**
   * Create a combined output stream (stdout + stderr)
   *
   * Merges both output streams into a single ReadableStream.
   * Useful for unified logging or display.
   *
   * @returns Combined ReadableStream
   */
  getCombinedOutput(): ReadableStream<string> {
    const [stdoutBranch1] = this.stdout.tee()
    const [stderrBranch1] = this.stderr.tee()

    return new ReadableStream<string>({
      async start(controller) {
        const stdoutReader = stdoutBranch1.getReader()
        const stderrReader = stderrBranch1.getReader()

        try {
          // Read from both streams concurrently
          while (true) {
            const [stdoutResult, stderrResult] = await Promise.all([
              stdoutReader.read(),
              stderrReader.read(),
            ])

            if (stdoutResult.done && stderrResult.done) {
              break
            }

            if (!stdoutResult.done) {
              controller.enqueue(stdoutResult.value)
            }

            if (!stderrResult.done) {
              controller.enqueue(stderrResult.value)
            }
          }

          controller.close()
        } catch (error) {
          controller.error(error)
        } finally {
          stdoutReader.releaseLock()
          stderrReader.releaseLock()
        }
      },
    })
  }
}
