
export type TEnvObject = {
  [k:string]:string|boolean|number
}

export type TProcOpts = {
  cwd?:string
  exec?:boolean
  env?:TEnvObject
  envs?:TEnvObject
  uid?:string|number
  guid?:string|number
}