import type { Request } from 'express'
import type { TEndpointOpts } from '@tdsk/domain'
import type { TRetryConfig, TRetryMetadata } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { wait } from '@keg-hub/jsutils/wait'
import { DefRetryCfg, AllowedRetryCodes } from '@TBE/constants/values'

class RetryMeta {
  #req?: Request

  constructor(req: Request) {
    this.#req = req
  }

  /**
   * Attaches retry metadata to the request object
   * @param req - Express request
   * @param config - Retry configuration
   */
  init(config?: TRetryConfig): void {
    this.#req.res.locals.retryMeta = {
      attempt: 0,
      startTime: Date.now(),
      maxRetries: config.maxRetries,
    } as TRetryMetadata
  }

  /**
   * Gets retry metadata from the request
   * @param req - Express request
   * @returns Retry metadata or undefined
   */
  get(): TRetryMetadata | undefined {
    return this.#req?.res?.locals?.retryMeta
  }

  /**
   * Updates retry metadata with error information
   * @param req - Express request
   * @param error - Error that occurred
   */
  update(error: any): void {
    const metadata = this.get()
    if (metadata) {
      metadata.lastError = error
      metadata.attempt++
    }
  }
}

/**
 * RetryService
 *
 * Service for managing request retry logic with configurable backoff strategies.
 * Handles retry metadata, delay calculation, and error classification.
 */
export class RetryService {
  meta: RetryMeta
  config: TRetryConfig

  constructor(req: Request, options: TEndpointOpts) {
    this.meta = new RetryMeta(req)
    this.setup(options)
  }

  /**
   * Builds retry configuration from endpoint options
   * @param options - Endpoint options
   * @returns Retry configuration
   */
  setup(options: TEndpointOpts): TRetryConfig {
    this.config =
      !options.retries || options.retries === 0
        ? { ...DefRetryCfg, maxRetries: 0 }
        : {
            maxRetries: options.retries,
            maxDelay: options.retryMaxDelay || DefRetryCfg.maxDelay,
            initialDelay: options.retryDelay || DefRetryCfg.initialDelay,
            exponentialBackoff: options.retryExponentialBackoff !== false,
            backoffMultiplier:
              options.retryBackoffMultiplier || DefRetryCfg.backoffMultiplier,
          }

    this.meta.init(this.config)
    return this.config
  }

  /**
   * Calculates the delay before the next retry attempt
   * @param attempt - Current attempt number (0-based)
   * @param config - Retry configuration
   * @returns Delay in milliseconds
   */
  #calculateDelay(attempt: number): number {
    if (!this.config.exponentialBackoff) return this.config.initialDelay

    // Exponential backoff: delay = initialDelay * (backoffMultiplier ^ attempt)
    const delay =
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt)
    return Math.min(delay, this.config.maxDelay)
  }

  /**
   * Determines if another retry attempt should be made
   * @param req - Express request
   * @param error - Error that occurred
   * @param statusCode - HTTP status code if available
   * @returns True if should retry
   */
  shouldRetry(error: any, statusCode?: number): boolean {
    const metadata = this.meta.get()
    if (!metadata) return false
    if (metadata.attempt >= metadata.maxRetries) return false

    return statusCode ? AllowedRetryCodes.includes(statusCode) : true
  }

  /**
   * Executes a retry delay before the next attempt
   * @param req - Express request
   * @param config - Retry configuration
   */
  async delayRetry(): Promise<void> {
    const metadata = this.meta.get()
    if (!metadata) return

    const delay = this.#calculateDelay(metadata.attempt)

    logger.info(
      `Retrying request (attempt ${metadata.attempt + 1}/${metadata.maxRetries}) after ${delay}ms delay`
    )

    await wait(delay)
  }

  /**
   * Logs retry completion statistics
   * @param req - Express request
   * @param success - Whether the final attempt succeeded
   */
  logStatus(success: boolean): void {
    const metadata = this.meta.get()
    if (!metadata) return

    const totalTime = Date.now() - metadata.startTime

    if (success) {
      logger.info(
        `Request succeeded after ${metadata.attempt} ${metadata.attempt === 1 ? `retry` : `retries`} (${totalTime}ms total)`
      )
    } else {
      logger.error(
        `Request failed after ${metadata.maxRetries} ${metadata.maxRetries === 1 ? `retry` : `retries`} (${totalTime}ms total)`,
        metadata.lastError
      )
    }
  }
}
