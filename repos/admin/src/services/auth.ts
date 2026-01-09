import type { TAuthError } from '@TAF/types'

import { User } from '@tdsk/domain'
import { TDSK_AUTH_URL } from '@TAF/constants/envs'
import { createAuthClient } from '@neondatabase/neon-js/auth'

/**
 * Neon Auth client for client-side OAuth
 * The admin app handles auth directly with Neon Auth
 * JWT tokens are sent to proxy which validates them
 */
export const authClient = createAuthClient(TDSK_AUTH_URL)

type TAuthResp = {
  session?: any
  error?: TAuthError
  user?: User
}

export class Auth {
  client = authClient

  constructor() {}

  #error = (error: TAuthError): TAuthResp => {
    console.log(`[${error.status}] - (${error.code}) ${error.message}`)
    return { error }
  }

  signin = async (provider: string): Promise<TAuthResp> => {
    const { data, error } = await this.client.signIn.social({
      provider,
    })
    if (`user` in data) return { user: new User(data.user) }
    if (error) return this.#error(error)

    return this.#error({
      status: 404,
      code: `404`,
      statusText: `Error`,
      message: `Could not complete user login`,
    })
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
