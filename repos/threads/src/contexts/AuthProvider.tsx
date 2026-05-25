import type { ReactNode } from 'react'
import type { TAuthSession } from '@tdsk/components'

import { useMemo, useState } from 'react'
import { auth } from '@TTH/services/auth'
import { ife } from '@keg-hub/jsutils/ife'
import { useWaitlisted } from '@TTH/state/selectors'
import { AuthContext } from '@TTH/contexts/AuthContext'
import { initAuth } from '@TTH/actions/auth/local/init'
import { signout } from '@TTH/actions/auth/local/signout'
import { tokenRefresh } from '@TTH/services/tokenRefresh'
import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react'
import {
  LoginError,
  Loading,
  MemoChildren,
  Waitlist,
  useEffectOnce,
} from '@tdsk/components'

export type TAuthProvider = {
  children: ReactNode
}

/**
 * AuthProvider handles authentication state for the admin app
 *
 * Auth flow (Client-Side with Neon Auth):
 * 1. On mount, calls initAuth() which validates session with Neon Auth
 * 2. NeonAuthUIProvider handles OAuth redirects and token management
 * 3. JWT tokens from Neon Auth are sent to proxy in Authorization header
 * 4. Proxy validates JWT using JWKS from Neon Auth
 * 5. Token is proactively refreshed before expiry via TokenRefreshManager
 * 6. On 401 responses, token is refreshed and request retried once
 */
export const AuthProvider = (props: TAuthProvider) => {
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState<boolean>(true)
  const [session, setSession] = useState<TAuthSession>()
  const [waitlisted] = useWaitlisted()
  const ctx = useMemo(() => ({ session, loading }), [session, loading])

  useEffectOnce(() => {
    if (session) return

    ife(async () => {
      try {
        const result = await initAuth()
        if (result?.waitlisted) return
        if (!result) return

        const { session: authSession, error: authError } = result
        if (authError) return setError(authError.message)

        if (authSession) {
          setSession(authSession)
          tokenRefresh.start(authSession, setSession, signout)
        }
      } catch (err) {
        console.error(err)
        err?.message && setError(err?.message)
      } finally {
        setLoading(false)
      }
    })

    return () => tokenRefresh.stop()
  })

  return (
    <NeonAuthUIProvider authClient={auth.client}>
      <AuthContext.Provider value={ctx}>
        {error ? (
          <LoginError message={error} />
        ) : loading ? (
          <Loading
            fixed
            full
          />
        ) : waitlisted ? (
          <Waitlist
            onSignOut={async () => {
              await signout({ navigate: false })
              setTimeout(() => window.location.reload(), 0)
            }}
          />
        ) : (
          <MemoChildren {...props} />
        )}
      </AuthContext.Provider>
    </NeonAuthUIProvider>
  )
}
