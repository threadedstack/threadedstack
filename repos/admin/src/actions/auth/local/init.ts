import { nav } from '@TAF/services/nav'
import { auth } from '@TAF/services/auth'
import { apiService } from '@TAF/services/api'
import { setUser } from '@TAF/state/accessors'

/**
 * Initialize authentication on app startup
 *
 * Client-side auth flow with Neon Auth:
 * 1. Check for existing session with Neon Auth client
 * 2. If session exists, update user state for UI
 *
 * Neon Auth manages tokens internally - no manual storage needed.
 * JWT tokens are retrieved from Neon Auth for API requests.
 */
export const initAuth = async () => {
  const data = await auth.session()

  if (!data?.user) {
    nav.signin()
    return data
  }

  await apiService.bearer(data)

  data.user && setUser(data.user)

  return data
}
