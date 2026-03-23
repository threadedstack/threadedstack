import type { TOnLogin } from '@TTH/types'

import { auth } from '@TTH/services/auth'
import { Login } from '@TTH/components/Login'
import { useState, useCallback } from 'react'
import { setUser } from '@TTH/state/accessors'
import { signin } from '@TTH/actions/auth/local/signin'
import { TDSK_AUTH_PROVIDERS } from '@TTH/constants/envs'

export type TLogin = {}

export const LoginPage = (props: TLogin) => {
  const [error, setError] = useState<string>()
  const [authenticating, setAuthenticating] = useState<string>()
  const [emailError, setEmailError] = useState<string>()
  const [emailSuccess, setEmailSuccess] = useState<string>()
  const [emailLoading, setEmailLoading] = useState(false)

  const showEmailForm = TDSK_AUTH_PROVIDERS.includes(`email`)

  const onLogin: TOnLogin = useCallback(async (data) => {
    setEmailError(undefined)
    setAuthenticating(data.provider)
    const resp = await signin(data.provider)
    resp.error && setError(resp.error.message)
    setAuthenticating(undefined)
  }, [])

  const runEmailAction = useCallback(
    async (fallbackMsg: string, action: () => Promise<any>) => {
      setEmailLoading(true)
      setEmailError(undefined)
      setEmailSuccess(undefined)
      setError(undefined)
      try {
        const resp = await action()
        if (resp.error) {
          setEmailError(resp.error.message || fallbackMsg)
          return
        }
        return resp
      } catch (err: any) {
        setEmailError(err?.message || fallbackMsg)
      } finally {
        setEmailLoading(false)
      }
    },
    []
  )

  const onEmailSignIn = useCallback(
    async (email: string, password: string) => {
      const resp = await runEmailAction(`Sign in failed`, () =>
        auth.signInWithEmail(email, password)
      )
      resp?.user && setUser(resp.user)
    },
    [runEmailAction]
  )

  const onEmailSignUp = useCallback(
    async (email: string, password: string) => {
      const resp = await runEmailAction(`Sign up failed`, () =>
        auth.signUpWithEmail(email, password)
      )
      resp?.user && setUser(resp.user)
    },
    [runEmailAction]
  )

  const onForgotPassword = useCallback(
    async (email: string) => {
      const resp = await runEmailAction(`Password reset failed`, () =>
        auth.forgotPassword(email)
      )
      resp && setEmailSuccess(`Password reset email sent. Check your inbox.`)
    },
    [runEmailAction]
  )

  return (
    <Login
      error={error}
      onLogin={onLogin}
      emailError={emailError}
      emailSuccess={emailSuccess}
      emailLoading={emailLoading}
      onEmailSignIn={onEmailSignIn}
      onEmailSignUp={onEmailSignUp}
      showEmailForm={showEmailForm}
      providers={TDSK_AUTH_PROVIDERS}
      authenticating={authenticating}
      onForgotPassword={onForgotPassword}
    />
  )
}

export default LoginPage
