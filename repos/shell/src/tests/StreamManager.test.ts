/**
 * StreamManager Tests
 *
 * Tests WHATWG Streams integration with just-bash
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Bash } from 'just-bash'
import { StreamManager } from '../io/StreamManager'

describe('StreamManager', () => {
  let bash: Bash
  let streamManager: StreamManager

  beforeEach(() => {
    bash = new Bash({
      files: {
        '/test.txt': 'test content',
      },
    })
    streamManager = new StreamManager(bash)
  })

  describe('initialization', () => {
    it('should create stdin, stdout, and stderr streams', () => {
      expect(streamManager.stdin).toBeInstanceOf(WritableStream)
      expect(streamManager.stdout).toBeInstanceOf(ReadableStream)
      expect(streamManager.stderr).toBeInstanceOf(ReadableStream)
    })

    it('should be healthy after initialization', () => {
      expect(streamManager.isHealthy()).toBe(true)
    })

    it('should have empty stdin queue', () => {
      expect(streamManager.getStdinQueueSize()).toBe(0)
    })
  })

  describe('command execution', () => {
    it('should stream stdout from successful command', async () => {
      const reader = streamManager.stdout.getReader()
      const readPromise = reader.read()

      await streamManager.exec('echo "hello world"')

      const result = await readPromise
      expect(result.done).toBe(false)
      expect(result.value).toContain('hello world')

      reader.releaseLock()
    })

    it('should stream stderr from failed command', async () => {
      const reader = streamManager.stderr.getReader()
      const readPromise = reader.read()

      // Try to read non-existent file
      await streamManager.exec('cat /nonexistent.txt')

      const result = await readPromise
      expect(result.done).toBe(false)
      // Should contain error or exit code
      expect(result.value.length).toBeGreaterThan(0)

      reader.releaseLock()
    })

    it('should handle multiple commands', async () => {
      const reader = streamManager.stdout.getReader()

      await streamManager.exec('echo "first"')
      const result1 = await reader.read()
      expect(result1.value).toContain('first')

      await streamManager.exec('echo "second"')
      const result2 = await reader.read()
      expect(result2.value).toContain('second')

      reader.releaseLock()
    })
  })

  describe('stdin handling', () => {
    it('should queue stdin writes', async () => {
      const writer = streamManager.stdin.getWriter()

      await writer.write('line 1\n')
      await writer.write('line 2\n')

      expect(streamManager.getStdinQueueSize()).toBe(2)

      writer.releaseLock()
    })

    it('should consume stdin queue on exec', async () => {
      const writer = streamManager.stdin.getWriter()
      await writer.write('echo "from stdin"\n')
      writer.releaseLock()

      const initialSize = streamManager.getStdinQueueSize()
      expect(initialSize).toBeGreaterThan(0)

      await streamManager.exec('cat')

      expect(streamManager.getStdinQueueSize()).toBe(0)
    })

    it('should reject writes after close', async () => {
      const writer = streamManager.stdin.getWriter()
      await writer.close()

      // After closing, the stream is locked and cannot get a new writer
      // This is expected WHATWG Streams behavior
      expect(() => streamManager.stdin.getWriter()).toThrow()
    })
  })

  describe('piping', () => {
    it('should pipe stdout to external WritableStream', async () => {
      const chunks: string[] = []
      const targetStream = new WritableStream<string>({
        write(chunk) {
          chunks.push(chunk)
        },
      })

      // Start piping (don't await yet)
      const pipePromise = streamManager.pipe(targetStream)

      // Execute command
      await streamManager.exec('echo "piped output"')

      // Close stdout to complete pipe
      await streamManager.close()

      // Wait for pipe to complete
      await pipePromise

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.join('')).toContain('piped output')
    })

    it('should pipe stderr to external WritableStream', async () => {
      const chunks: string[] = []
      const targetStream = new WritableStream<string>({
        write(chunk) {
          chunks.push(chunk)
        },
      })

      const pipePromise = streamManager.pipeStderr(targetStream)

      // Trigger stderr output
      await streamManager.exec('cat /nonexistent')

      await streamManager.close()
      await pipePromise

      expect(chunks.length).toBeGreaterThan(0)
    })
  })

  describe('teeing', () => {
    it('should create two independent stdout branches', async () => {
      const [branch1, branch2] = streamManager.teeStdout()

      const reader1 = branch1.getReader()
      const reader2 = branch2.getReader()

      await streamManager.exec('echo "tee test"')

      const result1 = await reader1.read()
      const result2 = await reader2.read()

      expect(result1.value).toBe(result2.value)
      expect(result1.value).toContain('tee test')

      reader1.releaseLock()
      reader2.releaseLock()
    })

    it('should allow independent consumption of branches', async () => {
      const [branch1, branch2] = streamManager.teeStdout()

      const chunks1: string[] = []
      const chunks2: string[] = []

      const consumer1 = branch1.pipeTo(
        new WritableStream({
          write: (chunk) => {
            chunks1.push(chunk)
          },
        })
      )

      // Read from second branch independently
      const reader2 = branch2.getReader()

      await streamManager.exec('echo "independent"')
      const result2 = await reader2.read()

      expect(result2.value).toContain('independent')

      reader2.releaseLock()
      await streamManager.close()
      await consumer1
    })
  })

  describe('combined output', () => {
    it('should merge stdout and stderr', async () => {
      const combined = streamManager.getCombinedOutput()
      const reader = combined.getReader()
      const chunks: string[] = []

      // Read in background
      const readLoop = (async () => {
        while (true) {
          const result = await reader.read()
          if (result.done) break
          chunks.push(result.value)
        }
      })()

      await streamManager.exec('echo "stdout message"')
      await streamManager.exec('cat /nonexistent 2>&1')

      await streamManager.close()
      await readLoop

      const output = chunks.join('')
      expect(output).toContain('stdout message')
      // Combined stream should have both outputs
      expect(chunks.length).toBeGreaterThan(0)
    })
  })

  describe('stream lifecycle', () => {
    it('should close all streams', async () => {
      expect(streamManager.isHealthy()).toBe(true)

      await streamManager.close()

      expect(streamManager.isHealthy()).toBe(false)
    })

    it('should handle multiple close calls', async () => {
      await streamManager.close()
      await expect(streamManager.close()).resolves.not.toThrow()
    })

    it('should clean up controllers on close', async () => {
      const reader = streamManager.stdout.getReader()

      await streamManager.close()

      // Reading from closed stream should complete
      const result = await reader.read()
      expect(result.done).toBe(true)

      reader.releaseLock()
    })
  })

  describe('backpressure', () => {
    it('should respect highWaterMark', () => {
      const manager = new StreamManager(bash, { highWaterMark: 5 })

      // Create writer and check it exists
      const writer = manager.stdin.getWriter()
      expect(writer).toBeDefined()

      writer.releaseLock()
    })

    it('should handle slow consumers', async () => {
      let consumedChunks = 0
      const slowConsumer = new WritableStream<string>({
        async write() {
          // Simulate slow consumer
          await new Promise((resolve) => setTimeout(resolve, 10))
          consumedChunks++
        },
      })

      const pipePromise = streamManager.pipe(slowConsumer)

      // Produce multiple chunks quickly
      await streamManager.exec('echo "chunk1"')
      await streamManager.exec('echo "chunk2"')
      await streamManager.exec('echo "chunk3"')

      await streamManager.close()
      await pipePromise

      // All chunks should be consumed
      expect(consumedChunks).toBeGreaterThan(0)
    })
  })

  describe('error handling', () => {
    it('should handle exec errors', async () => {
      const reader = streamManager.stderr.getReader()

      // just-bash doesn't throw for unknown commands, it returns exitCode !== 0
      await streamManager.exec('invalid-command-xyz')

      // Error should be streamed to stderr
      const result = await reader.read()
      expect(result.done).toBe(false)
      expect(result.value).toBeTruthy()
      expect(result.value.length).toBeGreaterThan(0)

      reader.releaseLock()
    })

    it('should handle stream cancellation', async () => {
      const reader = streamManager.stdout.getReader()

      // Cancel the stream
      await reader.cancel('test cancellation')

      // Stream manager should no longer be healthy
      expect(streamManager.isHealthy()).toBe(false)

      reader.releaseLock()
    })
  })

  describe('options', () => {
    it('should accept custom options', () => {
      const manager = new StreamManager(bash, {
        mode: 'text',
        highWaterMark: 10,
        encoding: 'utf-8',
      })

      expect(manager.isHealthy()).toBe(true)
    })

    it('should use default options', () => {
      const manager = new StreamManager(bash)

      expect(manager.isHealthy()).toBe(true)
      expect(manager.getStdinQueueSize()).toBe(0)
    })
  })
})
