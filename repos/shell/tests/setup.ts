/**
 * Vitest Test Setup
 * Configures global test environment for both jsdom and node
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest'

// Platform detection for environment-specific setup
const isBrowser = typeof window !== 'undefined'
const isNode = !isBrowser

// Global test utilities
global.testUtils = {
  isBrowser,
  isNode,
  platform: process.platform,
}

// Mock console methods to reduce noise in tests
const originalConsole = { ...console }
beforeAll(() => {
  global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }
})

afterAll(() => {
  global.console = originalConsole
})

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks()
})

// Browser-specific setup (jsdom environment)
if (isBrowser) {
  // Setup IndexedDB for jsdom - must be synchronous at module load time
  beforeAll(async () => {
    if (!globalThis.indexedDB) {
      const { IDBFactory } = await import('fake-indexeddb')
      globalThis.indexedDB = new IDBFactory()
    }
  })

  // Mock Web Workers for jsdom
  if (!globalThis.Worker) {
    class WorkerMock {
      url: string
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror: ((event: ErrorEvent) => void) | null = null

      constructor(url: string) {
        this.url = url
      }

      postMessage(data: any) {
        // Mock response
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage(new MessageEvent('message', { data }))
          }
        }, 0)
      }

      terminate() {
        // Cleanup mock
      }
    }

    globalThis.Worker = WorkerMock as any
  }
}

// Node-specific setup
if (isNode) {
  // Crypto is already available in Node.js, no need to mock
  // Just ensure it's accessible
  if (!global.crypto) {
    const nodeCrypto = require('node:crypto')
    Object.defineProperty(global, 'crypto', {
      value: {
        getRandomValues: (arr: any) => nodeCrypto.randomFillSync(arr),
      },
      configurable: true,
    })
  }
}

// Shared test helpers
export const createMockShellConfig = () => ({
  logger: {
    label: 'TDSK - Shell Test',
    level: 'error',
  },
})

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const createMockReadableStream = (data: string) => {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(data))
      controller.close()
    },
  })
}

export const createMockWritableStream = () => {
  const chunks: Uint8Array[] = []
  const stream = new WritableStream({
    write(chunk) {
      chunks.push(chunk)
    },
  })

  return {
    stream,
    getOutput: () => new TextDecoder().decode(Buffer.concat(chunks)),
    chunks,
  }
}

// Declare global test utilities type
declare global {
  var testUtils: {
    isBrowser: boolean
    isNode: boolean
    platform: string
  }
}
