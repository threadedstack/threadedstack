import type { TRequest } from '@tdsk/domain'
import type { TABConfig } from '@TBE/types'

import { AuthIgnore } from '@TBE/constants/values'
import { adminPath } from '@TBE/utils/auth/adminPath'

export const shouldIgnore = (req: TRequest) => {
  const { config } = req.app?.locals
  const location = adminPath(config as TABConfig)
  const admin = req.baseUrl === location
  const ignore = AuthIgnore.includes(req.path)

  return admin && ignore
}
