import type { TCtxCfg, TTaskActionArgs } from '@TSCL/types'
import { noOpArr } from '@keg-hub/jsutils'

export type TRunCmd = TTaskActionArgs & {
  ctx: TCtxCfg
  env?: Record<string, string>
}

export type TDockerPullType = `missing` | `never` | `always`

export type TDockerRunArgs = {
  name: string
  remove: boolean
  attach: boolean
  privileged: boolean
  pull: TDockerPullType
}

export const addRunPorts = (props: TRunCmd) => {
  const { ctx } = props
  if (!ctx.ports) return []

  return [`-p`, `${ctx.ports.host}:${ctx.ports.remote}`]
}

const getRunCmd = (params: Record<string, any>) => {
  const { cmd } = params
  return (cmd && cmd.split(' ')) || noOpArr
}

/**
 * Gets the arguments to pass to the docker cli run command
 *
 */
export const getRunArgs = ({
  remove,
  attach,
  name,
  pull,
  privileged,
}: TDockerRunArgs) => {
  const args = []
  remove && args.push(`--rm`)
  attach && args.push(`-it`)
  name && args.push(`--name`, name)
  privileged && args.push(`--privileged`)

  ;[`missing`, `never`, `always`].includes(pull)
    ? args.push(`--pull=${pull}`)
    : args.push(`--pull=never`)

  return args
}

export const run = (props: TRunCmd) => {
  const args = [...getRunArgs(props.params as TDockerRunArgs), ...addRunPorts(props)]

  return [`run`, ...args, props.ctx.image, getRunCmd(props.params)]
}
