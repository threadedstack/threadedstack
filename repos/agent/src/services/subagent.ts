import type {
  TSubAgentOpts,
  TSubAgentMessage,
  TSubAgentInstance,
  TSubAgentManagerOpts,
  TSubAgentSpawnResult,
  TSubAgentStatus,
} from '@TAG/types'
import type { TWasmImports } from '@TAG/types'

import { WasmBridge } from './wasm'
import { Mutex } from './mutex'
import { logger } from '@TAG/utils/logger'
import { randomUUID } from 'node:crypto'

/**
 * SubAgentManager class for managing spawned sub-agents
 * Handles lifecycle, message queuing, and concurrent execution
 */
export class SubAgentManager {
  private mutex: Mutex
  private idleTimeout: number
  private maxSubAgents: number
  private cleanupInterval: number
  private defaultQueueSize: number
  private cleanupTimer?: NodeJS.Timeout
  private subAgents = new Map<string, TSubAgentInstance>()

  constructor(opts?: TSubAgentManagerOpts) {
    this.maxSubAgents = opts?.maxSubAgents ?? 10
    this.defaultQueueSize = opts?.defaultQueueSize ?? 100
    this.cleanupInterval = opts?.cleanupInterval ?? 60000 // 1 minute
    this.idleTimeout = opts?.idleTimeout ?? 300000 // 5 minutes
    this.mutex = new Mutex({ maxLocks: this.maxSubAgents })

    // Start periodic cleanup of idle agents
    this.startCleanupTimer()
  }

