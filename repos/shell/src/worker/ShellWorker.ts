/**
 * Shell Worker Manager
 * Manages communication with the shell web worker from the main thread
 */

import type {
  WorkerRequest,
  WorkerResponse,
  InitializeRequest,
  InitializeResponse,
  ExecuteRequest,
  ExecuteResponse,
  StreamData,
  ShellStatus,
  SetEnvRequest,
  GetEnvRequest,
  EnvResponse,
} from './types'

export type StreamCallback = (data: StreamData) => void

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

/**
 * Shell Worker Manager
 * Provides a typed API for interacting with the shell worker
 */
export class ShellWorker {
  private worker: Worker | null = null
  private pendingRequests = new Map<string, PendingRequest>()
  private streamCallbacks = new Set<StreamCallback>()
  private requestCounter = 0
  private initialized = false

  /**
   * Create a new shell worker instance
   */
  constructor() {
    // Worker will be created during initialize()
  }

  /**
   * Initialize the shell worker
   */
  async initialize(config?: InitializeRequest['config']): Promise<void> {
    if (this.initialized) {
      throw new Error('Worker already initialized')
    }

    // Create worker instance
    // Vite will handle the ?worker import automatically
    this.worker = new Worker(new URL('./shell.worker.ts', import.meta.url), {
      type: 'module',
    })

    // Set up message handler
    this.worker.onmessage = this.handleMessage.bind(this)

    // Set up error handler
    this.worker.onerror = (error) => {
      console.error('Worker error:', error)
      this.rejectAllPending(new Error(`Worker error: ${error.message}`))
    }

    // Initialize the shell
    const response = await this.sendRequest<InitializeResponse>('initialize', { config })

    if (!response.success) {
      throw new Error('Failed to initialize shell worker')
    }

    this.initialized = true
  }

  /**
   * Execute a command in the shell
   */
  async execute(
    command: string,
    options?: ExecuteRequest['options']
  ): Promise<ExecuteResponse> {
    this.ensureInitialized()

    return this.sendRequest<ExecuteResponse>('execute', {
      command,
      options,
    })
  }

  /**
   * Get current shell status
   */
  async getStatus(): Promise<ShellStatus> {
    this.ensureInitialized()
    return this.sendRequest<ShellStatus>('getStatus')
  }

  /**
   * Set environment variables
   */
  async setEnv(variables: Record<string, string>): Promise<void> {
    this.ensureInitialized()
    await this.sendRequest('setEnv', { variables })
  }

  /**
   * Get environment variables
   */
  async getEnv(keys?: string[]): Promise<Record<string, string>> {
    this.ensureInitialized()
    const response = await this.sendRequest<EnvResponse>('getEnv', {
      keys,
    })
    return response.variables
  }

  /**
   * Subscribe to stream data
   */
  onStream(callback: StreamCallback): () => void {
    this.streamCallbacks.add(callback)

    // Return unsubscribe function
    return () => {
      this.streamCallbacks.delete(callback)
    }
  }

  /**
   * Terminate the worker
   */
  async terminate(): Promise<void> {
    if (!this.worker) {
      return
    }

    try {
      // Send terminate message
      await this.sendRequest('terminate')
    } catch (error) {
      // Ignore errors during termination
    } finally {
      // Terminate the worker
      this.worker.terminate()
      this.worker = null
      this.initialized = false

      // Reject all pending requests
      this.rejectAllPending(new Error('Worker terminated'))

      // Clear callbacks
      this.streamCallbacks.clear()
    }
  }

  /**
   * Check if worker is ready
   */
  isReady(): boolean {
    return this.initialized && this.worker !== null
  }

  /**
   * Send a request to the worker
   */
  private sendRequest<T>(type: WorkerRequest['type'], payload?: unknown): Promise<T> {
    if (!this.worker) {
      return Promise.reject(new Error('Worker not initialized'))
    }

    return new Promise((resolve, reject) => {
      const id = `${++this.requestCounter}`

      // Store pending request
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      })

      // Send message to worker
      const request: WorkerRequest = {
        id,
        type,
        payload,
      }

      this.worker!.postMessage(request)

      // Set timeout for request
      setTimeout(() => {
        const pending = this.pendingRequests.get(id)
        if (pending) {
          this.pendingRequests.delete(id)
          pending.reject(new Error('Request timeout'))
        }
      }, 30000) // 30 second timeout
    })
  }

  /**
   * Handle messages from worker
   */
  private handleMessage(event: MessageEvent<WorkerResponse>): void {
    const response = event.data

    // Handle stream messages
    if (response.type === 'stream') {
      const streamData = response.payload as StreamData
      for (const callback of this.streamCallbacks) {
        try {
          callback(streamData)
        } catch (error) {
          console.error('Stream callback error:', error)
        }
      }
      return
    }

    // Handle request responses
    const pending = this.pendingRequests.get(response.id)
    if (!pending) {
      console.warn('Received response for unknown request:', response.id)
      return
    }

    this.pendingRequests.delete(response.id)

    if (response.type === 'error') {
      pending.reject(new Error(response.error || 'Unknown error'))
    } else {
      pending.resolve(response.payload)
    }
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPending(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      pending.reject(error)
    }
    this.pendingRequests.clear()
  }

  /**
   * Ensure worker is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.worker) {
      throw new Error('Worker not initialized. Call initialize() first.')
    }
  }
}

/**
 * Create a new shell worker instance
 */
export function createShellWorker(): ShellWorker {
  return new ShellWorker()
}
