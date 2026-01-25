import { Bash } from 'just-bash'
import type { BashOptions } from 'just-bash'
import type {
  TShellOptions,
  TExecutionResult,
  TShellStreams,
  TShellState,
} from '@TSH/types'
import { EPlatform } from '@TSH/types'
import {
  logger,
  detectPlatform,
  getHomeDir,
  createFileSystem,
  validateFileSystem,
  StreamManager,
} from '@TSH/utils'

/**
 * Shell class provides a cross-platform bash execution environment
 * Supports browser (IndexedDB), Node.js, and Bun runtimes
 */
export class Shell {
  private _state: TShellState
  private _streamManager: StreamManager | null = null
  private readonly _options: Required<TShellOptions>
  private _currentWorkingDirectory: string = '/home'

  constructor(options: TShellOptions = {}) {
    // Merge options with defaults
    this._options = {
      homeDir: options.homeDir || getHomeDir(),
      persistent: options.persistent ?? true,
      bashOptions: options.bashOptions || {},
      verbose: options.verbose ?? false,
    }

    // Initialize state
    const platform = detectPlatform()
    this._state = {
      initialized: false,
      platform,
      homeDir: platform === EPlatform.Browser ? '/home' : this._options.homeDir,
      bash: null,
      executionCount: 0,
    }

    if (this._options.verbose) {
      logger.info('Shell instance created', {
        platform: this._state.platform,
        homeDir: this._state.homeDir,
        options: this._options,
      })
    }
  }

  /**
   * Initializes the shell environment
   * - Detects platform
   * - Creates appropriate filesystem
   * - Initializes just-bash kernel
   * - Sets up stream management
   */
  async initialize(): Promise<void> {
    if (this._state.initialized) {
      logger.warn('Shell already initialized')
      return
    }

    try {
      logger.info('Initializing shell', {
        platform: this._state.platform,
        homeDir: this._state.homeDir,
      })

      // Create filesystem based on platform
      const fs = await createFileSystem(
        this._state.platform,
        this._state.homeDir,
        this._options.persistent
      )

      // Validate filesystem is accessible
      const isValid = await validateFileSystem(fs)
      if (!isValid) {
        throw new Error('Filesystem validation failed')
      }

      // Initialize stream manager
      this._streamManager = new StreamManager()
      const streams = this._streamManager.getStreams()

      // Create bash options with filesystem
      const bashOptions: BashOptions = {
        fs,
        cwd: '/home',
        ...this._options.bashOptions,
      }

      // Initialize just-bash kernel
      this._state.bash = new Bash(bashOptions)
      this._state.initialized = true

      logger.info('Shell initialized successfully', {
        platform: this._state.platform,
        homeDir: this._state.homeDir,
      })
    } catch (error) {
      logger.error('Shell initialization failed', { error })
      throw new Error(`Failed to initialize shell: ${error}`)
    }
  }

  /**
   * Executes a shell command
   * @param command - Command string to execute
   * @returns Execution result with stdout, stderr, exit code, and duration
   */
  async execute(command: string): Promise<TExecutionResult> {
    if (!this._state.initialized || !this._state.bash || !this._streamManager) {
      throw new Error('Shell not initialized. Call initialize() first.')
    }

    if (!command || command.trim().length === 0) {
      throw new Error('Command cannot be empty')
    }

    const startTime = Date.now()

    try {
      logger.debug('Executing command', { command })

      // Clear previous buffers
      this._streamManager.clearBuffers()

      // Execute command through just-bash with current working directory
      const result = await this._state.bash.exec(command, {
        cwd: this._currentWorkingDirectory,
      })

      // just-bash returns stdout/stderr directly in the result
      const stdout = result.stdout
      const stderr = result.stderr
      const duration = Date.now() - startTime

      // Increment execution count
      this._state.executionCount++

      const executionResult: TExecutionResult = {
        exitCode: result.exitCode,
        stdout,
        stderr,
        command,
        duration,
      }

      if (this._options.verbose) {
        logger.info('Command executed', {
          command,
          exitCode: result.exitCode,
          duration,
        })
      }

      return executionResult
    } catch (error) {
      const duration = Date.now() - startTime
      const stderr = this._streamManager.getStderr()

      logger.error('Command execution failed', { command, error })

      return {
        exitCode: 1,
        stdout: '',
        stderr: stderr || String(error),
        command,
        duration,
      }
    }
  }

  /**
   * Gets the I/O streams for the shell
   * @returns Object containing stdin, stdout, stderr streams
   */
  getStreams(): TShellStreams {
    if (!this._streamManager) {
      throw new Error('Shell not initialized. Call initialize() first.')
    }

    return this._streamManager.getStreams()
  }

  /**
   * Gets the current shell state
   * @returns Shell state object
   */
  getState(): Readonly<TShellState> {
    return { ...this._state }
  }

  /**
   * Gets the current platform
   * @returns Platform enum value
   */
  getPlatform(): EPlatform {
    return this._state.platform
  }

  /**
   * Gets the home directory path
   * @returns Home directory path
   */
  getHomeDir(): string {
    return this._state.homeDir
  }

  /**
   * Checks if shell is initialized
   * @returns true if initialized
   */
  isInitialized(): boolean {
    return this._state.initialized
  }

  /**
   * Gets the execution count
   * @returns Number of commands executed
   */
  getExecutionCount(): number {
    return this._state.executionCount
  }

  /**
   * Destroys the shell instance and cleans up resources
   * - Destroys stream manager
   * - Clears bash instance
   * - Resets state
   */
  async destroy(): Promise<void> {
    if (!this._state.initialized) {
      logger.warn('Shell not initialized, nothing to destroy')
      return
    }

    try {
      logger.info('Destroying shell')

      // Destroy stream manager
      if (this._streamManager) {
        this._streamManager.destroy()
        this._streamManager = null
      }

      // Clear bash instance
      this._state.bash = null
      this._state.initialized = false

      logger.info('Shell destroyed successfully')
    } catch (error) {
      logger.error('Shell destruction failed', { error })
      throw new Error(`Failed to destroy shell: ${error}`)
    }
  }

  /**
   * Resets the shell to initial state
   * Useful for clearing execution history and buffers
   */
  async reset(): Promise<void> {
    logger.info('Resetting shell')

    await this.destroy()
    await this.initialize()

    this._state.executionCount = 0

    logger.info('Shell reset complete')
  }

  /**
   * Changes the current working directory
   * Note: just-bash doesn't persist cwd across exec() calls, so we maintain
   * the current working directory internally and pass it to each exec() call
   * @param path - Path to change to
   */
  async cd(path: string): Promise<void> {
    if (!this._state.initialized || !this._state.bash) {
      throw new Error('Shell not initialized. Call initialize() first.')
    }

    // Verify the directory exists and get the absolute path
    const result = await this._state.bash.exec(`cd ${path} && pwd`, {
      cwd: this._currentWorkingDirectory,
    })

    if (result.exitCode !== 0) {
      throw new Error(`Failed to change directory to ${path}: ${result.stderr}`)
    }

    // Update internal cwd to the absolute path returned by pwd
    this._currentWorkingDirectory = result.stdout.trim()

    logger.debug('Changed directory', { path: this._currentWorkingDirectory })
  }

  /**
   * Gets the current working directory
   * @returns Current working directory path
   */
  async pwd(): Promise<string> {
    if (!this._state.initialized || !this._state.bash) {
      throw new Error('Shell not initialized. Call initialize() first.')
    }

    // Return the internally tracked cwd for consistency
    return this._currentWorkingDirectory
  }
}
