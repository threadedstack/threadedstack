declare module 'simple-oauth2' {
  export interface ClientCredentialsOptions {
    client: {
      id: string
      secret: string
    }
    auth: {
      tokenHost: string
      tokenPath?: string
      revokePath?: string
      authorizeHost?: string
      authorizePath?: string
    }
    options?: {
      authorizationMethod?: `header` | `body`
      bodyFormat?: `form` | `json`
      scopeSeparator?: string
    }
  }

  export interface TokenOptions {
    scope?: string | string[]
    [key: string]: any
  }

  export interface Token {
    access_token: string
    token_type: string
    expires_in?: number
    expires_at: Date
    refresh_token?: string
    scope?: string
    [key: string]: any
  }

  export interface AccessToken {
    token: Token
    expired(): boolean
    refresh(options?: TokenOptions): Promise<AccessToken>
    revoke(tokenType: string): Promise<void>
  }

  export class ClientCredentials {
    constructor(options: ClientCredentialsOptions)
    getToken(options?: TokenOptions): Promise<AccessToken>
  }

  export class AuthorizationCode {
    constructor(options: ClientCredentialsOptions)
    authorizeURL(options?: TokenOptions): string
    getToken(code: string, options?: TokenOptions): Promise<AccessToken>
  }
}
