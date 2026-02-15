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

export enum EApiKeyExpire {
  d7 = 7,
  d30 = 30,
  d90 = 90,
  d180 = 180,
  y1 = 365,
  never = `none`,
}
