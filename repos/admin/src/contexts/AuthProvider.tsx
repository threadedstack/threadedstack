import type { ReactNode } from 'react'
import type { TAnyCB, TAuthSession } from '@TAF/types'


import { useState } from 'react'
import { ife } from '@keg-hub/jsutils/ife'
import { authClient } from '@TAF/services/auth'
import { useEffect, useMemo } from 'react'
import { AuthContext } from '@TAF/contexts/AuthContext'
import { initAuth } from '@TAF/actions/auth/local/init'
import { Loading, MemoChildren } from '@tdsk/components'
import { LoginError } from '@TAF/components/Login/LoginError'
import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react'

export type TAuthProvider = {
  children: ReactNode
}

export const AuthProvider = (props: TAuthProvider) => {

  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState<boolean>(true)
  const [session, setSession] = useState<TAuthSession>()
  const ctx = useMemo(() => ({session, loading}), [session, loading])

  useEffect(() => {
    if(session) return

    ife(async () => {
      try {
        setLoading(true)
        const { session, error } = await initAuth()
        if(error) return setError(error.message)
        session && setSession(session)
      }
      catch(err){
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