  /**
   * Start periodic cleanup of idle sub-agents
   */
  private startCleanupTimer = (): void => {
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleAgents()
    }, this.cleanupInterval)
  }

  /**
   * Cleanup idle sub-agents that exceed timeout
   */
  private cleanupIdleAgents = async (): Promise<void> => {
    const now = Date.now()
    const toCleanup: string[] = []

    for (const [id, instance] of this.subAgents.entries()) {
      const idleMs = now - instance.lastActivityAt
      if (instance.state === 'idle' && idleMs > this.idleTimeout) {
        toCleanup.push(id)
      }
    }

    for (const id of toCleanup) {
      logger.info(`[SubAgentManager] Auto-cleanup idle agent: ${id}`)
      await this.terminate(id)
    }
  }

  /**
   * Check if sub-agent exists
   */
  has = (subAgentId: string): boolean => {
    return this.subAgents.has(subAgentId)
  }

  /**
   * Get sub-agent status
   */
  getStatus = (subAgentId: string): TSubAgentStatus | undefined => {
    const instance = this.subAgents.get(subAgentId)
    if (!instance) return undefined

    const now = Date.now()
    return {
      id: instance.id,
      state: instance.state,
      queueLength: instance.messageQueue.length,
      createdAt: instance.createdAt,
      lastActivityAt: instance.lastActivityAt,
      idleMs: now - instance.lastActivityAt,
    }
  }

  /**
   * Get all sub-agent statuses
   */
  getAllStatuses = (): TSubAgentStatus[] => {
    return Array.from(this.subAgents.keys())
      .map((id) => this.getStatus(id))
      .filter((status): status is TSubAgentStatus => status !== undefined)
  }

  /**
   * Spawn a new sub-agent with WASM isolation
   * @throws Error if max sub-agents reached or spawn fails
   */
  spawn = async (opts: TSubAgentOpts): Promise<TSubAgentSpawnResult> => {
    const { subAgentId, prompt, config, maxQueueSize, onToken } = opts

    // Check if sub-agent already exists
    if (this.subAgents.has(subAgentId)) {
      throw new Error(`SubAgent '${subAgentId}' already exists`)
    }

    // Check max sub-agents limit
    if (this.subAgents.size >= this.maxSubAgents) {
      throw new Error(
        `Max sub-agents (${this.maxSubAgents}) reached. Terminate existing agents first.`
      )
    }

    logger.info(`[SubAgentManager] Spawning sub-agent: ${subAgentId}`)

    // Acquire lock for initialization
    const release = await this.mutex.acquire(subAgentId)

    try {
      // Create WASM bridge for sub-agent
      const bridge = new WasmBridge({ logging: false })

      // Build WASM imports with sub-agent specific handlers
      const imports: TWasmImports = {
        onToken: (token: string) => {
          if (onToken) onToken(token)
          this.updateActivity(subAgentId)
        },
        executeShell: async (cmd: string, args: string[]) => {
          logger.warn(`[SubAgent:${subAgentId}] Shell execution blocked: ${cmd}`)
          return 'Shell execution not available in sub-agent context'
        },
        readFile: async (path: string) => {
          logger.warn(`[SubAgent:${subAgentId}] File read blocked: ${path}`)
          return ''
        },
        writeFile: async (path: string, content: string) => {
          logger.warn(`[SubAgent:${subAgentId}] File write blocked: ${path}`)
          return ''
        },
        listDirectory: async (path: string) => {
          logger.warn(`[SubAgent:${subAgentId}] Directory list blocked: ${path}`)
          return []
        },
        deleteFile: async (path: string) => {
          logger.warn(`[SubAgent:${subAgentId}] File delete blocked: ${path}`)
          return ''
        },
        createDirectory: async (path: string) => {
          logger.warn(`[SubAgent:${subAgentId}] Directory create blocked: ${path}`)
          return ''
        },
        fileExists: async (path: string) => {
          return false
        },
        getFileStats: async (path: string) => {
          return ''
        },
        webSearch: (query: string) => {
          logger.warn(`[SubAgent:${subAgentId}] Web search blocked: ${query}`)
          return 'Web search not available in sub-agent context'
        },
        executeCustomTool: async (toolName: string, argsJson: string) => {
          logger.warn(`[SubAgent:${subAgentId}] Custom tool blocked: ${toolName}`)
          return 'Custom tools not available in sub-agent context'
        },
        config: {
          SUB_AGENT_ID: subAgentId,
          PARENT_AGENT: 'true',
        },
        vfsMounts: {},
      }

      // Initialize WASM instance
      const instance = await bridge.init(imports)

      // Create sub-agent instance
      const now = Date.now()
      const subAgentInstance: TSubAgentInstance = {
        id: subAgentId,
        state: 'ready',
        instance,
        config,
        messageQueue: [],
        maxQueueSize: maxQueueSize ?? this.defaultQueueSize,
        createdAt: now,
        lastActivityAt: now,
        onToken,
      }

      this.subAgents.set(subAgentId, subAgentInstance)
      logger.info(`[SubAgentManager] Sub-agent spawned successfully: ${subAgentId}`)

      // Process initial prompt
      await this.sendMessage(subAgentId, {
        id: randomUUID(),
        type: 'prompt',
        content: prompt,
        timestamp: Date.now(),
      })

      return {
        subAgentId,
        state: subAgentInstance.state,
        createdAt: subAgentInstance.createdAt,
      }
    } catch (error) {
      logger.error(`[SubAgentManager] Failed to spawn sub-agent: ${subAgentId}`, error)
      this.subAgents.delete(subAgentId)
      throw new Error(
        `Failed to spawn sub-agent '${subAgentId}': ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      release()
    }
  }

  /**
   * Update last activity timestamp
   */
  private updateActivity = (subAgentId: string): void => {
    const instance = this.subAgents.get(subAgentId)
    if (instance) {
      instance.lastActivityAt = Date.now()
    }
  }

  /**
   * Send message to sub-agent (queues message for processing)
   */
  sendMessage = async (
    subAgentId: string,
    message: Omit<TSubAgentMessage, 'id' | 'timestamp'> & {
      id?: string
      timestamp?: number
    }
  ): Promise<void> => {
    const instance = this.subAgents.get(subAgentId)
    if (!instance) {
      throw new Error(`SubAgent '${subAgentId}' not found`)
    }

    if (instance.state === 'terminated') {
      throw new Error(`SubAgent '${subAgentId}' is terminated`)
    }

    // Check queue size limit
    if (instance.messageQueue.length >= instance.maxQueueSize) {
      throw new Error(
        `SubAgent '${subAgentId}' message queue full (${instance.maxQueueSize})`
      )
    }

    // Create message with defaults
    const fullMessage: TSubAgentMessage = {
      id: message.id ?? randomUUID(),
      timestamp: message.timestamp ?? Date.now(),
      type: message.type,
      content: message.content,
      metadata: message.metadata,
    }

    // Add to queue
    instance.messageQueue.push(fullMessage)
    this.updateActivity(subAgentId)

    logger.info(
      `[SubAgentManager] Message queued for ${subAgentId}: ${fullMessage.type} (queue: ${instance.messageQueue.length})`
    )

    // Process queue if agent is idle
    if (instance.state === 'idle' || instance.state === 'ready') {
      await this.processQueue(subAgentId)
    }
  }

  /**
   * Process message queue for sub-agent
   */
  private processQueue = async (subAgentId: string): Promise<void> => {
    const instance = this.subAgents.get(subAgentId)
    if (!instance || instance.messageQueue.length === 0) return

    // Acquire lock to ensure serial processing
    const release = await this.mutex.acquire(subAgentId)

    try {
      instance.state = 'processing'

      while (instance.messageQueue.length > 0) {
        const message = instance.messageQueue.shift()
        if (!message) break

        logger.info(
          `[SubAgentManager] Processing message for ${subAgentId}: ${message.type}`
        )

        try {
          await instance.instance.prompt(message.content)
          this.updateActivity(subAgentId)
        } catch (error) {
          logger.error(
            `[SubAgentManager] Error processing message for ${subAgentId}`,
            error
          )
          instance.state = 'error'
          throw error
        }
      }

      instance.state = 'idle'
    } finally {
      release()
    }
  }

  /**
   * Retrieve messages from sub-agent queue (peek without removing)
   */
  receiveMessage = (subAgentId: string, count: number = 1): TSubAgentMessage[] => {
    const instance = this.subAgents.get(subAgentId)
    if (!instance) {
      throw new Error(`SubAgent '${subAgentId}' not found`)
    }

    return instance.messageQueue.slice(0, count)
  }

  /**
   * Get queue length for sub-agent
   */
  getQueueLength = (subAgentId: string): number => {
    const instance = this.subAgents.get(subAgentId)
    return instance ? instance.messageQueue.length : 0
  }

  /**
   * Terminate a sub-agent and cleanup resources
   */
  terminate = async (subAgentId: string): Promise<void> => {
    const instance = this.subAgents.get(subAgentId)
    if (!instance) {
      logger.warn(
        `[SubAgentManager] Attempted to terminate non-existent agent: ${subAgentId}`
      )
      return
    }

    logger.info(`[SubAgentManager] Terminating sub-agent: ${subAgentId}`)

    // Acquire lock for cleanup
    const release = await this.mutex.acquire(subAgentId)

    try {
      // Update state
      instance.state = 'terminated'

      // Clear message queue
      instance.messageQueue = []

      // Remove from active sub-agents
      this.subAgents.delete(subAgentId)

      logger.info(`[SubAgentManager] Sub-agent terminated: ${subAgentId}`)
    } finally {
      release()
    }
  }

  /**
   * Terminate all sub-agents
   */
  terminateAll = async (): Promise<void> => {
    logger.info(`[SubAgentManager] Terminating all ${this.subAgents.size} sub-agents`)

    const ids = Array.from(this.subAgents.keys())
    await Promise.all(ids.map((id) => this.terminate(id)))

    logger.info(`[SubAgentManager] All sub-agents terminated`)
  }

  /**
   * Get number of active sub-agents
   */
  getActiveCount = (): number => {
    return this.subAgents.size
  }

  /**
   * Cleanup manager resources
   */
  cleanup = async (): Promise<void> => {
    logger.info(`[SubAgentManager] Cleaning up manager`)

    // Stop cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }

    // Terminate all sub-agents
    await this.terminateAll()

    // Clear mutex locks
    this.mutex.clearAll()

    logger.info(`[SubAgentManager] Manager cleanup complete`)
  }
}
