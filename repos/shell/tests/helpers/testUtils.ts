/**
 * Test Utilities and Helper Functions
 * Shared utilities for shell testing
 */

import type { TShellCfg } from '../../src/types'

/**
 * Creates a mock shell configuration for testing
 */
export const createTestConfig = (overrides?: Partial<TShellCfg>): TShellCfg => {
  return {
    logger: {
      label: 'TDSK - Shell Test',
      level: 'error',
    },
    ...overrides,
  }
}

/**
 * Sleep utility for async tests
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Creates a mock readable stream with test data
 */
export const createTestReadableStream = (data: string): ReadableStream<Uint8Array> => {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(data))
      controller.close()
    },
  })
}

/**
 * Creates a mock writable stream that collects data
 */
export const createTestWritableStream = () => {
  const chunks: Uint8Array[] = []

  const stream = new WritableStream({
    write(chunk) {
      chunks.push(chunk)
    },
  })

  return {
    stream,
    getOutput: () => new TextDecoder().decode(Buffer.concat(chunks)),
    getChunks: () => chunks,
  }
}

/**
 * Waits for a condition to be true
 */
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> => {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await sleep(interval)
  }

  throw new Error('Timeout waiting for condition')
}

/**
 * Measures execution time of an async function
 */
export const measureTime = async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start

  return { result, duration }
}

/**
 * Generates random test data
 */
export const generateRandomData = (size: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''

  for (let i = 0; i < size; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return result
}

/**
 * Creates a test file structure
 */
export const createTestFileStructure = async (
  fs: any,
  structure: Record<string, string>
): Promise<void> => {
  for (const [path, content] of Object.entries(structure)) {
    const dir = path.substring(0, path.lastIndexOf('/'))
    if (dir) {
      await fs.promises.mkdir(dir, { recursive: true })
    }
    await fs.promises.writeFile(path, content)
  }
}

/**
 * Compares two buffers
 */
export const buffersEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }

  return true
}

/**
 * Creates a test worker (mock implementation)
 */
export const createTestWorker = () => {
  if (typeof Worker === 'undefined') {
    throw new Error('Worker not available in this environment')
  }

  return new Worker('/test-worker.js')
}

/**
 * Platform detection helpers
 */
export const platform = {
  isNode: typeof process !== 'undefined' && process.versions?.node != null,
  isBrowser: typeof window !== 'undefined',
  isBun: typeof Bun !== 'undefined',
  current: process.platform,
}

/**
 * Memory snapshot helper
 */
export const getMemorySnapshot = () => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage()
  }

  // Browser environment
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    return (performance as any).memory
  }

  return null
}

/**
 * Retry helper for flaky operations
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 100
): Promise<T> => {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err as Error
      if (attempt < maxAttempts) {
        await sleep(delayMs * attempt)
      }
    }
  }

  throw lastError
}

/**
 * Creates a temporary directory name
 */
export const createTempDir = (): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `/tmp-${timestamp}-${random}`
}

/**
 * Validates test environment
 */
export const validateTestEnvironment = () => {
  const checks = {
    hasReadableStream: typeof ReadableStream !== 'undefined',
    hasWritableStream: typeof WritableStream !== 'undefined',
    hasTransformStream: typeof TransformStream !== 'undefined',
    hasTextEncoder: typeof TextEncoder !== 'undefined',
    hasTextDecoder: typeof TextDecoder !== 'undefined',
    hasBuffer: typeof Buffer !== 'undefined',
    hasPerformance: typeof performance !== 'undefined',
  }

  return checks
}
