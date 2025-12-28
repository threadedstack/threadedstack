import type { TTaskActionArgs } from '@TSCL/types'

import path from 'node:path'
import { exists } from '@keg-hub/jsutils/exists'
import { emptyObj } from '@keg-hub/jsutils/emptyObj'
import { emptyArr } from '@keg-hub/jsutils/emptyArr'
import { flatUnion } from '@keg-hub/jsutils/flatUnion'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'


type TCmdFlags = Record<string, string>
type TDSActArgs = TTaskActionArgs & Record<string, any>
type TDSCallback = (props:TDSActArgs) => any


export const checkCmdArgs = (
  props:TTaskActionArgs,
  flags:TCmdFlags=emptyObj as TCmdFlags,
  values:string[]=emptyArr as string[]
) => {
  
  const {
    params
  } = props
  
  const args = Object.entries(params)
    .reduce((options, [key, value]:[string, string]) => {
      if (flags[key] && value) options.push(flags[key])
      else if (values.includes(key) && exists(value)) options.push(`--${key}`, value)

      return options
    }, [] as string[])
  
  params.args = params.args || []
  params.args = flatUnion(params.args, args)

  return {...props, params}
}



const checkConfigPath = (props:TTaskActionArgs) => {
  const {
    config,
    params
  } = props

  !params.envs[`DEVSPACE_CONFIG`]
    && (params.envs[`DEVSPACE_CONFIG`] = path.join(config.paths.deploy, `devspace.yaml`))

  return {...props, params}
}

const checkNodeOpts = (props:TTaskActionArgs) => {
  const {
    params
  } = props

  const nodeOpts = params.envs[`NODE_OPTIONS`] || ``

  // Add esbuild-register so we can transform typescript files inline
  if(!nodeOpts.includes(`-r esbuild-register`))
    params.envs[`NODE_OPTIONS`] = `${nodeOpts} -r esbuild-register`.trim()

  return {...props, params}
}

const checkDSArgs = (props:TTaskActionArgs) => {
  const {
    params
  } = props

  params.dsargs = params.dsargs || []

  const meta = getKubeMeta(props)
  params.dsargs = [...params.dsargs, ...meta]

  const profile = params.profile || params.env
  profile && params.dsargs.push(`--profile`, profile)

  return {...props, params}
}


export const dsdefaults = (
  cb:TDSCallback,
  flags?:TCmdFlags,
  values?:string[]
) => async (props:TTaskActionArgs) => {


  let updated:TTaskActionArgs = {...props, params:{envs: {}, args: [], dsargs: [], ...props.params}}

  updated = checkDSArgs(updated)
  updated = checkNodeOpts(updated)
  updated = checkConfigPath(updated)

  if(flags || values) updated = checkCmdArgs(props, flags, values)

  return await cb(updated)
}
