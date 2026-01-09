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
