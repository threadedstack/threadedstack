import type { TExecutorOpts } from '@TAG/types'
import { spawnSync } from 'node:child_process'
import { AllowedCommands, BlockedPatterns } from '@TAG/constants/values'

/**
 * Executor class for secure shell command execution
 * Implements strict security validation with allowlist and blocklist patterns
 */
export class Executor {
  private timeout: number
  private allowedCommands: Set<string>
  private blockedPatterns: RegExp[]

  constructor(opts?: TExecutorOpts) {
    this.timeout = opts?.timeout ?? 10000
    this.allowedCommands = opts?.allowedCommands ?? AllowedCommands
    this.blockedPatterns = opts?.blockedPatterns ?? BlockedPatterns
  }

  /**
   * Execute a command with strict security validation
   * @throws Error if command or args fail security checks
   */
  exec = async (cmd: string, args: string[], projectDir: string): Promise<string> => {
    // Security Check 1: Command Allowlist
    if (!this.allowedCommands.has(cmd)) {
      throw new Error(`SECURITY: Command '${cmd}' denied. Not in allowlist.`)
    }

    // Security Check 2: Argument Pattern Blocking
    for (const arg of args) {
      for (const pattern of this.blockedPatterns) {
        if (pattern.test(arg)) {
          throw new Error(`SECURITY: Arg '${arg}' matches blocked pattern ${pattern}.`)
        }
      }
    }

    // Execute with strict isolation
    const result = spawnSync(cmd, args, {
      cwd: projectDir, // Strict directory isolation
      shell: false, // No shell expansion (critical!)
      encoding: 'utf-8',
      timeout: this.timeout,
      env: {
        PATH: process.env.PATH, // Minimal environment
        HOME: '/data', // Sandbox home directory
      },
    })

    if (result.error) {
      throw new Error(`Execution Error: ${result.error.message}`)
    }

    return result.stdout || result.stderr || 'Command completed with no output'
  }

  /**
   * Add a command to the allowlist
   */
  allowCommand = (cmd: string): void => {
    this.allowedCommands.add(cmd)
  }

  /**
   * Remove a command from the allowlist
   */
  disallowCommand = (cmd: string): void => {
    this.allowedCommands.delete(cmd)
  }

  /**
   * Add a blocked pattern
   */
  addBlockedPattern = (pattern: RegExp): void => {
    this.blockedPatterns.push(pattern)
  }
}
