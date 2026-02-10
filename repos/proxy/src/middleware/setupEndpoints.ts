import type { Router } from 'express'
import type { TProxyApp } from '@TPX/types'

import { health, logout, me, validate } from '@TPX/endpoints'

/**
 * TODO: fix this so path are defined next to actual endpoint
 * Should work similar to backend repo
 */
export const setupEndpoints = (app: TProxyApp, router: Router) => {
  router.get(`/health`, health)
  router.get(`/auth/me`, me)
  router.post(`/auth/logout`, logout)
  router.get(`/domains/validate`, validate)
}
