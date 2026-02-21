import { useState, useCallback } from 'react'
import { AuthManager } from '@TRL/services/auth'

export function useAuth() {
  const [auth] = useState(() => new AuthManager())
  const [loggedIn, setIsLoggedIn] = useState(auth.loggedIn())

  const login = useCallback(
    async (apiKey: string, proxyUrl?: string, insecure?: boolean) => {
      await auth.login(apiKey, proxyUrl, insecure)
      setIsLoggedIn(true)
    },
    [auth]
  )

  const logout = useCallback(() => {
    auth.logout()
    setIsLoggedIn(false)
  }, [auth])

  return { auth, loggedIn, login, logout }
}
