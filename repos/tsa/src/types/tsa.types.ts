type TApiKeyAuth = {
  apiKey: string
  token?: never
  expiresAt?: never
  proxyUrl: string
  insecure?: boolean
}

type TTokenAuth = {
  apiKey?: never
  token: string
  expiresAt?: string
  proxyUrl: string
  insecure?: boolean
}

export type TBrowserAuthResult = {
  token: string
  expiresAt?: string
  neonAuthUrl?: string
}

export type TTokenLoginOpts = {
  token: string
  expiresAt?: string
  proxyUrl?: string
  insecure?: boolean
  neonAuthUrl?: string
}

export type TAuthCredentials = TApiKeyAuth | TTokenAuth

export enum EAppPhase {
  chat = `chat`,
  error = `error`,
  login = `login`,
  loading = `loading`,
  pickAgent = `pickAgent`,
  pickProject = `pickProject`,
}

export type TAppPhase = `${EAppPhase}`
