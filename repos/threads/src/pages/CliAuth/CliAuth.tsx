import type { TOnLogin, TAuthProvider } from '@tdsk/components'

import { Login } from '@tdsk/components'
import { auth, authClient } from '@TTH/services/auth'
import { useMemo, useState, useCallback } from 'react'
import { TDSK_AUTH_URL, TDSK_AUTH_PROVIDERS } from '@TTH/constants/envs'
import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react'

type TCliAuthState = `login` | `redirecting` | `error` | `invalid`

const parseParams = () => {
  const params = new URLSearchParams(window.location.search)
  const rawPort = params.get(`port`)
  const state = params.get(`state`)
  const port =
    rawPort && /^\d+$/.test(rawPort) && Number(rawPort) > 0 && Number(rawPort) <= 65535
      ? rawPort
      : null
  return { port, state }
}

const redirectToCli = (port: string, state: string, token: string, expiresAt: string) => {
  const params = new URLSearchParams({
    token,
    state,
    expiresAt,
    authUrl: TDSK_AUTH_URL,
  })
  window.location.href = `http://localhost:${port}/callback?${params.toString()}`
}

const redirectWithError = (port: string, state: string, error: string) => {
  const params = new URLSearchParams({ error, state })
  window.location.href = `http://localhost:${port}/callback?${params.toString()}`
}

const CliAuthInner = () => {
  const { port, state } = useMemo(parseParams, [])
  const [phase, setPhase] = useState<TCliAuthState>(!port || !state ? `invalid` : `login`)
  const [error, setError] = useState<string>()
  const [authenticating, setAuthenticating] = useState<TAuthProvider>()
  const [emailError, setEmailError] = useState<string>()
  const [emailSuccess, setEmailSuccess] = useState<string>()
  const [emailLoading, setEmailLoading] = useState(false)

  const showEmailForm = TDSK_AUTH_PROVIDERS.includes(`email`)

  const handleAuthSuccess = useCallback(async () => {
    if (!port || !state) return

    setPhase(`redirecting`)
    try {
      const { data } = await authClient.getSession()
      if (!data?.session?.token) {
        setPhase(`error`)
        setError(`Could not retrieve session token`)
        redirectWithError(port, state, `No session token`)
        return
      }
      const expiresAt =
        data.session.expiresAt instanceof Date
          ? data.session.expiresAt.toISOString()
          : String(data.session.expiresAt || ``)
      redirectToCli(port, state, data.session.token, expiresAt)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Session retrieval failed`
      setPhase(`error`)
      setError(msg)
      redirectWithError(port, state, msg)
    }
  }, [port, state])

  const onLogin: TOnLogin = useCallback(
    async (data) => {
      setEmailError(undefined)
      setAuthenticating(data.provider)
      try {
        const resp = await auth.signin(data.provider)
        if (resp.error) {
          setError(resp.error.message)
          setAuthenticating(undefined)
          return
        }
        await handleAuthSuccess()
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Sign-in failed`
        setError(msg)
        setAuthenticating(undefined)
      }
    },
    [handleAuthSuccess]
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
          setEmailLoading(false)
          setAuthenticating(undefined)
          return resp
        }
        if (resp?.user) await handleAuthSuccess()
        return resp
      } catch (err: any) {
        setEmailError(err?.message || fallbackMsg)
        setEmailLoading(false)
        setAuthenticating(undefined)
        return undefined
      }
    },
    [handleAuthSuccess]
  )

  const onEmailSignIn = useCallback(
    async (email: string, password: string) => {
      await runEmailAction(`Sign in failed`, () => auth.signInWithEmail(email, password))
    },
    [runEmailAction]
  )

  const onEmailSignUp = useCallback(
    async (email: string, password: string) => {
      await runEmailAction(`Sign up failed`, () => auth.signUpWithEmail(email, password))
    },
    [runEmailAction]
  )

  const onForgotPassword = useCallback(
    async (email: string) => {
      const resp = await runEmailAction(`Password reset failed`, () =>
        auth.forgotPassword(email)
      )
      if (resp && !resp.error) {
        setEmailSuccess(`Password reset email sent. Check your inbox.`)
      }
    },
    [runEmailAction]
  )

  if (phase === `invalid`) {
    return (
      <div style={{ padding: 40, textAlign: `center` }}>
        <h2>Invalid Request</h2>
        <p>
          Missing required parameters. Please use <code>tsa login</code> from the CLI.
        </p>
      </div>
    )
  }

  if (phase === `redirecting`) {
    return (
      <div style={{ padding: 40, textAlign: `center` }}>
        <h2>Redirecting to CLI...</h2>
        <p>You will be redirected back to the terminal shortly.</p>
      </div>
    )
  }

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
      headline='Authenticate TSA CLI'
      onForgotPassword={onForgotPassword}
      subtitle='Sign in to connect your terminal'
    />
  )
}

export const CliAuthPage = () => (
  <NeonAuthUIProvider authClient={auth.client}>
    <CliAuthInner />
  </NeonAuthUIProvider>
)

export default CliAuthPage
