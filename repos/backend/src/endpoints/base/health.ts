import type { TEndpointConfig } from '@TBE/types'
import type { Request, Response } from 'express'

import { EPMethod } from '@TBE/types'

export const health: TEndpointConfig = {
  path: `/health`,
  method: EPMethod.Get,
  action: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ message: `Backend Server is Running!` })
  },
}
