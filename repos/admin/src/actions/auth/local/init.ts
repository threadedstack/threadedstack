import { nav } from '@TAF/services/nav'
import { auth } from '@TAF/services/auth'
import { WaitlistRole } from '@tdsk/domain'
import { apiService } from '@TAF/services/api'
import { setUser, setWaitlisted } from '@TAF/state/accessors'

/**
 * Initialize authentication on app startup
 *
 * Client-side auth flow with Neon Auth:
 * 1. Check for existing session with Neon Auth client
 * 2. If session exists, update user state for UI
 * 3. Check backend access gate - if waitlisted, return flag
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

  setUser(data.user)

  await apiService.bearer(data)

  if (data.user.role === WaitlistRole) {
    setWaitlisted(true)
    return { ...data, waitlisted: true }
  }

  return data
}
