export enum EApiKeyScope {
  read = `read`,
  write = `write`,
  admin = `admin`,
}

export type TApiKeyScope = `${EApiKeyScope}`

export enum ERoleType {
  super = `super`,
  admin = `admin`,
  basic = `basic`,
}

export type TRoleType = `${ERoleType}`
