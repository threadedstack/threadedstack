import type { TEndpointConfig } from '@TBE/types'
import type { Request, Response } from 'express'

import { EPMethod } from '@TBE/types'

export const base: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ message: `Backend Auth Base Endpoint!` })
  },
}
