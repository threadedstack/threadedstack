export type TAuthCredentials = {
  apiKey: string
  proxyUrl: string
  insecure?: boolean
}

export enum EAppPhase {
  chat = `chat`,
  error = `error`,
  login = `login`,
  loading = `loading`,
  pickAgent = `pickAgent`,
}

export type TAppPhase = `${EAppPhase}`
