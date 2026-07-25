import type { TOnLogin, TAuthProvider } from '@tdsk/components'

import { nav } from '@TTH/services/nav'
import { Login } from '@tdsk/components'
import { auth } from '@TTH/services/auth'
import { useState, useCallback, useRef, useEffect } from 'react'
import { signin } from '@TTH/actions/auth/local/signin'
import { TDSK_AUTH_PROVIDERS } from '@TTH/constants/envs'
import { loginWithEmail } from '@TTH/actions/auth/local/loginWithEmail'
import { signupWithEmail } from '@TTH/actions/auth/local/signupWithEmail'

export type TLogin = {}

export const LoginPage = (props: TLogin) => {
  const [error, setError] = useState<string>()
  const [authenticating, setAuthenticating] = useState<TAuthProvider>()
  const [emailError, setEmailError] = useState<string>()
  const [emailSuccess, setEmailSuccess] = useState<string>()
  const [emailLoading, setEmailLoading] = useState(false)

  const showEmailForm = TDSK_AUTH_PROVIDERS.includes(`email`)

  /**
   * Both auth paths clear the spinner on a delay so it does not flicker away
   * before a redirect lands. The handle is kept so the timer can be cancelled:
   * uncancelled, it fired after unmount and set state on a dead component,
   * which surfaced as `ReferenceError: window is not defined` from react-dom
   * once the test environment (or the page) had already torn down.
   *
   * Clearing a pending timer before arming a new one also stops a second
   * sign-in attempt from being reset early by the first attempt's timer.
   */
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const scheduleReset = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => {
      setEmailLoading(false)
      setAuthenticating(undefined)
    }, 1500)
  }, [])

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    },
    []
  )

  const onLogin: TOnLogin = useCallback(
    async (data) => {
      setEmailError(undefined)
      setAuthenticating(data.provider)
      const resp = await signin(data.provider)
      resp.error && setError(resp.error.message)
      scheduleReset()
    },
    [scheduleReset]
  )

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
        scheduleReset()
      }
    },
    [scheduleReset]
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
