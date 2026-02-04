import type { TUtilArgs } from '@TSCL/types'

import { emptyArr } from '@keg-hub/jsutils'
import { addEnvs, addPorts } from '@TSCL/utils/docker/helpers'

export type TDockerPullType = `missing` | `never` | `always`

export type TDockerRunArgs = {
  log?: boolean
  name?: string
  remove?: boolean
  attach?: boolean
  command?: string
  entrypoint?: string
  privileged?: boolean
  pull?: TDockerPullType
  envs?: Record<string, string>
  ports?: Record<string, string>
}

const getRunCmd = (params: TDockerRunArgs) => {
  const { command } = params
  return (command && command.split(` `)) || emptyArr
}

const getEntryPoint = (params: TDockerRunArgs) => {
  const { entrypoint } = params
  return entrypoint ? [`--entrypoint`, entrypoint] : emptyArr
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

export const run = (props: TUtilArgs<TDockerRunArgs>) => {
  return [
    `run`,
    ...getRunArgs(props.params),
    ...addPorts(props),
    ...addEnvs(props),
    ...getEntryPoint(props.params),
    props.ctx.image,
    ...getRunCmd(props.params),
  ]
}
