import { TDSK_AUTH_URL } from '@TAF/constants/envs'
import { createAuthClient } from '@neondatabase/neon-js/auth'

export const authClient = createAuthClient(TDSK_AUTH_URL)

type TAuthError = {
  code?: string;
  message?: string;
  status: number;
  statusText: string;
}

export class Auth {
  
  client=authClient

  constructor(){}

  #error = (error:TAuthError) => {
    console.log(`[${error.status}] - (${error.code}) ${error.message}`)
    return false
  }

  signin = async (provider?:string) => {
    return await this.client.signIn.social({
      provider,
    })
  }

  signout = async (provider?:string) => {
    const { error } = await this.client.signOut()
    return error ? this.#error(error) : true
  }

  session = async () => {
    const { data, error } = await this.client.getSession()
    return error ? this.#error(error) : data
  }

}

export const auth = new Auth()