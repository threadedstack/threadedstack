import { wait } from '@keg-hub/jsutils/wait'
import { logger } from '@TSB/utils/logger'
import {
  KubeRetryMaxAttempts,
  KubeRetryInitialDelayMs,
  KubeRetryableStatusCodes,
  KubeRetryBackoffMultiplier,
} from '@TSB/constants/kube'

const getStatusCode = (err: any): number | undefined =>
  err?.code ?? err?.statusCode ?? err?.response?.statusCode

/**
 * Wraps an idempotent, read-only K8s API call with a bounded retry-with-backoff
 * on transient apiserver failures (429/500/502/503/504 — e.g. the apiserver's
 * own --request-timeout firing as a 504). Never retries on other errors (404,
 * validation errors, etc.) — those propagate on the first attempt.
 */
export const withKubeRetry = async <T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> => {
  let attempt = 0
  let delay = KubeRetryInitialDelayMs

  while (true) {
    try {
      return await fn()
    } catch (err: any) {
      const code = getStatusCode(err)
      if (
        !KubeRetryableStatusCodes.has(code as number) ||
        attempt >= KubeRetryMaxAttempts
      )
        throw err

      attempt++
      logger.warn(
        `[KubeClient] ${label} failed with transient status ${code}, retrying (${attempt}/${KubeRetryMaxAttempts}) in ${delay}ms`
      )
      await wait(delay)
      delay *= KubeRetryBackoffMultiplier
    }
  }
}
