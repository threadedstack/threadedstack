import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Shell } from '../../src/Shell'
import { EPlatform } from '../../src/types'

describe('Shell', () => {
  let shell: Shell

  afterEach(async () => {
    if (shell?.isInitialized()) {
      await shell.destroy()
    }
  })

  describe('Constructor', () => {
    it('should create a Shell instance with default options', () => {
      shell = new Shell()
      expect(shell).toBeInstanceOf(Shell)
      expect(shell.isInitialized()).toBe(false)
    })

    it('should create a Shell instance with custom options', () => {
      shell = new Shell({
        homeDir: '/custom/home',
        persistent: false,
        verbose: true,
      })
      expect(shell).toBeInstanceOf(Shell)
      expect(shell.isInitialized()).toBe(false)
    })

    it('should detect platform on construction', () => {
      shell = new Shell()
      const platform = shell.getPlatform()
      expect(Object.values(EPlatform)).toContain(platform)
    })
  })

  describe('Platform Detection', () => {
    it('should detect Node.js platform', () => {
      shell = new Shell()
      const platform = shell.getPlatform()
      // In test environment, should be Node
      expect(platform).toBe(EPlatform.Node)
    })

    it('should return consistent platform', () => {
      shell = new Shell()
      const platform1 = shell.getPlatform()
      const platform2 = shell.getPlatform()
      expect(platform1).toBe(platform2)
    })
  })

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      shell = new Shell()
      await shell.initialize()
      expect(shell.isInitialized()).toBe(true)
    })

    it('should not re-initialize if already initialized', async () => {
      shell = new Shell()
      await shell.initialize()
      const firstState = shell.getState()

      await shell.initialize()
      const secondState = shell.getState()

      expect(firstState.initialized).toBe(true)
      expect(secondState.initialized).toBe(true)
    })

    it('should set up filesystem and streams', async () => {
      shell = new Shell()
      await shell.initialize()

      const streams = shell.getStreams()
      expect(streams.stdin).toBeDefined()
      expect(streams.stdout).toBeDefined()
      expect(streams.stderr).toBeDefined()
    })

    it('should have correct home directory', async () => {
      shell = new Shell()
      await shell.initialize()

      const homeDir = shell.getHomeDir()
      expect(homeDir).toBeDefined()
      expect(typeof homeDir).toBe('string')
      expect(homeDir.length).toBeGreaterThan(0)
    })
  })

  describe('Command Execution', () => {
    beforeEach(async () => {
      shell = new Shell()
      await shell.initialize()
    })

    it('should execute simple echo command', async () => {
      const result = await shell.execute('echo "Hello, World!"')
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Hello, World!')
      expect(result.command).toBe('echo "Hello, World!"')
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('should throw error if shell not initialized', async () => {
      const uninitializedShell = new Shell()
      await expect(uninitializedShell.execute('echo test')).rejects.toThrow(
        'Shell not initialized'
      )
    })

    it('should throw error for empty command', async () => {
      await expect(shell.execute('')).rejects.toThrow('Command cannot be empty')
    })

    it('should handle command with non-zero exit code', async () => {
      const result = await shell.execute('exit 1')
      expect(result.exitCode).not.toBe(0)
    })

    it('should capture stdout', async () => {
      const result = await shell.execute('echo "test output"')
      expect(result.stdout).toContain('test output')
    })

    it('should increment execution count', async () => {
      const initialCount = shell.getExecutionCount()

      await shell.execute('echo "test1"')
      await shell.execute('echo "test2"')
      await shell.execute('echo "test3"')

      const finalCount = shell.getExecutionCount()
      expect(finalCount).toBe(initialCount + 3)
    })

    it('should track execution duration', async () => {
      const result = await shell.execute('echo "test"')
      expect(result.duration).toBeGreaterThanOrEqual(0)
      expect(typeof result.duration).toBe('number')
    })
  })

  describe('Directory Operations', () => {
    beforeEach(async () => {
      shell = new Shell()
      await shell.initialize()
    })

    it('should get current working directory', async () => {
      const pwd = await shell.pwd()
      expect(pwd).toBeDefined()
      expect(typeof pwd).toBe('string')
      expect(pwd.length).toBeGreaterThan(0)
    })

    it('should change directory', async () => {
      await shell.execute('mkdir -p /home/test')
      await shell.cd('/home/test')
      const pwd = await shell.pwd()
      expect(pwd).toContain('test')
    })

    it('should create directories', async () => {
      const result = await shell.execute('mkdir -p /home/workspace/nested')
      expect(result.exitCode).toBe(0)

      const lsResult = await shell.execute('ls /home/workspace')
      expect(lsResult.stdout).toContain('nested')
    })
  })

  describe('State Management', () => {
    beforeEach(async () => {
      shell = new Shell()
      await shell.initialize()
    })

    it('should return current state', () => {
      const state = shell.getState()
      expect(state.initialized).toBe(true)
      expect(state.platform).toBeDefined()
      expect(state.homeDir).toBeDefined()
      expect(state.executionCount).toBeDefined()
    })

    it('should return immutable state', () => {
      const state1 = shell.getState()
      const state2 = shell.getState()
      expect(state1).not.toBe(state2) // Different objects
      expect(state1).toEqual(state2) // Same values
    })
  })

  describe('Streams', () => {
    beforeEach(async () => {
      shell = new Shell()
      await shell.initialize()
    })

    it('should provide access to streams', () => {
      const streams = shell.getStreams()
      expect(streams.stdin).toBeDefined()
      expect(streams.stdout).toBeDefined()
      expect(streams.stderr).toBeDefined()
    })

    it('should throw error if getting streams before initialization', () => {
      const uninitializedShell = new Shell()
      expect(() => uninitializedShell.getStreams()).toThrow('Shell not initialized')
    })
  })

  describe('Reset', () => {
    beforeEach(async () => {
      shell = new Shell()
      await shell.initialize()
    })

    it('should reset shell state', async () => {
      await shell.execute('echo "test1"')
      await shell.execute('echo "test2"')
      const countBefore = shell.getExecutionCount()
      expect(countBefore).toBe(2)

      await shell.reset()

      const countAfter = shell.getExecutionCount()
      expect(countAfter).toBe(0)
      expect(shell.isInitialized()).toBe(true)
    })

    it('should allow execution after reset', async () => {
      await shell.reset()
      const result = await shell.execute('echo "after reset"')
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('after reset')
    })
  })

  describe('Destroy', () => {
    beforeEach(async () => {
      shell = new Shell()
      await shell.initialize()
    })

    it('should destroy shell successfully', async () => {
      await shell.destroy()
      expect(shell.isInitialized()).toBe(false)
    })

    it('should handle multiple destroy calls gracefully', async () => {
      await shell.destroy()
      await shell.destroy()
      expect(shell.isInitialized()).toBe(false)
    })

    it('should not allow execution after destroy', async () => {
      await shell.destroy()
      await expect(shell.execute('echo test')).rejects.toThrow('Shell not initialized')
    })
  })

  describe('Error Handling', () => {
    beforeEach(async () => {
      shell = new Shell()
      await shell.initialize()
    })

    it('should handle command not found gracefully', async () => {
      const result = await shell.execute('nonexistent-command-xyz')
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr.length).toBeGreaterThan(0)
    })

    it('should handle invalid syntax', async () => {
      const result = await shell.execute('if [')
      expect(result.exitCode).not.toBe(0)
    })
  })

  describe('Verbose Mode', () => {
    it('should support verbose logging', async () => {
      const verboseShell = new Shell({ verbose: true })
      await verboseShell.initialize()

      const result = await verboseShell.execute('echo "verbose test"')
      expect(result.exitCode).toBe(0)

      await verboseShell.destroy()
    })
  })
})
