import { useState, useCallback } from 'react'
import { AuthManager } from '@TRL/auth'

export function useAuth() {
  const [auth] = useState(() => new AuthManager())
  const [isLoggedIn, setIsLoggedIn] = useState(auth.isLoggedIn())

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

  return { auth, isLoggedIn, login, logout }
}
