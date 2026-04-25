import type { TAuthSession } from '@TTH/types'

import { apiService } from '@TTH/services/api'
import { authClient } from '@TTH/services/auth'

const REFRESH_BUFFER_MS = 2 * 60 * 1000
const MIN_CHECK_INTERVAL_MS = 30 * 1000
const FALLBACK_CHECK_INTERVAL_MS = 4 * 60 * 1000

export class TokenRefreshManager {
  #timer: ReturnType<typeof setTimeout> | null = null
  #refreshPromise: Promise<boolean> | null = null
  #session: TAuthSession | null = null
  #onSessionUpdate: ((session: TAuthSession) => void) | null = null
  #onAuthFailure: (() => void) | null = null

  start(
    session: TAuthSession,
    onSessionUpdate: (s: TAuthSession) => void,
    onAuthFailure: () => void
  ) {
    this.#session = session
    this.#onSessionUpdate = onSessionUpdate
    this.#onAuthFailure = onAuthFailure
    this.#scheduleNext()
    document.addEventListener(`visibilitychange`, this.#onVisibilityChange)
  }

  stop() {
    if (this.#timer) {
      clearTimeout(this.#timer)
      this.#timer = null
    }
    this.#refreshPromise = null
    this.#session = null
    this.#onSessionUpdate = null
    this.#onAuthFailure = null
    document.removeEventListener(`visibilitychange`, this.#onVisibilityChange)
  }

  async refreshAndRetry(): Promise<boolean> {
    if (this.#refreshPromise) return this.#refreshPromise

    this.#refreshPromise = this.#doRefresh()
    try {
      return await this.#refreshPromise
    } finally {
      this.#refreshPromise = null
    }
  }

  async #doRefresh(): Promise<boolean> {
    try {
      await apiService.bearer()
      const { data } = await authClient.getSession()
      if (!data?.session?.token) return false

      this.#session = data.session as TAuthSession
      this.#onSessionUpdate?.(data.session as TAuthSession)
      this.#scheduleNext()
      return true
    } catch {
      return false
    }
  }

  #scheduleNext() {
    if (this.#timer) {
      clearTimeout(this.#timer)
      this.#timer = null
    }

    const expiresAt = this.#session?.expiresAt
    if (expiresAt) {
      const expiresMs = new Date(expiresAt).getTime()
      const msUntilRefresh = Math.max(
        expiresMs - Date.now() - REFRESH_BUFFER_MS,
        MIN_CHECK_INTERVAL_MS
      )
      this.#timer = setTimeout(() => this.#proactiveRefresh(), msUntilRefresh)
    } else {
      this.#timer = setTimeout(() => this.#proactiveRefresh(), FALLBACK_CHECK_INTERVAL_MS)
    }
  }

  async #proactiveRefresh() {
    const success = await this.#doRefresh()
    if (!success) this.#onAuthFailure?.()
  }

  #onVisibilityChange = () => {
    if (document.visibilityState !== `visible` || !this.#session) return

    const expiresAt = this.#session.expiresAt
    if (!expiresAt) return

    const expiresMs = new Date(expiresAt).getTime()
    if (Date.now() >= expiresMs - REFRESH_BUFFER_MS) {
      this.#doRefresh()
    }
  }
}

export const tokenRefresh = new TokenRefreshManager()

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    tokenRefresh.stop()
  })
  import.meta.hot.accept()
}
