export type TEnvFilter = {
  add: string[]
  ends: string[]
  starts: string[]
  contains: string[]
  exclude: string[]
}

export type TEnvObject = {
  [k: string]: string | boolean | number
}

export type TProcOpts = {
  cwd?: string
  exec?: boolean
  env?: TEnvObject
  envs?: TEnvObject
  uid?: string | number
  guid?: string | number
}
