import type { TTaskActionArgs } from '@TSCL/types'

import { auth } from '@TSCL/utils/docker/auth'
import { taskError } from '@TSCL/utils/tasks/error'

export const login = (props: TTaskActionArgs) => {
  const { config, params } = props

  const { registry } = params

  const url =
    registry ||
    config.envs.DOCKER_REGISTRY ||
    config?.envs?.TDSK_IMAGE?.split?.('/')?.shift()

  const { user, password } = auth(props)

  !user &&
    taskError(`A docker auth user name or email is required but could not be found`)
  !password &&
    taskError(`A docker auth password or token is required but could not be found`)

  return [`login`, url, `-u`, user, `-p`, password]
}
