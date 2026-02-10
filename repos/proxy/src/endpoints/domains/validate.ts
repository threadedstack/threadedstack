import type { Request, Response } from 'express'
import { isStr } from '@keg-hub/jsutils/isStr'
import { logger } from '@TPX/utils/logger'

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

    if (!domain || !isStr(domain)) {
      res.status(400).json({ error: `Domain parameter is required` })
      return
    }

    const db = req.app.locals.db
    const valid = await db.services.domain.validate(domain)

    if (!valid) {
      res.status(403).json({ error: `Domain not found or not verified` })
      return
    }

    res.status(200).json({ status: `valid`, domain })
  } catch (error) {
    logger.error(`Error validating domain:`, error)
    res.status(500).json({ error: `Internal server error` })
  }
}
