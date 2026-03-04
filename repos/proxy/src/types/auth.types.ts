export enum EJWTError {
  expired = `JWTExpired`,
  claim = `JWTClaimValidationFailed`,
  signature = `JWSSignatureVerificationFailed`,
}

export type TTokenPayload = {
  userId: string
  email: string
  orgId?: string
  role?: string
  iat?: number
  exp?: number
}

// TODO: TAuthUser is structurally identical to TAuthHeaderObj from @tdsk/domain (already a dependency) — consolidate
export type TAuthUser = {
  userId: string
  email: string
  orgId?: string
  role?: string
  projectId?: string
  apiKeyId?: string
}

export type TJWTPayload = {
  sub?: string
  userId?: string
  email?: string
  orgId?: string
  role?: string
  iat?: number
  exp?: number
  [key: string]: unknown
}

export type TJWTValidationResult = {
  valid: boolean
  expired?: boolean
  payload?: TJWTPayload
  error?: string
}
