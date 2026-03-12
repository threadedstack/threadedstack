import type { ReactNode } from 'react'
import type { TAuthSession } from '@TAF/types'

import { useMemo, useState } from 'react'
import { auth } from '@TAF/services/auth'
import { ife } from '@keg-hub/jsutils/ife'
import { AuthContext } from '@TAF/contexts/AuthContext'
import { initAuth } from '@TAF/actions/auth/local/init'
import { signout } from '@TAF/actions/auth/local/signout'
import { tokenRefresh } from '@TAF/services/tokenRefresh'
import { LoginError } from '@TAF/components/Login/LoginError'
import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react'
import { Loading, MemoChildren, useEffectOnce } from '@tdsk/components'

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
  const ctx = useMemo(() => ({ session, loading }), [session, loading])

  useEffectOnce(() => {
    if (session) return

    ife(async () => {
      try {
        const { session: authSession, error: authError } = await initAuth()
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
        ) : (
          <MemoChildren {...props} />
        )}
      </AuthContext.Provider>
    </NeonAuthUIProvider>
  )
}
