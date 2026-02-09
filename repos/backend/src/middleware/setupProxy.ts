import type { Router } from 'express'
import type { TApp } from '@tdsk/domain'

import { URL } from 'url'
import { EPMethod } from '@TBE/types'
import { buildProxy } from '@TBE/utils/proxy/buildProxy'
import { createProxyMiddleware } from 'http-proxy-middleware'

/**
 * Proxy middleware to forward requests to the API-Service
 */
export const setupProxy = (app: TApp, router: Router) => {
  router.use(
    createProxyMiddleware(
      buildProxy({
        path: `**`,
        originHeader: true,
        method: EPMethod.All,
        proxy: {
          ws: true,
          target: new URL(app.locals.config.proxy.url).toString(),
        },
      })
    )
  )
}
