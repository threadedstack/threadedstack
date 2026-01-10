import type { Router } from 'express'
import type { TProxyApp } from '@TPX/types'

import { health, logout, me } from '@TPX/endpoints'

/**
 * TODO: fix this so path are defined next to actual endpoint
 * Should work similar to backend repo
 */
export const setupEndpoints = (app: TProxyApp, router: Router) => {
  router.get(`/health`, health)
  router.post(`/auth/logout`, logout(app))
  router.get(`/auth/me`, me(app))
}
