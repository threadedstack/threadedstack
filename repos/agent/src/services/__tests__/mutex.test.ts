import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Mutex } from '@TAG/services/mutex'
import { wait } from '@keg-hub/jsutils/wait'

describe(`Mutex`, () => {
  let mutex: Mutex

  beforeEach(() => {
    mutex = new Mutex({ maxLocks: 10, timeout: 5000 })
  })

  describe(`Constructor`, () => {
    it(`should initialize with default values`, () => {
      const defaultMutex = new Mutex()
      expect(defaultMutex).toBeDefined()
    })

    it(`should initialize with custom values`, () => {
      const customMutex = new Mutex({ maxLocks: 20, timeout: 10000 })
      expect(customMutex).toBeDefined()
    })
  })

  describe(`acquire()`, () => {
    it(`should acquire lock for new projectId`, async () => {
      const release = await mutex.acquire(`project-1`)
      expect(release).toBeInstanceOf(Function)
      expect(mutex.getActiveLocks()).toBe(1)
    })

    it(`should queue requests for same projectId (serial execution)`, async () => {
      const executionOrder: number[] = []

      // Start three operations on same projectId
      const promise1 = mutex.acquire(`project-1`).then((release) => {
        executionOrder.push(1)
        setTimeout(release, 10)
      })

      const promise2 = mutex.acquire(`project-1`).then((release) => {
        executionOrder.push(2)
        setTimeout(release, 10)
      })

      const promise3 = mutex.acquire(`project-1`).then((release) => {
        executionOrder.push(3)
        release()
      })

      await Promise.all([promise1, promise2, promise3])

      // Should execute in order 1 -> 2 -> 3
      expect(executionOrder).toEqual([1, 2, 3])
    })

    it(`should allow parallel execution for different projectIds`, async () => {
      const release1 = await mutex.acquire(`project-1`)
      const release2 = await mutex.acquire(`project-2`)

      expect(mutex.getActiveLocks()).toBe(2)

      release1()
      release2()
    })

    it(`should clean up lock when released`, async () => {
      const release1 = await mutex.acquire(`project-1`)
      expect(mutex.getActiveLocks()).toBe(1)

      release1()

      // Wait for promise chain to resolve
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(mutex.getActiveLocks()).toBe(0)
    })

    it(`should handle multiple acquire/release cycles`, async () => {
      const projectId = `project-1`

      for (let i = 0; i < 5; i++) {
        const release = await mutex.acquire(projectId)
        expect(mutex.getActiveLocks()).toBe(1)
        release()
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      expect(mutex.getActiveLocks()).toBe(0)
    })

    it(`should maintain separate queues for different projects`, async () => {
      const project1Order: number[] = []
      const project2Order: number[] = []

      // Queue operations on project-1
      const p1a = mutex.acquire(`project-1`).then((release) => {
        project1Order.push(1)
        setTimeout(release, 5)
      })

      const p1b = mutex.acquire(`project-1`).then((release) => {
        project1Order.push(2)
        release()
      })

      // Queue operations on project-2
      const p2a = mutex.acquire(`project-2`).then((release) => {
        project2Order.push(1)
        setTimeout(release, 5)
      })

      const p2b = mutex.acquire(`project-2`).then((release) => {
        project2Order.push(2)
        release()
      })

      await Promise.all([p1a, p1b, p2a, p2b])

      expect(project1Order).toEqual([1, 2])
      expect(project2Order).toEqual([1, 2])
    })
  })

  describe(`getActiveLocks()`, () => {
    it(`should return 0 when no locks active`, () => {
      expect(mutex.getActiveLocks()).toBe(0)
    })

    it(`should return correct count of active locks`, async () => {
      const release1 = await mutex.acquire(`project-1`)
      const release2 = await mutex.acquire(`project-2`)
      const release3 = await mutex.acquire(`project-3`)

      expect(mutex.getActiveLocks()).toBe(3)

      release1()
      release2()
      release3()
    })
  })

  describe(`clearAll()`, () => {
    it(`should clear all locks`, async () => {
      await mutex.acquire(`project-1`)
      await mutex.acquire(`project-2`)

      expect(mutex.getActiveLocks()).toBe(2)

      mutex.clearAll()

      expect(mutex.getActiveLocks()).toBe(0)
    })

    it(`should allow new locks after clearing`, async () => {
      await mutex.acquire(`project-1`)
      mutex.clearAll()

      const release = await mutex.acquire(`project-2`)
      expect(mutex.getActiveLocks()).toBe(1)
      release()
    })
  })

  describe(`Promise-based queuing`, () => {
    it(`should wait for previous lock to release`, async () => {
      let firstExecuted = false
      let secondExecuted = false

      // First acquire
      mutex.acquire(`project-1`).then((release) => {
        firstExecuted = true
        setTimeout(() => {
          release()
        }, 50)
      })

      // Second acquire should wait
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(firstExecuted).toBe(true)

      await mutex.acquire(`project-1`).then((release) => {
        secondExecuted = true
        release()
      })

      expect(secondExecuted).toBe(true)
    })
  })

  describe(`Edge cases`, () => {
    it(`should handle rapid acquire/release cycles`, async () => {
      const promises = []

      for (let i = 0; i < 100; i++) {
        promises.push(
          mutex.acquire(`project-1`).then((release) => {
            release()
          })
        )
      }

      await Promise.all(promises)
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(mutex.getActiveLocks()).toBe(0)
    })

    it(`should not interfere with different projects`, async () => {
      const results: string[] = []

      await Promise.all([
        mutex.acquire(`project-1`).then((release) => {
          results.push(`p1-start`)
          setTimeout(() => {
            results.push(`p1-end`)
            release()
          }, 20)
        }),
        mutex.acquire(`project-2`).then((release) => {
          results.push(`p2-start`)
          setTimeout(() => {
            results.push(`p2-end`)
            release()
          }, 10)
        }),
      ])

      // Both projects should execute in parallel
      expect(results).toContain(`p1-start`)
      expect(results).toContain(`p2-start`)

      await wait(100)

      // p2 should finish before p1 (10ms vs 20ms)
      const p2EndIndex = results.indexOf(`p2-end`)
      const p1EndIndex = results.indexOf(`p1-end`)
      expect(p2EndIndex).toBeLessThan(p1EndIndex)
    })
  })
})
