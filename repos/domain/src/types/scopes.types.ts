export enum EApiKeyScope {
  read = `read`,
  write = `write`,
  admin = `admin`,
}

export type TApiKeyScope = `${EApiKeyScope}`

export type TKeyHash = {
  key: string
  hash: string
  prefix: string
}
