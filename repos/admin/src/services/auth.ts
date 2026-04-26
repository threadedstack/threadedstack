import type { TAuthError, TAuthResp, TAuthProvider } from '@tdsk/components'

import { User } from '@tdsk/domain'
import { TDSK_AUTH_URL } from '@TAF/constants/envs'
import { createAuthClient } from '@neondatabase/neon-js/auth'

/**
 * Neon Auth client for client-side authentication (OAuth + email/password)
 * The admin app handles auth directly with Neon Auth
 * JWT tokens are sent to proxy which validates them
 */
export const authClient = createAuthClient(TDSK_AUTH_URL)

export class Auth {
  client = authClient

  constructor() {}

  #error = (error: TAuthError): TAuthResp => {
    console.warn(`[Auth] [${error.status}] - (${error.code}) ${error.message}`)
    return { error }
  }

  signin = async (provider?: TAuthProvider): Promise<TAuthResp> => {
    const { error } = await this.client.signIn.social({ provider })
    if (error) return this.#error(error)

    return await this.session()
  }

  signUpWithEmail = async (
    email: string,
    password: string,
    name?: string
  ): Promise<TAuthResp> => {
    const displayName = name || email.split(`@`)[0]
    const { error } = await this.client.signUp.email({
      email,
      password,
      name: displayName,
    })
    if (error) return this.#error(error)

    return await this.session()
  }

  signInWithEmail = async (email: string, password: string): Promise<TAuthResp> => {
    const { error } = await this.client.signIn.email({ email, password })
    if (error) return this.#error(error)

    return await this.session()
  }

  forgotPassword = async (email: string): Promise<TAuthResp> => {
    const { error } = await this.client.forgetPassword.emailOtp({ email })
    if (error) return this.#error(error)

    return { success: true }
  }

  signout = async () => {
    const { error } = await this.client.signOut()
    return error ? this.#error(error) : true
  }

  session = async (): Promise<TAuthResp> => {
    const { data, error } = await this.client.getSession()
    if (error) return this.#error(error)
    if (data) return { ...data, user: new User(data.user) }

    return {}
  }
}

export const auth = new Auth()
