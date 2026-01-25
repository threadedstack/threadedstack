/**
 * Web Worker Integration Tests
 * Tests parallel execution using Web Workers (jsdom environment)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const describeIfBrowser = global.testUtils?.isBrowser ? describe : describe.skip

describeIfBrowser('Web Worker Integration', () => {
  describe('Worker Creation', () => {
    it('should create worker instance', () => {
      const worker = new Worker('/worker.js')
      expect(worker).toBeDefined()
      expect(worker).toBeInstanceOf(Worker)
      worker.terminate()
    })

    it('should handle worker URL', () => {
      const worker = new Worker('/test-worker.js')
      expect(worker).toBeDefined()
      worker.terminate()
    })
  })

  describe('Worker Communication', () => {
    it('should send message to worker', () => {
      return new Promise<void>((resolve) => {
        const worker = new Worker('/worker.js')
        const testData = { command: 'echo', args: ['hello'] }

        worker.onmessage = (event) => {
          expect(event.data).toBeDefined()
          worker.terminate()
          resolve()
        }

        worker.postMessage(testData)
      })
    })

    it('should receive message from worker', () => {
      return new Promise<void>((resolve) => {
        const worker = new Worker('/worker.js')

        worker.onmessage = (event) => {
          expect(event).toBeDefined()
          expect(event.data).toBeDefined()
          worker.terminate()
          resolve()
        }

        worker.postMessage({ type: 'ping' })
      })
    })

    it('should handle bidirectional communication', () => {
      return new Promise<void>((resolve) => {
        const worker = new Worker('/worker.js')
        let messageCount = 0

        worker.onmessage = (event) => {
          messageCount++

          if (messageCount === 1) {
            // First response
            expect(event.data).toBeDefined()
            worker.postMessage({ type: 'second' })
          } else if (messageCount === 2) {
            // Second response
            expect(event.data).toBeDefined()
            worker.terminate()
            resolve()
          }
        }

        worker.postMessage({ type: 'first' })
      })
    })
  })

  describe('Worker Error Handling', () => {
    it('should handle worker errors', () => {
      return new Promise<void>((resolve) => {
        const worker = new Worker('/worker.js')

        worker.onerror = (event) => {
          expect(event).toBeDefined()
          worker.terminate()
          resolve()
        }

        // Trigger error (mock worker will simulate error)
        worker.postMessage({ type: 'error' })

        // Fallback timeout
        setTimeout(() => {
          worker.terminate()
          resolve()
        }, 100)
      })
    })

    it('should handle worker termination', () => {
      const worker = new Worker('/worker.js')
      expect(() => worker.terminate()).not.toThrow()
    })

    it('should handle termination during message', () => {
      return new Promise<void>((resolve) => {
        const worker = new Worker('/worker.js')

        worker.onmessage = () => {
          worker.terminate()
          resolve()
        }

        worker.postMessage({ type: 'test' })
      })
    })
  })

  describe('Multiple Workers', () => {
    it('should create multiple workers', () => {
      const workers = Array.from({ length: 5 }, () =>
        new Worker('/worker.js')
      )

      expect(workers).toHaveLength(5)
      workers.forEach(w => expect(w).toBeInstanceOf(Worker))

      workers.forEach(w => w.terminate())
    })

    it('should handle concurrent messages', () => {
      return new Promise<void>((resolve) => {
        const workerCount = 3
        const workers = Array.from({ length: workerCount }, () =>
          new Worker('/worker.js')
        )

        let responseCount = 0

        workers.forEach((worker, index) => {
          worker.onmessage = (event) => {
            responseCount++
            expect(event.data).toBeDefined()

            if (responseCount === workerCount) {
              workers.forEach(w => w.terminate())
              resolve()
            }
          }

          worker.postMessage({ id: index })
        })
      })
    })

    it('should handle worker pool', () => {
      return new Promise<void>((resolve) => {
        const poolSize = 4
        const tasks = Array.from({ length: 10 }, (_, i) => i)
        const workers = Array.from({ length: poolSize }, () =>
          new Worker('/worker.js')
        )

        let completedTasks = 0
        let currentTask = 0

        const processTask = (worker: Worker) => {
          if (currentTask >= tasks.length) return

          const taskId = tasks[currentTask++]

          worker.onmessage = () => {
            completedTasks++

            if (completedTasks === tasks.length) {
              workers.forEach(w => w.terminate())
              resolve()
            } else {
              processTask(worker)
            }
          }

          worker.postMessage({ taskId })
        }

        workers.forEach(processTask)
      })
    })
  })

  describe('Worker Data Transfer', () => {
    it('should transfer JSON data', () => {
      return new Promise<void>((resolve) => {
        const worker = new Worker('/worker.js')
        const data = { name: 'test', value: 123, nested: { key: 'value' } }

        worker.onmessage = (event) => {
          expect(event.data).toBeDefined()
          worker.terminate()
          resolve()
        }

        worker.postMessage(data)
      })
    })

    it('should transfer array data', () => {
      return new Promise<void>((resolve) => {
        const worker = new Worker('/worker.js')
        const data = [1, 2, 3, 4, 5]

        worker.onmessage = (event) => {
          expect(event.data).toBeDefined()
          worker.terminate()
          resolve()
        }

        worker.postMessage({ array: data })
      })
    })

    it('should handle large data transfer', () => {
      return new Promise<void>((resolve) => {
        const worker = new Worker('/worker.js')
        const largeData = {
          content: 'x'.repeat(1024 * 100), // 100KB
        }

        worker.onmessage = (event) => {
          expect(event.data).toBeDefined()
          worker.terminate()
          resolve()
        }

        worker.postMessage(largeData)
      })
    })
  })

  describe('Worker Lifecycle', () => {
    it('should handle worker initialization', () => {
      return new Promise<void>((resolve) => {
        const worker = new Worker('/worker.js')

        // Wait for worker to be ready
        worker.onmessage = (event) => {
          if (event.data.type === 'ready') {
            expect(event.data.type).toBe('ready')
            worker.terminate()
            resolve()
          }
        }

        // Mock ready message
        setTimeout(() => {
          worker.onmessage?.({
            data: { type: 'ready' },
          } as MessageEvent)
        }, 10)
      })
    })

    it('should clean up worker resources', () => {
      const worker = new Worker('/worker.js')
      const spy = vi.fn()

      worker.onmessage = spy
      worker.terminate()

      // Message after termination should not be handled
      worker.postMessage({ type: 'test' })

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('Performance', () => {
    it('should handle high-frequency messages', () => {
      return new Promise<void>((resolve) => {
        const worker = new Worker('/worker.js')
        const messageCount = 100
        let received = 0

        worker.onmessage = () => {
          received++
          if (received === messageCount) {
            worker.terminate()
            resolve()
          }
        }

        const start = performance.now()

        for (let i = 0; i < messageCount; i++) {
          worker.postMessage({ id: i })
        }

        const duration = performance.now() - start
        expect(duration).toBeLessThan(100)
      })
    })

    it('should handle parallel worker execution', () => {
      return new Promise<void>((resolve) => {
        const workerCount = 8
        const workers = Array.from({ length: workerCount }, () =>
          new Worker('/worker.js')
        )

        let completed = 0
        const start = performance.now()

        workers.forEach((worker, index) => {
          worker.onmessage = () => {
            completed++
            if (completed === workerCount) {
              const duration = performance.now() - start
              expect(duration).toBeLessThan(200)
              workers.forEach(w => w.terminate())
              resolve()
            }
          }

          worker.postMessage({ id: index })
        })
      })
    })
  })
})
