export type TLoginData = {
  provider?:string
  options?:Record<string, any>
}

export type TOnLogin = (data:TLoginData) => void

export type TAuthError = {
  code?: string
  message?: string
  status: number
  statusText: string
}

export type TAuthSession = {
  id: string
  token: string
  userId: string
  ipAddress?: string
  userAgent?: string
  expiresAt: string|Date
  createdAt: string|Date
  updatedAt: string|Date
  impersonatedBy?: string
  activeOrganizationId?: string
}
