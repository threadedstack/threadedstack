export type TTokenSignOpts = {
  id: string
  name: string
  email: string
  secret: string
  origin: string
  expires: number
  type: `bearer`
}

export type TTokenOpts = {
  publicRoutes: string[]
}

export type TClientTokenOpts = {
  client_id: string
  grant_type: string
  audience?: string
  client_secret: string
  subject_token?: string
  requested_subject?: string
  subject_token_type?: string
  claims?: Record<string, string | number | boolean>
}

export type TTokenMintOpts = {
  roles?: string
  orgId?: string
  userId?: string
  audience: string
}
