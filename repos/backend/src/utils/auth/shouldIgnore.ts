import type { TRequest } from '@tdsk/domain'

import { adminPath } from '@tdsk/domain'
import { AuthIgnore } from '@TBE/constants/values'

export const shouldIgnore = (req: TRequest) => {
  const config = req.app?.locals?.config
  if (!config) return false

  const location = adminPath(config.server)
  const admin = req.baseUrl === location
  const ignore = AuthIgnore.includes(req.path)

  return admin && ignore
}
