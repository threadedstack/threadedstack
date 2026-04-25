import type { TOnLogin } from '@TTH/types'

import { nav } from '@TTH/services/nav'
import { auth } from '@TTH/services/auth'
import { Login } from '@TTH/components/Login'
import { useState, useCallback } from 'react'
import { signin } from '@TTH/actions/auth/local/signin'
import { TDSK_AUTH_PROVIDERS } from '@TTH/constants/envs'
import { loginWithEmail } from '@TTH/actions/auth/local/loginWithEmail'
import { signupWithEmail } from '@TTH/actions/auth/local/signupWithEmail'

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
    setTimeout(() => {
      setEmailLoading(false)
      setAuthenticating(undefined)
    }, 1500)
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
        resp?.user && nav.home()
        return resp
      } catch (err: any) {
        setEmailError(err?.message || fallbackMsg)
      } finally {
        setTimeout(() => {
          setEmailLoading(false)
          setAuthenticating(undefined)
        }, 1500)
      }
    },
    []
  )

  const onEmailSignIn = useCallback(
    async (email: string, password: string) => {
      await runEmailAction(`Sign in failed`, () => loginWithEmail(email, password))
    },
    [runEmailAction]
  )

  const onEmailSignUp = useCallback(
    async (email: string, password: string) => {
      await runEmailAction(`Sign up failed`, () => signupWithEmail(email, password))
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
