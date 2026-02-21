import type { Request, Response } from 'express'

/**
 * Echo endpoint for integration testing (dev/test only).
 * Returns the incoming request details as JSON so callers
 * can verify headers, body, method, and query were forwarded correctly.
 *
 * WARNING: Echoes all headers including sensitive values (authorization, cookies).
 * This endpoint is public (no auth required). Do not enable in production.
 */
export const echo = (req: Request, res: Response): void => {
  res.status(200).json({
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body,
    query: req.query,
  })
}
