export type TTokenPayload = {
  userId: string
  email: string
  teamId?: string
  role?: string
  iat?: number
  exp?: number
}

export type TAuthUser = {
  userId: string
  email: string
  teamId?: string
  role?: string
}

export type TLoginRequest = {
  email: string
  password: string
}

export type TLoginResponse = {
  token: string
  refreshToken: string
  user: TAuthUser
}

export type TRefreshRequest = {
  refreshToken: string
}

export type TRefreshResponse = {
  token: string
  refreshToken: string
}
