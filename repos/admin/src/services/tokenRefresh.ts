import type { TAuthSession } from '@tdsk/components'

import { apiService } from '@TAF/services/api'
import { authClient } from '@TAF/services/auth'
import {
  RefreshBufferMS,
  MinCheckIntervalMS,
  FallbackCheckIntervalMS,
} from '@tdsk/components'

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
        expiresMs - Date.now() - RefreshBufferMS,
        MinCheckIntervalMS
      )
      this.#timer = setTimeout(() => this.#proactiveRefresh(), msUntilRefresh)
    } else {
      this.#timer = setTimeout(() => this.#proactiveRefresh(), FallbackCheckIntervalMS)
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
    if (Date.now() >= expiresMs - RefreshBufferMS) {
      this.#doRefresh()
    }
  }
}

export const tokenRefresh = new TokenRefreshManager()
