/**
 * End-to-End Integration Tests
 * Tests complete shell workflows and component integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Shell } from '../../src/Shell'
import { configure, fs } from '@zenfs/core'
import { InMemory } from '@zenfs/core/backends/memory'
import type { TShellCfg } from '../../src/types'

describe('Shell Integration', () => {
  let shell: Shell
  let config: TShellCfg

  beforeEach(async () => {
    // Initialize filesystem
    await configure({
      mounts: {
        '/': { backend: InMemory, name: 'memory' },
      },
    })

    config = {
      logger: {
        label: 'TDSK - Shell Integration Test',
        level: 'error',
      },
    }

    shell = new Shell(config)
  })

  afterEach(async () => {
    // Cleanup
    try {
      await fs.promises.rm('/', { recursive: true, force: true })
    } catch (err) {
      // Ignore cleanup errors
    }
  })

  describe('Shell Initialization', () => {
    it('should initialize shell with filesystem', async () => {
      expect(shell).toBeDefined()
      expect(shell).toBeInstanceOf(Shell)

      // Verify filesystem is accessible
      await fs.promises.mkdir('/test')
      const stat = await fs.promises.stat('/test')
      expect(stat.isDirectory()).toBe(true)
    })

    it('should handle multiple shell instances', () => {
      const shell1 = new Shell(config)
      const shell2 = new Shell(config)

      expect(shell1).not.toBe(shell2)
      expect(shell1).toBeInstanceOf(Shell)
      expect(shell2).toBeInstanceOf(Shell)
    })
  })

  describe('File System Integration', () => {
    it('should perform complete file lifecycle', async () => {
      const testPath = '/lifecycle.txt'
      const content = 'Test content'

      // Create
      await fs.promises.writeFile(testPath, content)

      // Read
      const readContent = await fs.promises.readFile(testPath, 'utf8')
      expect(readContent).toBe(content)

      // Update
      await fs.promises.writeFile(testPath, 'Updated content')
      const updated = await fs.promises.readFile(testPath, 'utf8')
      expect(updated).toBe('Updated content')

      // Delete
      await fs.promises.unlink(testPath)

      await expect(
        fs.promises.stat(testPath)
      ).rejects.toThrow()
    })

    it('should handle directory operations', async () => {
      // Create directory structure
      await fs.promises.mkdir('/project', { recursive: true })
      await fs.promises.mkdir('/project/src', { recursive: true })
      await fs.promises.mkdir('/project/tests', { recursive: true })

      // Add files
      await fs.promises.writeFile('/project/src/index.ts', 'export {}')
      await fs.promises.writeFile('/project/tests/index.test.ts', 'describe()')

      // List contents
      const srcFiles = await fs.promises.readdir('/project/src')
      expect(srcFiles).toContain('index.ts')

      const testFiles = await fs.promises.readdir('/project/tests')
      expect(testFiles).toContain('index.test.ts')

      // Clean up
      await fs.promises.rm('/project', { recursive: true })
    })

    it('should handle nested directory operations', async () => {
      const basePath = '/deep/nested/structure'
      await fs.promises.mkdir(basePath, { recursive: true })

      const filePath = `${basePath}/file.txt`
      await fs.promises.writeFile(filePath, 'Deep content')

      const content = await fs.promises.readFile(filePath, 'utf8')
      expect(content).toBe('Deep content')
    })
  })

  describe('Stream Integration', () => {
    it('should integrate streams with filesystem', async () => {
      const testPath = '/stream-test.txt'
      const data = 'Stream data content'

      // Create readable stream
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(data))
          controller.close()
        },
      })

      // Collect stream data
      const chunks: Uint8Array[] = []
      const writable = new WritableStream({
        write(chunk) {
          chunks.push(chunk)
        },
      })

      await readable.pipeTo(writable)

      // Write collected data to filesystem
      const buffer = Buffer.concat(chunks)
      await fs.promises.writeFile(testPath, buffer)

      // Verify
      const content = await fs.promises.readFile(testPath, 'utf8')
      expect(content).toBe(data)
    })

    it('should handle stream transformations with filesystem', async () => {
      const testPath = '/transformed.txt'
      const input = 'lowercase text'

      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(input))
          controller.close()
        },
      })

      const transform = new TransformStream({
        transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk)
          const upper = text.toUpperCase()
          controller.enqueue(new TextEncoder().encode(upper))
        },
      })

      const chunks: Uint8Array[] = []
      const writable = new WritableStream({
        write(chunk) {
          chunks.push(chunk)
        },
      })

      await readable.pipeThrough(transform).pipeTo(writable)

      await fs.promises.writeFile(testPath, Buffer.concat(chunks))

      const content = await fs.promises.readFile(testPath, 'utf8')
      expect(content).toBe('LOWERCASE TEXT')
    })
  })

  describe('Error Recovery', () => {
    it('should recover from filesystem errors', async () => {
      // Attempt invalid operation
      await expect(
        fs.promises.readFile('/nonexistent.txt')
      ).rejects.toThrow()

      // Verify shell is still functional
      await fs.promises.writeFile('/recovery.txt', 'recovered')
      const content = await fs.promises.readFile('/recovery.txt', 'utf8')
      expect(content).toBe('recovered')
    })

    it('should handle concurrent operation errors', async () => {
      const operations = Array.from({ length: 10 }, async (_, i) => {
        try {
          if (i % 2 === 0) {
            await fs.promises.writeFile(`/file${i}.txt`, `content${i}`)
          } else {
            // Intentional error
            await fs.promises.readFile(`/nonexistent${i}.txt`)
          }
        } catch (err) {
          // Expected errors for odd indices
        }
      })

      await Promise.allSettled(operations)

      // Verify successful operations completed
      const files = await fs.promises.readdir('/')
      const successfulFiles = files.filter(f => f.startsWith('file'))
      expect(successfulFiles.length).toBeGreaterThan(0)
    })
  })

  describe('Performance Integration', () => {
    it('should handle end-to-end workflow efficiently', async () => {
      const start = performance.now()

      // Create directory structure
      await fs.promises.mkdir('/project/src', { recursive: true })

      // Write multiple files (sequentially to work around ZenFS race conditions)
      for (let i = 0; i < 50; i++) {
        await fs.promises.writeFile(`/project/src/file${i}.ts`, `export const value${i} = ${i}`)
      }

      // Read all files
      const files = await fs.promises.readdir('/project/src')
      const readOps = files.map(file =>
        fs.promises.readFile(`/project/src/${file}`, 'utf8')
      )
      const contents = await Promise.all(readOps)

      // Clean up
      await fs.promises.rm('/project', { recursive: true })

      const duration = performance.now() - start

      expect(contents).toHaveLength(50)
      expect(duration).toBeLessThan(500)
    })

    it('should maintain performance with large files', async () => {
      const largeContent = 'x'.repeat(1024 * 1024) // 1MB

      const start = performance.now()

      await fs.promises.writeFile('/large.txt', largeContent)
      const content = await fs.promises.readFile('/large.txt', 'utf8')

      const duration = performance.now() - start

      expect(content.length).toBe(largeContent.length)
      expect(duration).toBeLessThan(200)
    })
  })

  describe('Cross-Platform Compatibility', () => {
    it('should work in current environment', () => {
      const platform = global.testUtils.platform
      expect(platform).toBeDefined()

      // Shell should work regardless of platform
      expect(shell).toBeInstanceOf(Shell)
    })

    it('should handle platform-specific paths', async () => {
      // Use forward slashes (POSIX-style) which work everywhere
      const path = '/platform/test/file.txt'

      await fs.promises.mkdir('/platform/test', { recursive: true })
      await fs.promises.writeFile(path, 'cross-platform')

      const content = await fs.promises.readFile(path, 'utf8')
      expect(content).toBe('cross-platform')
    })
  })

  describe('Resource Management', () => {
    it('should handle resource cleanup', async () => {
      // Create resources
      await fs.promises.mkdir('/resources', { recursive: true })

      for (let i = 0; i < 10; i++) {
        await fs.promises.writeFile(`/resources/file${i}.txt`, `content${i}`)
      }

      // Clean up
      await fs.promises.rm('/resources', { recursive: true })

      // Verify cleanup
      await expect(
        fs.promises.stat('/resources')
      ).rejects.toThrow()
    })

    it('should handle memory efficiently with many operations', async () => {
      const initialMemory = process.memoryUsage?.().heapUsed || 0

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await fs.promises.writeFile(`/temp${i}.txt`, `content${i}`)
        await fs.promises.readFile(`/temp${i}.txt`, 'utf8')
        await fs.promises.unlink(`/temp${i}.txt`)
      }

      const finalMemory = process.memoryUsage?.().heapUsed || 0
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    })
  })
})
