import type { TApp } from '@TDM/types'

/**
 * Configures the express bodyParser and add the AppRouter to the express app
 * @param {Object} app - Express app object
 *
 * @returns {void}
 */
export const setupServer = (app: TApp) => {
  app.set(`trust proxy`, 1)
  app.disable(`etag`)
  app.disable(`x-powered-by`)
}
