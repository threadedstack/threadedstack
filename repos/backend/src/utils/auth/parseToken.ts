import type { TABConfig } from '@TBE/types'
import jwt from 'jsonwebtoken'
import type { JwtPayload } from 'jsonwebtoken'

export const parseToken = (token: string, config: TABConfig) => {
  const { iat, exp, iss, sub, amr, ...rest } = jwt.verify(
    token,
    config.server.jwt.secret
  ) as JwtPayload

  return { id: sub, ...rest }
}
