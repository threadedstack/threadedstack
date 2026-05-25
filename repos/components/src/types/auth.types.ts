import type { ReactNode } from 'react'
import type { User } from '@tdsk/domain'

export type TAuthProvider = `github` | `google` | `gitlab` | `vercel` | `email`

export type TLoginData = {
  provider?: TAuthProvider
}

export type TOnLogin = (data: TLoginData) => void

export type TAuthError = {
  code?: string
  status: number
  message?: string
  statusText: string
}

export type TAuthSession = {
  id: string
  token: string
  userId: string
  ipAddress?: string
  userAgent?: string
  impersonatedBy?: string
  expiresAt: string | Date
  createdAt: string | Date
  updatedAt: string | Date
  activeOrganizationId?: string
}

export type TAuthWaitlist = {
  waitlisted?: boolean
}

export type TAuthData = {
  user?: User
  session?: TAuthSession
}

export type TAuthResp = TAuthWaitlist &
  TAuthData & {
    error?: TAuthError
    success?: boolean
  }

type TLoginBtn = (props: TLoginBtnProps) => ReactNode

export type TLoginBtnProps = {
  error?: string
  onLogin: TOnLogin
  loading?: boolean
  disabled?: boolean
  authenticating?: TAuthProvider
}

export type TLogin = TLoginBtnProps & {
  headline?: string
  subtitle?: string
  emailError?: string
  emailSuccess?: string
  emailLoading?: boolean
  showEmailForm?: boolean
  providers: Array<TAuthProvider>
  onForgotPassword?: (email: string) => Promise<void>
  onEmailSignIn?: (email: string, password: string) => Promise<void>
  onEmailSignUp?: (email: string, password: string) => Promise<void>
}

export type TEmailLoginFormProps = {
  error?: string
  success?: string
  loading?: boolean
  onForgotPassword?: (email: string) => Promise<void>
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
}

export type TLoginError = {
  message?: string
}

export type TProviderBtnProps = {
  loading?: boolean
  onLogin: TOnLogin
  disabled?: boolean
}

export type TLoginBtns = Partial<Record<TAuthProvider, TLoginBtn>>
