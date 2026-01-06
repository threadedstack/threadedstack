import type { TApp, TRequest, TResponse } from '@TDM/types'

const allowedHeaders = [
  `X-PINGOTHER`,
  `Origin`,
  `X-Requested-With`,
  `Content-Type`,
  `Accept`,
  `Authorization`,
  `AuthToken`,
  `x-tdsk-host`,
  `x-tdsk-proto`,
  `x-tdsk-port`,
  `x-tdsk-route`,
  `x-tdsk-subdomain`,
  `x-forwarded-subdomain`,
  `x-forwarded-port`,
  `x-forwarded-proto`,
  `x-forwarded-host`,
  `x-forwarded-for`,
]

const allowedMethods = [`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`].join(
  `,`
)

/**
 * Resolves the origin from the passed in headers
 * @param {Object} req - Express request object
 */
export const getOrigin = (req: TRequest) => {
  return (
    req.headers.origin ||
    (req.headers.referer && new URL(req?.headers?.referer).origin) ||
    (req.headers.host &&
      req.protocol &&
      `${req.protocol}://${req?.headers?.host?.split(':').shift()}`)
  )
}

/**
 * Configures cors for the backend API and websocket
 * Defines the origins that are allow to connect to the API
 * @returns {void}
 */
export const setupCors = (app: TApp, extraHeaders: string[] = []) => {
  const config = app?.locals?.config?.server
  if (!app) throw new Error(`Error setting up Cors. Express app does not exist`)
  if (!config) throw new Error(`Error setting up Cors. Server config does not exist`)

  app.use((req: TRequest, res: TResponse, next) => {
    const origin = getOrigin(req)

    const foundOrigin =
      config.origins.includes(`*`) || config.origins.includes(origin) ? origin : undefined

    // If in a deployed env, then validate the origin
    // Otherwise allow the origin in development envs
    // const foundOrigin = config.environment !== `local`
    //   ? config.origins.includes(`*`) || config.origins.includes(origin)
    //     ? origin
    //     : undefined
    //   : origin

    // If no origin, then end the request as Unauthorized
    if (!foundOrigin) {
      res.status(401).send(`Unauthorized`)
      return
    }

    res.setHeader(`Access-Control-Allow-Origin`, foundOrigin)
    res.setHeader(`Vary`, `Origin,Access-Control-Request-Headers`)
    res.setHeader(`Access-Control-Allow-Credentials`, `true`)
    res.setHeader(`Access-Control-Allow-Methods`, allowedMethods)
    res.setHeader(
      `Access-Control-Allow-Headers`,
      [...allowedHeaders, ...extraHeaders].join(`,`)
    )

    req.method === `OPTIONS` ? res.status(200).send(`OK`) : next()
  })
}
