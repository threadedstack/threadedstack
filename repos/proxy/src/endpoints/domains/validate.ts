import type { Request, Response } from 'express'
import { database } from '@tdsk/database'
import { isStr } from '@keg-hub/jsutils/isStr'

/**
 * GET /domains/validate
 *
 * Called by Caddy's on_demand_tls to verify a domain exists in our database
 * Query params: ?domain=example.com
 *
 * Returns 200 if domain is valid and verified
 * Returns 403 if domain is not found or not verified
 */
export const validate = async (req: Request, res: Response) => {
  try {
    const { domain } = req.query

    console.log(`############################################`)
    console.log(`------- DOMAIN VALIDATION -------`)
    console.log(`############################################`)
    console.log(`\n`)
    console.log(`------- URLS -------`)
    console.log(`req.url:`, req.url)
    console.log(`req.originalUrl:`, req.originalUrl)
    console.log(`------- URLS -------`)
    console.log(`\n`)
    console.log(`############################################`)
    console.log(`\n`)
    console.log(`------- BODY / QUERY / PARAMS -------`)
    console.log(`req.body:`, req.body)
    console.log(`req.query:`, req.query)
    console.log(`req.params:`, req.params)
    console.log(`------- BODY / QUERY / PARAMS -------`)
    console.log(`\n`)
    console.log(`############################################`)
    console.log(`\n`)
    console.log(`------- HEADERS -------`)
    console.log(`req.headers:`, req.headers)
    console.log(`------- HEADERS -------`)
    console.log(`\n`)
    console.log(`############################################`)
    console.log(`------- DOMAIN VALIDATION -------`)
    console.log(`############################################`)

    if (!domain || !isStr(domain)) {
      res.status(400).json({ error: `Domain parameter is required` })
      return
    }

    // TODO: update this to be created on proxy app and added to app.locals
    // Matches how it's done in the backend repo
    // Need to add DB config to proxy config
    const db = database()
    const valid = await db.services.domain.validate(domain)

    if (!valid) {
      res.status(403).json({ error: `Domain not found or not verified` })
      return
    }

    res.status(200).json({ status: `valid`, domain })
  } catch (error) {
    console.error(`Error validating domain:`, error)
    res.status(500).json({ error: `Internal server error` })
  }
}
