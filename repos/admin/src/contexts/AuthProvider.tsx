import type { ReactNode } from 'react'
import type { TAuthSession } from '@TAF/types'

import { useMemo, useState } from 'react'
import { ife } from '@keg-hub/jsutils/ife'
import { authClient } from '@TAF/services/auth'
import { AuthContext } from '@TAF/contexts/AuthContext'
import { initAuth } from '@TAF/actions/auth/local/init'
import { LoginError } from '@TAF/components/Login/LoginError'
import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react'
import { Loading, MemoChildren, useEffectOnce } from '@tdsk/components'

export type TAuthProvider = {
  children: ReactNode
}

export const AuthProvider = (props: TAuthProvider) => {

  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState<boolean>(true)
  const [session, setSession] = useState<TAuthSession>()
  const ctx = useMemo(() => ({session, loading}), [session, loading])

  useEffectOnce(() => {
    if(session) return

    ife(async () => {
      try {
        setLoading(true)
        const { session, error } = await initAuth()
        if(error) return setError(error.message)
        session && setSession(session)
      }
      catch(err){
        console.error(err)
        setError(err.message)
      }
      finally {
        setLoading(false)
      }
    })

  })
  
  return (
    <NeonAuthUIProvider authClient={authClient}>
      <AuthContext.Provider value={ctx}>
        { 
          error
            ? <LoginError message={error} />
            : loading
              ? (<Loading fixed full />)
              : (<MemoChildren {...props} />)
        }
      </AuthContext.Provider>
    </NeonAuthUIProvider>
  )

}
