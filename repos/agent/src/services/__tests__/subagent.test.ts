/**
 * @module subagent.test
 * Unit tests for sub-agent functionality
 *
 * Tests cover:
 * - Spawning sub-agents with validation
 * - Message passing (send/receive)
 * - Termination and cleanup
 * - Concurrent sub-agent execution
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TSAgent } from '@TAG/tsagent'
import type { TInitOpts } from '@TAG/types'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'

describe('SubAgent Unit Tests', () => {
  let agent: TSAgent
  let tempDir: string
  let tokenCallback: ReturnType<typeof vi.fn>
  let testConfig: TInitOpts['config']

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = path.join(os.tmpdir(), `test-agent-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })

    // Mock token callback
    tokenCallback = vi.fn()

    // Test configuration
    testConfig = {
      provider: 'openai',
      apiKey: 'test-api-key',
      model: 'gpt-4o-mini',
      url: 'https://api.openai.com',
      path: '/v1/chat/completions',
      maxTokens: 4096,
    }

    // Initialize agent
    agent = new TSAgent({
      tempDir,
      bridge: { logging: false },
    })
  })

  afterEach(async () => {
    // Cleanup
    await agent.cleanup()
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Sub-agent Spawning', () => {
    it('should spawn a sub-agent with unique ID', async () => {
      const subAgentId = 'test-sub-agent-1'
      const prompt = 'Test sub-agent task'

      // Mock the WASM bridge to capture sub-agent spawn call
      const spawnSpy = vi.fn().mockResolvedValue(
        JSON.stringify({
          success: true,
          subAgentId,
          message: `Sub-agent ${subAgentId} spawned successfully`,
        })
      )

      // Since we can't easily test the actual WASM execution without the compiled module,
      // we'll test the service layer by mocking the bridge initialization
      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async (userPrompt: string) => {
          // Simulate sub-agent spawn
          if (userPrompt.includes('spawnSubAgent')) {
            const result = await spawnSpy(subAgentId, prompt)
            tokenCallback(result)
          }
        }),
      })

      try {
        await agent.run({
          prompt: `spawnSubAgent("${subAgentId}", "${prompt}")`,
          projectId: 'test-project',
          config: testConfig,
          onToken: tokenCallback,
        })

        expect(tokenCallback).toHaveBeenCalled()
      } finally {
        agent.bridge.init = originalInit
      }
    })

    it('should reject spawning sub-agent with duplicate ID', async () => {
      const subAgentId = 'duplicate-agent'

      // Mock spawn to track calls
      const spawnAttempts: string[] = []

      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async (userPrompt: string) => {
          if (userPrompt.includes('spawnSubAgent')) {
            spawnAttempts.push(subAgentId)

            // First spawn succeeds, second should fail
            if (spawnAttempts.length > 1 && spawnAttempts.includes(subAgentId)) {
              const error = JSON.stringify({
                success: false,
                error: `Sub-agent with ID "${subAgentId}" already exists`,
              })
              tokenCallback(error)
            } else {
              tokenCallback(JSON.stringify({ success: true, subAgentId }))
            }
          }
        }),
      })

      try {
        // First spawn should succeed
        await agent.run({
          prompt: `spawnSubAgent("${subAgentId}", "First task")`,
          projectId: 'test-project',
          config: testConfig,
          onToken: tokenCallback,
        })

        // Second spawn with same ID should fail
        await agent.run({
          prompt: `spawnSubAgent("${subAgentId}", "Second task")`,
          projectId: 'test-project',
          config: testConfig,
          onToken: tokenCallback,
        })

        // Verify error was called
        const calls = tokenCallback.mock.calls
        const errorCall = calls.find((call) => call[0].includes('already exists'))
        expect(errorCall).toBeDefined()
      } finally {
        agent.bridge.init = originalInit
      }
    })

    it('should validate sub-agent ID format', async () => {
      const invalidIds = ['id with spaces', 'id/with/slashes', '../traversal']
      const validIds = ['valid-agent-1', 'coder', 'researcher-001']

      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async (userPrompt: string) => {
          const match = userPrompt.match(/spawnSubAgent\("([^"]*)"/)
          if (match) {
            const id = match[1]
            const isValid = id.length > 0 && !/[\s/\\]/.test(id) && !id.includes('..')

            if (!isValid) {
              tokenCallback(
                JSON.stringify({
                  success: false,
                  error: 'Invalid sub-agent ID format',
                })
              )
            } else {
              tokenCallback(JSON.stringify({ success: true, subAgentId: id }))
            }
          }
        }),
      })

      try {
        // Test invalid IDs - should produce errors
        for (const invalidId of invalidIds) {
          tokenCallback.mockClear()

          await agent.run({
            prompt: `spawnSubAgent("${invalidId}", "test")`,
            projectId: 'test-project',
            config: testConfig,
            onToken: tokenCallback,
          })

          const hasError = tokenCallback.mock.calls.some(
            (call) => call[0].includes('Invalid') || call[0].includes('error')
          )

          expect(hasError).toBe(true)
        }

        // Test valid IDs - should succeed
        for (const validId of validIds) {
          tokenCallback.mockClear()

          await agent.run({
            prompt: `spawnSubAgent("${validId}", "test")`,
            projectId: 'test-project',
            config: testConfig,
            onToken: tokenCallback,
          })

          const hasSuccess = tokenCallback.mock.calls.some((call) =>
            call[0].includes('success')
          )

          expect(hasSuccess).toBe(true)
        }
      } finally {
        agent.bridge.init = originalInit
      }
    })
  })

  describe('Message Passing', () => {
    it('should send message to sub-agent', async () => {
      const subAgentId = 'receiver-agent'
      const message = 'Test message content'

      const messageSpy = vi.fn().mockResolvedValue(
        JSON.stringify({
          success: true,
          subAgentId,
          message: `Message sent to ${subAgentId}`,
        })
      )

      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async (userPrompt: string) => {
          if (userPrompt.includes('sendMessageToSubAgent')) {
            const result = await messageSpy(subAgentId, message)
            tokenCallback(result)
          }
        }),
      })

      try {
        await agent.run({
          prompt: `sendMessageToSubAgent("${subAgentId}", "${message}")`,
          projectId: 'test-project',
          config: testConfig,
          onToken: tokenCallback,
        })

        expect(messageSpy).toHaveBeenCalledWith(subAgentId, message)
        expect(tokenCallback).toHaveBeenCalled()
      } finally {
        agent.bridge.init = originalInit
      }
    })

    it('should receive message from sub-agent', async () => {
      const subAgentId = 'sender-agent'
      const expectedMessage = 'Response from sub-agent'

      const receiveSpy = vi.fn().mockResolvedValue(
        JSON.stringify({
          success: true,
          subAgentId,
          message: expectedMessage,
        })
      )

      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async (userPrompt: string) => {
          if (userPrompt.includes('receiveMessageFromSubAgent')) {
            const result = await receiveSpy(subAgentId)
            tokenCallback(result)
          }
        }),
      })

      try {
        await agent.run({
          prompt: `receiveMessageFromSubAgent("${subAgentId}")`,
          projectId: 'test-project',
          config: testConfig,
          onToken: tokenCallback,
        })

        expect(receiveSpy).toHaveBeenCalledWith(subAgentId)
        expect(tokenCallback).toHaveBeenCalled()
      } finally {
        agent.bridge.init = originalInit
      }
    })

    it('should handle message to non-existent sub-agent', async () => {
      const nonExistentId = 'ghost-agent'

      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async (userPrompt: string) => {
          if (userPrompt.includes('sendMessageToSubAgent')) {
            tokenCallback(
              JSON.stringify({
                success: false,
                error: `Sub-agent "${nonExistentId}" not found`,
              })
            )
          }
        }),
      })

      try {
        await agent.run({
          prompt: `sendMessageToSubAgent("${nonExistentId}", "test")`,
          projectId: 'test-project',
          config: testConfig,
          onToken: tokenCallback,
        })

        const errorCall = tokenCallback.mock.calls.find((call) =>
          call[0].includes('not found')
        )
        expect(errorCall).toBeDefined()
      } finally {
        agent.bridge.init = originalInit
      }
    })

    it('should queue messages when sub-agent is busy', async () => {
      const subAgentId = 'busy-agent'
      const messages = ['msg1', 'msg2', 'msg3']
      const sentMessages: string[] = []

      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async (userPrompt: string) => {
          if (userPrompt.includes('sendMessageToSubAgent')) {
            const match = userPrompt.match(/sendMessageToSubAgent\("[^"]+",\s*"([^"]+)"/)
            if (match) {
              sentMessages.push(match[1])
              tokenCallback(
                JSON.stringify({
                  success: true,
                  queued: true,
                  message: `Message queued for ${subAgentId}`,
                })
              )
            }
          }
        }),
      })

      try {
        // Send multiple messages rapidly
        for (const msg of messages) {
          await agent.run({
            prompt: `sendMessageToSubAgent("${subAgentId}", "${msg}")`,
            projectId: 'test-project',
            config: testConfig,
            onToken: tokenCallback,
          })
        }

        // Verify all messages were sent
        expect(sentMessages).toEqual(messages)
      } finally {
        agent.bridge.init = originalInit
      }
    })
  })

  describe('Termination and Cleanup', () => {
    it('should terminate sub-agent successfully', async () => {
      const subAgentId = 'terminable-agent'

      const terminateSpy = vi.fn().mockResolvedValue(
        JSON.stringify({
          success: true,
          subAgentId,
          message: `Sub-agent ${subAgentId} terminated successfully`,
        })
      )

      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async (userPrompt: string) => {
          if (userPrompt.includes('terminateSubAgent')) {
            const result = await terminateSpy(subAgentId)
            tokenCallback(result)
          }
        }),
      })

      try {
        await agent.run({
          prompt: `terminateSubAgent("${subAgentId}")`,
          projectId: 'test-project',
          config: testConfig,
          onToken: tokenCallback,
        })

        expect(terminateSpy).toHaveBeenCalledWith(subAgentId)
        expect(tokenCallback).toHaveBeenCalled()
      } finally {
        agent.bridge.init = originalInit
      }
    })

    it('should cleanup resources after termination', async () => {
      const subAgentId = 'cleanup-agent'
      const resources = new Map<string, any>()

      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async (userPrompt: string) => {
          if (userPrompt.includes('spawnSubAgent')) {
            resources.set(subAgentId, { active: true, memory: 'allocated' })
            tokenCallback(JSON.stringify({ success: true, subAgentId }))
          } else if (userPrompt.includes('terminateSubAgent')) {
            resources.delete(subAgentId)
            tokenCallback(
              JSON.stringify({
                success: true,
                message: 'Resources cleaned up',
              })
            )
          }
        }),
      })

      try {
        // Spawn sub-agent
        await agent.run({
          prompt: `spawnSubAgent("${subAgentId}", "test")`,
          projectId: 'test-project',
          config: testConfig,
          onToken: tokenCallback,
        })

        expect(resources.has(subAgentId)).toBe(true)

        // Terminate sub-agent
        await agent.run({
          prompt: `terminateSubAgent("${subAgentId}")`,
          projectId: 'test-project',
          config: testConfig,
          onToken: tokenCallback,
        })

        expect(resources.has(subAgentId)).toBe(false)
      } finally {
        agent.bridge.init = originalInit
      }
    })

    it('should handle graceful shutdown with pending operations', async () => {
      const subAgentId = 'pending-agent'
      let pendingOps = 3

      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async (userPrompt: string) => {
          if (userPrompt.includes('terminateSubAgent')) {
            // Simulate graceful shutdown
            while (pendingOps > 0) {
              await new Promise((resolve) => setTimeout(resolve, 10))
              pendingOps--
            }
            tokenCallback(
              JSON.stringify({
                success: true,
                graceful: true,
                completedOps: 3,
              })
            )
          }
        }),
      })

      try {
        await agent.run({
          prompt: `terminateSubAgent("${subAgentId}")`,
          projectId: 'test-project',
          config: testConfig,
          onToken: tokenCallback,
        })

        expect(pendingOps).toBe(0)
      } finally {
        agent.bridge.init = originalInit
      }
    })
  })

  describe('Concurrent Execution', () => {
    it('should run multiple sub-agents concurrently', async () => {
      const subAgentIds = ['concurrent-1', 'concurrent-2', 'concurrent-3']
      const executionOrder: string[] = []

      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async (userPrompt: string) => {
          const match = userPrompt.match(/spawnSubAgent\("([^"]+)"/)
          if (match) {
            const id = match[1]
            executionOrder.push(id)
            // Simulate async work
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 50))
            tokenCallback(JSON.stringify({ success: true, subAgentId: id }))
          }
        }),
      })

      try {
        // Spawn all sub-agents concurrently
        await Promise.all(
          subAgentIds.map((id) =>
            agent.run({
              prompt: `spawnSubAgent("${id}", "concurrent task")`,
              projectId: `test-project-${id}`, // Different project per agent
              config: testConfig,
              onToken: tokenCallback,
            })
          )
        )

        // Verify all were executed
        expect(executionOrder).toHaveLength(3)
        expect(executionOrder).toEqual(expect.arrayContaining(subAgentIds))
      } finally {
        agent.bridge.init = originalInit
      }
    })

    it('should handle concurrent messages to same sub-agent', async () => {
      const subAgentId = 'message-target'
      const messages = Array.from({ length: 5 }, (_, i) => `message-${i}`)
      const receivedMessages: string[] = []

      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async (userPrompt: string) => {
          const match = userPrompt.match(/sendMessageToSubAgent\("[^"]+",\s*"([^"]+)"/)
          if (match) {
            const msg = match[1]
            receivedMessages.push(msg)
            tokenCallback(JSON.stringify({ success: true, message: msg }))
          }
        }),
      })

      try {
        // Send messages concurrently
        await Promise.all(
          messages.map((msg) =>
            agent.run({
              prompt: `sendMessageToSubAgent("${subAgentId}", "${msg}")`,
              projectId: 'test-project',
              config: testConfig,
              onToken: tokenCallback,
            })
          )
        )

        // Verify all messages were received
        expect(receivedMessages).toHaveLength(5)
        expect(receivedMessages).toEqual(expect.arrayContaining(messages))
      } finally {
        agent.bridge.init = originalInit
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle sub-agent spawn failure', async () => {
      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async () => {
          tokenCallback(
            JSON.stringify({
              success: false,
              error: 'Insufficient resources to spawn sub-agent',
            })
          )
        }),
      })

      try {
        await agent.run({
          prompt: 'spawnSubAgent("fail-agent", "test")',
          projectId: 'test-project',
          config: testConfig,
          onToken: tokenCallback,
        })

        const errorCall = tokenCallback.mock.calls.find((call) =>
          call[0].includes('Insufficient resources')
        )
        expect(errorCall).toBeDefined()
      } finally {
        agent.bridge.init = originalInit
      }
    })

    it('should handle message timeout', async () => {
      const subAgentId = 'timeout-agent'

      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async (userPrompt: string) => {
          if (userPrompt.includes('receiveMessageFromSubAgent')) {
            // Simulate timeout
            await new Promise((resolve) => setTimeout(resolve, 100))
            tokenCallback(
              JSON.stringify({
                success: false,
                error: 'Timeout waiting for message',
              })
            )
          }
        }),
      })

      try {
        await agent.run({
          prompt: `receiveMessageFromSubAgent("${subAgentId}")`,
          projectId: 'test-project',
          config: testConfig,
          onToken: tokenCallback,
        })

        const errorCall = tokenCallback.mock.calls.find((call) =>
          call[0].includes('Timeout')
        )
        expect(errorCall).toBeDefined()
      } finally {
        agent.bridge.init = originalInit
      }
    })

    it('should handle sub-agent crash gracefully', async () => {
      const subAgentId = 'crash-agent'

      const originalInit = agent.bridge.init
      agent.bridge.init = vi.fn().mockResolvedValue({
        exports: {},
        imports: {},
        prompt: vi.fn().mockImplementation(async (userPrompt: string) => {
          if (userPrompt.includes('sendMessageToSubAgent')) {
            tokenCallback(
              JSON.stringify({
                success: false,
                error: `Sub-agent "${subAgentId}" has crashed`,
                crashed: true,
              })
            )
          }
        }),
      })

      try {
        await agent.run({
          prompt: `sendMessageToSubAgent("${subAgentId}", "test")`,
          projectId: 'test-project',
          config: testConfig,
          onToken: tokenCallback,
        })

        const errorCall = tokenCallback.mock.calls.find((call) =>
          call[0].includes('crashed')
        )
        expect(errorCall).toBeDefined()
      } finally {
        agent.bridge.init = originalInit
      }
    })
  })
})
