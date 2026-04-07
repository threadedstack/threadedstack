import { env } from './env'

/**
 * Acquire a user-level JWT from Neon Auth via email/password sign-in.
 *
 * Flow:
 * 1. POST /sign-in/email → returns session cookie
 * 2. GET /token with cookie → returns Ed25519-signed JWT
 *
 * The JWT is validated by the proxy against the Neon Auth JWKS endpoint,
 * giving full user-level auth (unlike API keys which have restricted scopes).
 *
 * Requires a verified user in Neon Auth (emailVerified=true).
 */
export const acquireJwt = async (): Promise<string | null> => {
  const { authUrl, testUserEmail, testUserPassword } = env

  if (!authUrl || !testUserEmail || !testUserPassword) {
    console.warn('[jwt-auth] Missing TDSK_IT_AUTH_URL, TDSK_IT_USER_EMAIL, or TDSK_IT_USER_PASSWORD — skipping JWT auth')
    return null
  }

  try {
    // Step 1: Sign in to get a session cookie
    const signInRes = await fetch(`${authUrl}/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5887',
      },
      body: JSON.stringify({ email: testUserEmail, password: testUserPassword }),
      redirect: 'manual',
    })

    if (!signInRes.ok) {
      const body = await signInRes.text()
      console.warn(`[jwt-auth] Sign-in failed (${signInRes.status}): ${body}`)
      return null
    }

    // Extract session cookie from set-cookie header
    const setCookie = signInRes.headers.get('set-cookie')
    if (!setCookie) {
      console.warn('[jwt-auth] No set-cookie header in sign-in response')
      return null
    }

    // Parse the first cookie (name=value before any attributes)
    const cookie = setCookie.split(',')[0]?.split(';')[0]?.trim()
    if (!cookie || !cookie.includes('=')) {
      console.warn(`[jwt-auth] Unexpected set-cookie format: ${setCookie.slice(0, 100)}`)
      return null
    }

    // Step 2: Exchange session cookie for JWT
    const tokenRes = await fetch(`${authUrl}/token`, {
      headers: {
        'Origin': 'http://localhost:5887',
        'Cookie': cookie,
      },
    })

    if (!tokenRes.ok) {
      console.warn(`[jwt-auth] Token exchange failed (${tokenRes.status})`)
      return null
    }

    const { token } = await tokenRes.json() as { token: string }
    if (!token) {
      console.warn('[jwt-auth] No token in response')
      return null
    }

    return token
  } catch (err) {
    const msg = (err as Error).message
    // Network/DNS failures should fail the suite, not silently skip
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
      throw new Error(`[jwt-auth] Infrastructure error: ${msg}`)
    }
    console.warn(`[jwt-auth] Error: ${msg}`)
    return null
  }
}
