import type { TOnLogin } from '@TAF/types'

import { useState, useCallback } from 'react'
import { Login } from '@TAF/components/Login'
import { auth } from '@TAF/services/auth'
import { setUser } from '@TAF/state/accessors'
import { TDSK_AUTH_PROVIDERS } from '@TAF/constants/envs'
import { signin } from '@TAF/actions/auth/local/signin'

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

  const onEmailSignIn = useCallback(async (email: string, password: string) => {
    setEmailLoading(true)
    setEmailError(undefined)
    setEmailSuccess(undefined)
    setError(undefined)
    try {
      const resp = await auth.signInWithEmail(email, password)
      if (resp.error) {
        setEmailError(resp.error.message || `Sign in failed`)
        return
      }
      resp.user && setUser(resp.user)
    } catch (err: any) {
      setEmailError(err?.message || `Sign in failed`)
    } finally {
      setEmailLoading(false)
    }
  }, [])

  const onEmailSignUp = useCallback(async (email: string, password: string) => {
    setEmailLoading(true)
    setEmailError(undefined)
    setEmailSuccess(undefined)
    setError(undefined)
    try {
      const resp = await auth.signUpWithEmail(email, password)
      if (resp.error) {
        setEmailError(resp.error.message || `Sign up failed`)
        return
      }
      resp.user && setUser(resp.user)
    } catch (err: any) {
      setEmailError(err?.message || `Sign up failed`)
    } finally {
      setEmailLoading(false)
    }
  }, [])

  const onForgotPassword = useCallback(async (email: string) => {
    setEmailLoading(true)
    setEmailError(undefined)
    setEmailSuccess(undefined)
    setError(undefined)
    try {
      const resp = await auth.forgotPassword(email)
      if (resp.error) {
        setEmailError(resp.error.message || `Password reset failed`)
        return
      }
      setEmailSuccess(`Password reset email sent. Check your inbox.`)
    } catch (err: any) {
      setEmailError(err?.message || `Password reset failed`)
    } finally {
      setEmailLoading(false)
    }
  }, [])

  return (
    <Login
      error={error}
      onLogin={onLogin}
      providers={TDSK_AUTH_PROVIDERS}
      authenticating={authenticating}
      showEmailForm={showEmailForm}
      emailError={emailError}
      emailSuccess={emailSuccess}
      emailLoading={emailLoading}
      onEmailSignIn={onEmailSignIn}
      onEmailSignUp={onEmailSignUp}
      onForgotPassword={onForgotPassword}
    />
  )
}

export default LoginPage
