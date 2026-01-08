import type { Request, Response } from 'express'

/**
 * Health check endpoint
 * Returns basic service health status
 */
export const health = (_req: Request, res: Response): void => {
  res.status(200).json({
    status: `ok`,
    service: `auth-proxy`,
    timestamp: new Date().toISOString(),
  })
}
