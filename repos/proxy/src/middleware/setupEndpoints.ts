import express from 'express'
import type { Router } from 'express'
import type { TProxyApp } from '@TPX/types'

import { echo, health, logout, me, validate } from '@TPX/endpoints'

export const setupEndpoints = (app: TProxyApp, router: Router) => {
  router.get(`/health`, health)
  router.get(`/auth/me`, me)
  router.post(`/auth/logout`, logout)
  router.get(`/domains/validate`, validate)
  router.all(`/echo`, express.json(), echo)
}
