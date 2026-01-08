import type { Router } from 'express'
import type { TProxyApp } from '@TPX/types'

import { health, login, logout, refresh, me } from '@TPX/endpoints'

/**
 * TODO: fix this so path are defined next to actual endpoint
 * Should work similar to backend repo
 */
export const setupEndpoints = (app: TProxyApp, router: Router) => {
  // Health check endpoint (public)
  router.get(`/health`, health)
  // Auth endpoints (public - no JWT required)
  router.post(`/auth/login`, login(app))
  router.post(`/auth/logout`, logout(app))
  router.post(`/auth/refresh`, refresh(app))
  // Current user endpoint (protected)
  router.get(`/auth/me`, me(app))
}
