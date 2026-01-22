import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Request } from 'express'
import type { TEndpointOpts } from '@tdsk/domain'

import { RetryService } from './retryService'

describe(`RetryService`, () => {
  let mockReq: Request
  let service: RetryService
  let mockOpts: TEndpointOpts = {}

  beforeEach(() => {
    mockOpts = {}
    mockReq = { res: { locals: {} } } as Request
    service = new RetryService(mockReq, mockOpts)
  })

  describe(`init`, () => {
    beforeEach(() => {
      mockReq.res.locals = {}
    })

    it(`should return config with maxRetries = 0 when retries not set`, () => {
      const options: TEndpointOpts = {}
      const config = service.setup(options)

      expect(config.maxRetries).toBe(0)
      expect(config.initialDelay).toBe(1000)
    })

    it(`should return config with maxRetries = 0 when retries is 0`, () => {
      const options: TEndpointOpts = { retries: 0 }
      const config = service.setup(options)

      expect(config.maxRetries).toBe(0)
    })

    it(`should use default values when not specified`, () => {
      const options: TEndpointOpts = { retries: 3 }
      const config = service.setup(options)

      expect(config.maxRetries).toBe(3)
      expect(config.initialDelay).toBe(1000)
      expect(config.maxDelay).toBe(30000)
      expect(config.backoffMultiplier).toBe(2)
      expect(config.exponentialBackoff).toBe(true)
    })

    it(`should use custom retry configuration`, () => {
      const options: TEndpointOpts = {
        retries: 5,
        retryDelay: 2000,
        retryMaxDelay: 60000,
        retryBackoffMultiplier: 3,
        retryExponentialBackoff: false,
      }

      const config = service.setup(options)

      expect(config.maxRetries).toBe(5)
      expect(config.initialDelay).toBe(2000)
      expect(config.maxDelay).toBe(60000)
      expect(config.backoffMultiplier).toBe(3)
      expect(config.exponentialBackoff).toBe(false)
    })

    it(`should default exponentialBackoff to true even when not specified`, () => {
      const options: TEndpointOpts = { retries: 3 }
      const config = service.setup(options)

      expect(config.exponentialBackoff).toBe(true)
    })
  })

  describe(`retry metadata management`, () => {
    beforeEach(() => {
      mockReq.res.locals = {}
    })

    it(`should initialize retry metadata`, () => {
      const config = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        exponentialBackoff: true,
      }

      service.meta.init(config)

      const metadata = service.meta.get()

      expect(metadata).toBeDefined()
      expect(metadata?.attempt).toBe(0)
      expect(metadata?.maxRetries).toBe(3)
      expect(metadata?.startTime).toBeLessThanOrEqual(Date.now())
    })

    it(`should return undefined for uninitialized metadata`, () => {
      const metadata = service.meta.get()
      expect(metadata).toBeUndefined()
    })

    it(`should update retry metadata with error`, () => {
      const config = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        exponentialBackoff: true,
      }

      service.meta.init(config)

      const error = new Error(`Test error`)
      service.meta.update(error)

      const metadata = service.meta.get()

      expect(metadata?.attempt).toBe(1)
      expect(metadata?.lastError).toBe(error)
    })

    it(`should increment attempt counter on multiple updates`, () => {
      const config = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        exponentialBackoff: true,
      }

      service.meta.init(config)

      service.meta.update(new Error(`Error 1`))
      service.meta.update(new Error(`Error 2`))
      service.meta.update(new Error(`Error 3`))

      const metadata = service.meta.get()

      expect(metadata?.attempt).toBe(3)
    })
  })

  describe(`shouldRetry`, () => {
    beforeEach(() => {
      mockReq.res.locals = {}
    })

    it(`should return false if metadata is not initialized`, () => {
      expect(service.shouldRetry(new Error(`Test`), 500)).toBe(false)
    })

    it(`should return false if max retries exhausted`, () => {
      const config = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        exponentialBackoff: true,
      }

      service.meta.init(config)

      // Exhaust retries
      service.meta.update(new Error(`Error 1`))
      service.meta.update(new Error(`Error 2`))
      service.meta.update(new Error(`Error 3`))

      expect(service.shouldRetry(new Error(`Error 4`), 500)).toBe(false)
    })

    it(`should return false for non-retryable error`, () => {
      const config = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        exponentialBackoff: true,
      }

      service.meta.init(config)

      expect(service.shouldRetry(new Error(`Bad request`), 400)).toBe(false)
    })

    it(`should return true for retryable error with attempts remaining`, () => {
      const config = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        exponentialBackoff: true,
      }

      service.meta.init(config)

      expect(service.shouldRetry(new Error(`Server error`), 500)).toBe(true)
    })

    it(`should return true for network errors`, () => {
      const config = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        exponentialBackoff: true,
      }

      service.meta.init(config)

      expect(service.shouldRetry(new Error(`Network error`))).toBe(true)
    })
  })

  describe(`delayRetry`, () => {
    beforeEach(() => {
      mockReq.res.locals = {}
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it(`should delay for the calculated amount`, async () => {
      const config = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        exponentialBackoff: true,
      }

      service.meta.init(config)
      service.meta.update(new Error(`Error`))

      const delayPromise = service.delayRetry()

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(2000)

      await delayPromise
    })

    it(`should not throw if metadata is not initialized`, async () => {
      const config = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        exponentialBackoff: true,
      }

      await expect(service.delayRetry()).resolves.toBeUndefined()
    })
  })

  describe(`logStatus`, () => {
    beforeEach(() => {
      mockReq.res.locals = {}
    })

    it(`should not throw if metadata is not initialized`, () => {
      expect(() => service.logStatus(true)).not.toThrow()
      expect(() => service.logStatus(false)).not.toThrow()
    })

    it(`should log success after retries`, () => {
      const config = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        exponentialBackoff: true,
      }

      service.meta.init(config)
      service.meta.update(new Error(`Error`))

      expect(() => service.logStatus(true)).not.toThrow()
    })

    it(`should log failure after exhausting retries`, () => {
      const config = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        exponentialBackoff: true,
      }

      service.meta.init(config)
      service.meta.update(new Error(`Error 1`))
      service.meta.update(new Error(`Error 2`))
      service.meta.update(new Error(`Error 3`))

      expect(() => service.logStatus(false)).not.toThrow()
    })
  })
})
